const token = localStorage.getItem("token");
const loginWarning = document.getElementById("loginWarning");
const bulkFlow = document.getElementById("bulkFlow");

if (!token) {
    loginWarning.style.display = "block";
    bulkFlow.style.display = "none";
}

const VALID_GAMES = ["pokemon", "yugioh", "magic", "onepiece"];
const VALID_CONDITIONS = ["mint", "near_mint", "excellent", "good", "played", "poor"];
const VALID_LANGUAGES = ["PT", "EN", "ES", "FR", "DE", "IT", "JP", "KO", "ZH"];
const VALID_VARIANTS = ["normal", "foil", "holo", "reverse_holo"];

// A ordem das colunas é sempre esta — usamos a POSIÇÃO, não o nome da coluna.
// Assim, quer a pessoa mantenha o cabeçalho, o traduza, ou o apague sem querer
// no Excel, o ficheiro continua a funcionar da mesma forma.
const COLUMN_ORDER = ["jogo", "nome", "preco", "condicao", "quantidade", "idioma", "variante", "descricao"];

// Limpa o preço de símbolos de moeda, espaços, etc. — aceita "5000", "5000€",
// "€ 5000", "50,50" (vírgula como casa decimal) sem rebentar com nada disto.
function parsePrice(raw) {
    const cleaned = (raw || "")
        .toString()
        .replace(/[^\d,.-]/g, "")
        .replace(",", ".");

    return Number(cleaned);
}

let parsedRows = []; // { jogo, nome, preco, condicao, quantidade, idioma, variante, descricao, match, status, error }

document.getElementById("downloadTemplate").addEventListener("click", (e) => {
    e.preventDefault();
    const csv = "jogo,nome,preco,condicao,quantidade,idioma,variante,descricao\n" +
        "pokemon,Charizard,50,near_mint,1,EN,normal,\n" +
        "pokemon,Pikachu,10,mint,2,PT,holo,Carta reluzente\n" +
        "magic,Black Lotus,500,excellent,1,EN,normal,\n" +
        "yugioh,Blue-Eyes White Dragon,15,near_mint,1,EN,foil,";
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

    // Lê sempre como linhas simples (sem depender dos nomes das colunas) —
    // isto é o que nos permite recuperar sozinhos se o cabeçalho desaparecer.
    Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
            let dataRows = results.data;

            // Se a primeira linha for mesmo o cabeçalho (a primeira célula
            // literalmente "jogo"), ignora-a. Caso contrário, assume que o
            // ficheiro já começa logo com dados a sério — sem partir nada.
            const firstCell = (dataRows[0]?.[0] || "").trim().toLowerCase();
            if (firstCell === "jogo") {
                dataRows = dataRows.slice(1);
            }

            processRows(dataRows);
        },
    });
});

async function processRows(dataRows) {
    parsedRows = dataRows.map(cells => {
        const row = {};
        COLUMN_ORDER.forEach((key, index) => {
            row[key] = (cells[index] || "").toString().trim();
        });

        return {
            jogo: row.jogo.toLowerCase(),
            nome: row.nome,
            preco: row.preco,
            condicao: row.condicao,
            quantidade: row.quantidade || 1,
            idioma: (row.idioma || "EN").toUpperCase(),
            variante: (row.variante || "normal").toLowerCase(),
            descricao: row.descricao || "",
            match: null,
            status: "pending", // pending | matched | not_found | invalid
            error: null,
        };
    });

    document.getElementById("previewSection").style.display = "block";
    document.getElementById("bulkMessage").textContent = "";
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

    if (!VALID_GAMES.includes(row.jogo)) {
        row.status = "invalid";
        row.error = "Jogo inválido (usa pokemon, yugioh, magic ou onepiece)";
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

    if (!VALID_VARIANTS.includes(row.variante)) {
        row.status = "invalid";
        row.error = "Variante inválida (usa normal, foil, holo ou reverse_holo)";
        return;
    }

    const precoLimpo = parsePrice(row.preco);

    if (!precoLimpo || precoLimpo <= 0 || Number.isNaN(precoLimpo)) {
        row.status = "invalid";
        row.error = `Preço inválido ("${row.preco}") — usa só números, sem símbolo de moeda`;
        return;
    }

    row.preco = precoLimpo; // já limpo, pronto a usar/mostrar/publicar

    try {
        const response = await fetch(`${API_BASE}/cards?q=${encodeURIComponent(row.nome)}&game=${row.jogo}`);
        const cards = await response.json();

        if (!response.ok || !Array.isArray(cards) || cards.length === 0) {
            row.status = "not_found";
            row.error = "Carta não encontrada";
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

const GAME_LABELS = { pokemon: "Pokémon", yugioh: "Yu-Gi-Oh!", magic: "Magic", onepiece: "One Piece" };

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
                <td>${row.match ? `<img src="${row.match.image}">` : ""}</td>
                <td>${GAME_LABELS[row.jogo] ?? row.jogo}</td>
                <td>${row.nome}</td>
                <td>${row.match ? row.match.name : "—"}</td>
                <td>${Number.isFinite(row.preco) ? Number(row.preco).toFixed(2) : row.preco} €</td>
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
                    set_name: row.match.set_name || null,
                    game: row.jogo,
                    price: row.preco,
                    condition: row.condicao,
                    quantity: row.quantidade,
                    description: row.descricao || null,
                    language: row.idioma,
                    variant: row.variante,
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