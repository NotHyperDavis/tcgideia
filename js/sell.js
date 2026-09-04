// Reutilizável: mostra um aviso com botão de reenviar, se o erro for de email por confirmar.
function showVerificationPrompt(container, data) {
    if (data.code !== "EMAIL_NOT_VERIFIED") return false;

    container.innerHTML = `Confirma o teu email antes de continuares. <button id="resendVerifyBtn" type="button">Reenviar email de confirmação</button>`;
    container.className = "error";

    document.getElementById("resendVerifyBtn").addEventListener("click", async () => {
        const btn = document.getElementById("resendVerifyBtn");
        btn.disabled = true;
        btn.textContent = "A enviar...";

        try {
            const response = await fetch(`${API_BASE}/auth/resend-verification`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
            });
            const result = await response.json();
            container.textContent = response.ok ? "Email reenviado! Verifica a tua caixa de correio." : (result.error || "Erro ao reenviar.");
        } catch (error) {
            console.error(error);
            container.textContent = "Erro ao ligar ao servidor.";
        }
    });

    return true;
}

const loginWarning = document.getElementById("loginWarning");
const sellFlow = document.getElementById("sellFlow");
const results = document.getElementById("results");
const listingForm = document.getElementById("listingForm");
const selectedCardPreview = document.getElementById("selectedCardPreview");
const message = document.getElementById("message");

let selectedCard = null;

function getToken() {
    return localStorage.getItem("token");
}

// Reutilizável: envia um ficheiro para o Cloudinary (via o backend) e devolve o URL público.
async function uploadImage(file) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${getToken()}` },
        body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar a imagem.");
    }

    return data.url;
}

document.getElementById("realPhoto")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById("realPhotoPreview");
    if (!file) {
        preview.innerHTML = "";
        return;
    }
    preview.innerHTML = `<img src="${URL.createObjectURL(file)}" style="max-width:160px; border-radius:8px; margin-top:10px;">`;
});

function checkAuthentication() {
    const token = getToken();

    if (!token) {
        loginWarning.style.display = "block";
        sellFlow.style.display = "none";
        return false;
    }

    loginWarning.style.display = "none";
    sellFlow.style.display = "block";
    return true;
}

checkAuthentication();

async function searchCard() {
    const searchInput = document.getElementById("searchCard");
    if (!searchInput) return;
    
    const search = searchInput.value.trim();

    if (search.length < 2) {
        results.innerHTML = "<p>Escreve pelo menos 2 letras para pesquisar.</p>";
        return;
    }

    results.innerHTML = "<p>A pesquisar...</p>";

    try {
        const game = document.getElementById("gameSelect")?.value || "pokemon";
        const response = await fetch(`${API_BASE}/cards?q=${encodeURIComponent(search)}&game=${game}`);
        const cards = await response.json();

        if (!cards || cards.length === 0) {
            results.innerHTML = "<p>Nenhuma carta encontrada.</p>";
            return;
        }

        results.innerHTML = "";

        cards.forEach(card => {
            const imageUrl = card.image || "";
            const el = document.createElement("div");
            el.className = "card";
            el.innerHTML = `
                <img src="${imageUrl}">
                <h3>${card.name}</h3>
            `;
            el.addEventListener("click", () => selectCard(card, imageUrl));
            results.appendChild(el);
        });

    } catch (error) {
        console.error(error);
        results.innerHTML = "<p>Erro ao pesquisar cartas.</p>";
    }
}

// Se tiveres um botão de pesquisa no HTML com ID "searchBtn", garantimos que ele dispara a função
const searchBtn = document.getElementById("searchBtn");
if (searchBtn) {
    searchBtn.addEventListener("click", searchCard);
}

// Opcional: permitir pesquisar ao carregar no Enter na caixa de texto
const searchCardInput = document.getElementById("searchCard");
if (searchCardInput) {
    searchCardInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            searchCard();
        }
    });
}

function selectCard(card, imageUrl) {
    selectedCard = { ...card, resolvedImage: imageUrl };

    selectedCardPreview.innerHTML = `
        <img src="${imageUrl}">
        <p><strong>${card.name}</strong></p>
        ${card.set_name ? `<p style="font-size:12px; color:var(--text-dim);">Expansão: ${card.set_name}</p>` : ""}
        <p id="trendPriceInfo" style="font-size:13px; color:var(--text-dim);">A verificar preço de referência...</p>
    `;

    results.innerHTML = "";
    document.getElementById("searchCard").value = card.name;
    listingForm.style.display = "block";

    loadTrendPrice(card.id);
}

async function loadTrendPrice(cardId) {
    const trendEl = document.getElementById("trendPriceInfo");
    if (!trendEl) return;

    try {
        const response = await fetch(`${API_BASE}/listings/trend/${cardId}`);
        const data = await response.json();

        if (!response.ok || data.source === "none") {
            trendEl.textContent = "Sem dados de preço para esta carta ainda — tu és dos primeiros a vendê-la.";
            return;
        }

        const label = data.source === "sales" ? "vendas recentes" : "anúncios ativos";
        trendEl.innerHTML = `💡 Preço de referência (${label}, ${data.sample_size} ${data.sample_size === 1 ? "amostra" : "amostras"}): <strong>${data.avg_price.toFixed(2)} €</strong> (entre ${data.min_price.toFixed(2)} € e ${data.max_price.toFixed(2)} €)`;

    } catch (error) {
        console.error(error);
        trendEl.textContent = "";
    }
}

listingForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!selectedCard) {
        message.textContent = "Escolhe primeiro uma carta na pesquisa.";
        message.className = "error";
        return;
    }

    const price = document.getElementById("price").value;
    const condition = document.getElementById("condition").value;
    const quantity = document.getElementById("quantity").value;
    const description = document.getElementById("description").value;

    message.textContent = "A publicar...";
    message.className = "";

    try {
        let real_photo_url = null;
        const photoFile = document.getElementById("realPhoto")?.files[0];

        if (photoFile) {
            message.textContent = "A enviar foto...";
            real_photo_url = await uploadImage(photoFile);
            message.textContent = "A publicar...";
        }

        const response = await fetch(`${API_BASE}/listings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getToken()}`,
            },
            body: JSON.stringify({
                card_id: selectedCard.id,
                card_name: selectedCard.name,
                card_image: selectedCard.resolvedImage,
                game: document.getElementById("gameSelect")?.value || "pokemon",
                set_name: selectedCard.set_name || null,
                price,
                condition,
                quantity,
                description,
                real_photo_url,
                language: document.getElementById("language").value,
                variant: document.getElementById("variantSelect").value,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            if (!showVerificationPrompt(message, data)) {
                message.textContent = data.error || "Erro ao publicar anúncio.";
                message.className = "error";
            }
            return;
        }

        message.textContent = "Anúncio publicado! A redirecionar para o marketplace...";
        message.className = "success";

        setTimeout(() => {
            window.location.href = "marketplace.html";
        }, 1200);

    } catch (error) {
        console.error(error);
        message.textContent = error.message || "Erro ao ligar ao servidor.";
        message.className = "error";
    }
});