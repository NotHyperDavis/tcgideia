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

const VARIANT_LABELS = {
    foil: " ✨ Foil", holo: " ✨ Holo", reverse_holo: " ✨ Reverse Holo",
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

    const checkedVariants = Array.from(document.querySelectorAll(".variant-filter:checked")).map(c => c.value);
    if (checkedVariants.length > 0) {
        listings = listings.filter(l => checkedVariants.includes(l.variant));
    }

    const setSearch = document.getElementById("setFilter")?.value.trim().toLowerCase();
    if (setSearch) {
        listings = listings.filter(l => (l.set_name || "").toLowerCase().includes(setSearch));
    }

    const sortValue = document.getElementById("sortSelect")?.value;
    if (sortValue === "price_asc") {
        listings = [...listings].sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortValue === "price_desc") {
        listings = [...listings].sort((a, b) => Number(b.price) - Number(a.price));
    }

    renderListings(listings);
}

function renderListings(listings) {

    container.innerHTML = "";

const resultsCount = document.getElementById("resultsCount");
const emptyState = document.getElementById("emptyState");

if (listings.length === 0) {

    if (resultsCount) resultsCount.textContent = "0 cartas encontradas";

    if (emptyState) {
        emptyState.style.display = "block";
    }

    return;
}

if (emptyState) {
    emptyState.style.display = "none";
}

    // Agrupa os anúncios por carta (mesmo jogo + mesma carta) — mostra-se um
    // resultado por carta, com o preço mais baixo e o número de vendedores,
    // tal como a Cardmarket. Clicar leva à lista de todos os vendedores dessa carta.
    const groups = {};

    listings.forEach(listing => {
        const key = `${listing.game}::${listing.card_id}`;

        if (!groups[key]) {
            groups[key] = {
                game: listing.game,
                card_id: listing.card_id,
                card_name: listing.card_name,
                card_image: listing.card_image,
                listings: [],
            };
        }

        groups[key].listings.push(listing);
    });

    const groupedCards = Object.values(groups);

    if (resultsCount) {
        resultsCount.textContent =
            groupedCards.length === 1
                ? "1 carta encontrada"
                : `${groupedCards.length} cartas encontradas`;
    }

    groupedCards.forEach(group => {

        const lowestPrice = Math.min(...group.listings.map(l => Number(l.price)));
        const sellerCount = new Set(group.listings.map(l => l.user_id)).size;

        const card = document.createElement("div");
        card.className = "listing-row-market";
        card.style.cursor = "pointer";

        card.innerHTML = `
            <img src="${group.card_image ?? ""}" class="listing-row-img">

            <div class="listing-row-name">
                <a href="carta.html?game=${group.game}&card_id=${encodeURIComponent(group.card_id)}">${escapeHtml(group.card_name)}</a>
            </div>

            <div class="listing-row-seller">
                <span>${sellerCount === 1 ? "1 vendedor" : `${sellerCount} vendedores`}</span>
            </div>

            <div class="listing-row-condition">${GAME_LABELS[group.game] ?? group.game}</div>

            <div class="listing-row-qty"></div>

            <div class="listing-row-price">
                <span style="display:block; font-size:11px; font-weight:400; color:var(--text-dim, #6F6961);">a partir de</span>
                ${lowestPrice.toFixed(2)} €
            </div>

            <span></span>
        `;

        card.addEventListener("click", () => {
            window.location.href = `carta.html?game=${group.game}&card_id=${encodeURIComponent(group.card_id)}`;
        });

        container.appendChild(card);

    });

}

document.getElementById("searchInput").addEventListener("input", applyFiltersAndRender);
document.getElementById("sortSelect")?.addEventListener("change", applyFiltersAndRender);
document.getElementById("setFilter")?.addEventListener("input", applyFiltersAndRender);
document.querySelectorAll(".condition-filter").forEach(cb => cb.addEventListener("change", applyFiltersAndRender));
document.querySelectorAll(".game-filter").forEach(cb => cb.addEventListener("change", applyFiltersAndRender));
document.querySelectorAll(".language-filter").forEach(cb => cb.addEventListener("change", applyFiltersAndRender));
document.querySelectorAll(".variant-filter").forEach(cb => cb.addEventListener("change", applyFiltersAndRender));

async function quickAddToCart(listingId, button) {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "...";

    try {
        const response = await fetch(`${API_BASE}/cart`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ listing_id: listingId, quantity: 1 }),
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Erro ao adicionar ao carrinho.");
            button.disabled = false;
            button.textContent = originalText;
            return;
        }

        button.textContent = "✓";
        setTimeout(() => {
            button.disabled = false;
            button.textContent = originalText;
        }, 1500);

    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
        button.disabled = false;
        button.textContent = originalText;
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
}

loadCards();