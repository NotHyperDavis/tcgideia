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

const params = new URLSearchParams(window.location.search);
const cardId = params.get("card_id");
const game = params.get("game");

const offersList = document.getElementById("offersList");
const emptyOffers = document.getElementById("emptyOffers");

async function loadOffers() {
    if (!cardId || !game) {
        offersList.innerHTML = "<p>Carta não indicada.</p>";
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/listings`);
        const allListings = await response.json();

        if (!response.ok) {
            offersList.innerHTML = "<p>Erro ao carregar os anúncios.</p>";
            return;
        }

        const offers = allListings
            .filter(l => l.card_id === cardId && l.game === game)
            .sort((a, b) => Number(a.price) - Number(b.price));

        renderHeader(offers);
        renderOffers(offers);

    } catch (error) {
        console.error(error);
        offersList.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

function renderHeader(offers) {
    const first = offers[0];

    document.getElementById("cardHeaderImage").src = first?.card_image ?? "";
    document.getElementById("cardHeaderName").textContent = first?.card_name ?? "Carta não encontrada";
    document.getElementById("cardHeaderCount").textContent =
        offers.length === 1 ? "1 vendedor disponível" : `${offers.length} vendedores disponíveis`;

    document.title = `${first?.card_name ?? "Carta"} - TCGMarketPortugal`;
}

function renderOffers(offers) {
    offersList.innerHTML = "";

    if (offers.length === 0) {
        emptyOffers.style.display = "block";
        return;
    }

    emptyOffers.style.display = "none";

    offers.forEach(listing => {
        const row = document.createElement("div");
        row.className = "listing-row-market";
        row.style.cursor = "pointer";

        row.innerHTML = `
            <img src="${listing.card_image ?? ""}" class="listing-row-img">

            <div class="listing-row-name">
                <a href="product.html?id=${listing.id}">${escapeHtml(listing.card_name)}${VARIANT_LABELS[listing.variant] ?? ""}</a>
            </div>

            <div class="listing-row-seller">
                <a href="perfil.html?id=${listing.user_id}">${escapeHtml(listing.seller_name)}</a>
                ${listing.seller_review_count > 0
                    ? `<span class="seller-stars">★ ${Number(listing.seller_rating).toFixed(1)}</span><span class="seller-review-count">(${listing.seller_review_count})</span>`
                    : `<span class="seller-stars seller-stars--new">Sem avaliações</span>`}
            </div>

            <div class="listing-row-condition">${CONDITION_LABELS[listing.condition] ?? listing.condition} · ${LANGUAGE_LABELS[listing.language] ?? listing.language}</div>

            <div class="listing-row-qty">x${listing.quantity}</div>

            <div class="listing-row-price">${Number(listing.price).toFixed(2)} €</div>

            <button class="listing-row-cart-btn" data-listing-id="${listing.id}" title="Adicionar ao carrinho rapidamente">🛒</button>
        `;

        row.addEventListener("click", (e) => {
            if (e.target.closest("a") || e.target.closest(".listing-row-cart-btn")) return;
            window.location.href = `product.html?id=${listing.id}`;
        });

        row.querySelector(".listing-row-cart-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            quickAddToCart(listing.id, e.currentTarget);
        });

        offersList.appendChild(row);
    });
}

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

loadOffers();