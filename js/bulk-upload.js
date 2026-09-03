const token = localStorage.getItem("token");
const loginWarning = document.getElementById("loginWarning");
const bulkFlow = document.getElementById("bulkFlow");

if (!token) {
    loginWarning.style.display = "block";
    bulkFlow.style.display = "none";
}

const VALID_CONDITIONS = ["mint", "near_mint", "excellent", "good", "played", "poor"];
const VALID_LANGUAGES = ["PT", "EN", "ES", "FR", "DE", "IT", "JP", "KO", "ZH"];

let parsedRows = []; // { nome, preco, condicao, quantidade, idioma, foil, descricao, match: null|card, status }

document.getElementById("downloadTemplate").addEventListener("click", (e) => {
    e.preventDefault();
    const csv = "nome,preco,condicao,quantidade,idioma,foil,descricao\nCharizard,50,near_mint,1,EN,não,\nPikachu,10,mint,2,PT,sim,Carta reluzente";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-anuncios.csv";
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById("csvFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            processRows(results.data);
        },
    });
});

async function processRows(rows) {
    parsedRows = rows.map(row => ({
        nome: (row.nome || "").trim(),
        preco: row.preco,
        condicao: (row.condicao || "").trim(),
        quantidade: row.quantidade || 1,
        idioma: (row.idioma || "EN").trim().toUpperCase(),
        foil: ["sim", "true", "1"].includes((row.foil || "").trim().toLowerCase()),
        descricao: row.descricao || "",
        match: null,
        status: "pending", // pending | matched | not_found | invalid
        error: null,
    }));

    document.getElementById("previewSection").style.display = "block";
    renderPreviewTable();

    for (const row of parsedRows) {
        await matchCard(row);
        renderPreviewTable();
    }
}

async function matchCard(row) {
    if (!row.nome) {
        row.status = "invalid";
        row.error = "Sem nome de carta";
        return;
    }

    if (!VALID_CONDITIONS.includes(row.condicao)) {
        row.status = "invalid";
        row.error = "Condição inválida";
        return;
    }

    if (!VALID_LANGUAGES.includes(row.idioma)) {
        row.status = "invalid";
        row.error = "Idioma inválido";
        return;
    }

    if (!row.preco || Number(row.preco) <= 0) {
        row.status = "invalid";
        row.error = "Preço inválido";
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/cards?q=${encodeURIComponent(row.nome)}`);
        const cards = await response.json();

        if (!response.ok || !Array.isArray(cards) || cards.length === 0) {
            row.status = "not_found";
            row.error = "Carta não encontrada na TCGdex";
            return;
        }

        row.match = cards[0]; // assume o primeiro resultado — a pessoa confirma na pré-visualização
        row.status = "matched";

    } catch (error) {
        console.error(error);
        row.status = "not_found";
        row.error = "Erro ao pesquisar";
    }
}

function renderPreviewTable() {
    const body = document.getElementById("previewBody");

    body.innerHTML = parsedRows.map((row, index) => {
        const statusLabel = {
            pending: `<span class="bulk-status-pending">A procurar...</span>`,
            matched: `<span class="bulk-status-ok">✓ Encontrado</span>`,
            not_found: `<span class="bulk-status-error">✗ ${row.error}</span>`,
            invalid: `<span class="bulk-status-error">✗ ${row.error}</span>`,
        }[row.status];

        const canPublish = row.status === "matched";

        return `
            <tr>
                <td><input type="checkbox" class="bulk-row-check" data-index="${index}" ${canPublish ? "checked" : "disabled"}></td>
                <td>${row.match ? `<img src="${row.match.image}/low.webp">` : ""}</td>
                <td>${row.nome}</td>
                <td>${row.match ? row.match.name : "—"}</td>
                <td>${row.preco} €</td>
                <td>${statusLabel}</td>
            </tr>
        `;
    }).join("");
}

document.getElementById("publishAllBtn").addEventListener("click", async () => {
    const message = document.getElementById("bulkMessage");
    const checkedIndexes = Array.from(document.querySelectorAll(".bulk-row-check:checked")).map(c => Number(c.dataset.index));

    if (checkedIndexes.length === 0) {
        message.textContent = "Não há nenhuma carta selecionada para publicar.";
        return;
    }

    let published = 0;
    let failed = 0;

    for (const index of checkedIndexes) {
        const row = parsedRows[index];

        message.textContent = `A publicar ${published + failed + 1} de ${checkedIndexes.length}...`;

        try {
            const response = await fetch(`${API_BASE}/listings`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    card_id: row.match.id,
                    card_name: row.match.name,
                    card_image: row.match.image,
                    price: row.preco,
                    condition: row.condicao,
                    quantity: row.quantidade,
                    description: row.descricao || null,
                    language: row.idioma,
                    is_foil: row.foil,
                }),
            });

            if (response.ok) {
                published++;
            } else {
                failed++;
            }

        } catch (error) {
            console.error(error);
            failed++;
        }
    }

    message.textContent = `Concluído: ${published} publicadas, ${failed} falharam.`;
});