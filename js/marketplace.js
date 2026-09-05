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

if (resultsCount) {
    resultsCount.textContent =
        listings.length === 1
            ? "1 carta encontrada"
            : `${listings.length} cartas encontradas`;
}

if (listings.length === 0) {

    if (emptyState) {
        emptyState.style.display = "block";
    }

    return;
}

if (emptyState) {
    emptyState.style.display = "none";
}

    listings.forEach(listing => {

        const card = document.createElement("div");
        card.className = "card";
        card.style.cursor = "pointer";

        card.innerHTML = `
            <img src="${listing.card_image ?? ""}">
            <h3>${listing.card_name}</h3>
            <p>
                <a href="perfil.html?id=${listing.user_id}" class="seller-link">${listing.seller_name}</a>
                ${listing.seller_review_count > 0 ? `<span style="font-size:12px; color:var(--gold, #B88A3B);">★ ${Number(listing.seller_rating).toFixed(1)} (${listing.seller_review_count})</span>` : `<span style="font-size:12px; color:var(--text-dim);">Sem avaliações</span>`}
            </p>
            <span>${GAME_LABELS[listing.game] ?? listing.game} · ${CONDITION_LABELS[listing.condition] ?? listing.condition} · ${LANGUAGE_LABELS[listing.language] ?? listing.language}${VARIANT_LABELS[listing.variant] ?? ""}</span>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                <strong>${Number(listing.price).toFixed(2)} €</strong>
                <button class="quick-buy-btn" data-listing-id="${listing.id}" title="Adicionar ao carrinho rapidamente" style="background:var(--accent); color:#fff; border:none; border-radius:8px; padding:6px 10px; cursor:pointer; font-size:16px; line-height:1;">🛒</button>
            </div>
        `;

        card.addEventListener("click", (e) => {
            if (e.target.closest(".seller-link") || e.target.closest(".quick-buy-btn")) return;
            window.location.href = `product.html?id=${listing.id}`;
        });

        card.querySelector(".quick-buy-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            quickAddToCart(listing.id, e.currentTarget);
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

loadCards();