const API_BASE = "http://localhost:3000";

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
        const response = await fetch(`${API_BASE}/cards?q=${encodeURIComponent(search)}`);
        const cards = await response.json();

        if (!cards || cards.length === 0) {
            results.innerHTML = "<p>Nenhuma carta encontrada.</p>";
            return;
        }

        results.innerHTML = "";

        cards.forEach(card => {
            const imageUrl = `${card.image}/low.webp`;
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
    `;

    results.innerHTML = "";
    document.getElementById("searchCard").value = card.name;
    listingForm.style.display = "block";
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
    const weight_grams = document.getElementById("weight").value;
    const description = document.getElementById("description").value;

    message.textContent = "A publicar...";
    message.className = "";

    try {
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
                price,
                condition,
                quantity,
                weight_grams,
                description,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.error || "Erro ao publicar anúncio.";
            message.className = "error";
            return;
        }

        message.textContent = "Anúncio publicado! A redirecionar para o marketplace...";
        message.className = "success";

        setTimeout(() => {
            window.location.href = "marketplace.html";
        }, 1200);

    } catch (error) {
        console.error(error);
        message.textContent = "Erro ao ligar ao servidor.";
        message.className = "error";
    }
});