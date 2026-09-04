const container = document.getElementById("marketCards");

const CONDITION_LABELS = {
    mint: "Mint",
    near_mint: "Near Mint",
    excellent: "Excelente",
    good: "Boa",
    played: "Usada",
    poor: "Danificada",
};

const LANGUAGE_LABELS = {
    PT: "Português", EN: "Inglês", ES: "Espanhol", FR: "Francês",
    DE: "Alemão", IT: "Italiano", JP: "Japonês", KO: "Coreano", ZH: "Chinês",
};

const GAME_LABELS = {
    pokemon: "Pokémon", yugioh: "Yu-Gi-Oh!", magic: "Magic", onepiece: "One Piece",
};

let allListings = [];

async function loadCards() {

    const response = await fetch(`${API_BASE}/listings`);
    allListings = await response.json();

    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q");
    if (initialQuery) {
        document.getElementById("searchInput").value = initialQuery;
    }

    const initialGame = params.get("game");
    if (initialGame) {
        const gameCheckbox = document.querySelector(`.game-filter[value="${initialGame}"]`);
        if (gameCheckbox) gameCheckbox.checked = true;
    }

    applyFiltersAndRender();
}

function applyFiltersAndRender() {

    let listings = [...allListings];

    const search = document.getElementById("searchInput").value.trim().toLowerCase();
    if (search) {
        listings = listings.filter(l => l.card_name.toLowerCase().includes(search));
    }

    const checkedConditions = Array.from(document.querySelectorAll(".condition-filter:checked")).map(c => c.value);
    if (checkedConditions.length > 0) {
        listings = listings.filter(l => checkedConditions.includes(l.condition));
    }

    const checkedGames = Array.from(document.querySelectorAll(".game-filter:checked")).map(c => c.value);
    if (checkedGames.length > 0) {
        listings = listings.filter(l => checkedGames.includes(l.game));
    }

    const checkedLanguages = Array.from(document.querySelectorAll(".language-filter:checked")).map(c => c.value);
    if (checkedLanguages.length > 0) {
        listings = listings.filter(l => checkedLanguages.includes(l.language));
    }

    if (document.getElementById("foilFilter").checked) {
        listings = listings.filter(l => l.is_foil);
    }

    renderListings(listings);
}

function renderListings(listings) {

    container.innerHTML = "";

    if (listings.length === 0) {
        container.innerHTML = "<p>Nenhuma carta encontrada.</p>";
        return;
    }

    listings.forEach(listing => {

        const card = document.createElement("div");
        card.className = "card";
        card.style.cursor = "pointer";

        card.innerHTML = `
            <img src="${listing.card_image ?? ""}">
            <h3>${listing.card_name}</h3>
            <p><a href="perfil.html?id=${listing.user_id}" class="seller-link">${listing.seller_name}</a></p>
            <span>${GAME_LABELS[listing.game] ?? listing.game} · ${CONDITION_LABELS[listing.condition] ?? listing.condition} · ${LANGUAGE_LABELS[listing.language] ?? listing.language}${listing.is_foil ? " ✨" : ""}</span>
            <strong>${Number(listing.price).toFixed(2)} €</strong>
        `;

        card.addEventListener("click", (e) => {
            if (e.target.closest(".seller-link")) return;
            window.location.href = `product.html?id=${listing.id}`;
        });

        container.appendChild(card);

    });

}

document.getElementById("searchInput").addEventListener("input", applyFiltersAndRender);
document.querySelectorAll(".condition-filter").forEach(cb => cb.addEventListener("change", applyFiltersAndRender));
document.querySelectorAll(".game-filter").forEach(cb => cb.addEventListener("change", applyFiltersAndRender));
document.querySelectorAll(".language-filter").forEach(cb => cb.addEventListener("change", applyFiltersAndRender));
document.getElementById("foilFilter").addEventListener("change", applyFiltersAndRender);

loadCards();