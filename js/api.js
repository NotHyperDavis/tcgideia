// Cartas icónicas e valiosas do mundo dos TCG (fixas, não calculadas a partir dos
// teus anúncios) — usadas como recurso quando ainda não há "Melhores Ofertas"
// suficientes (normal numa fase inicial, sem histórico de vendas ainda).
const ICONIC_CARDS = [
    { game: "pokemon", search: "Charizard" },
    { game: "magic", search: "Black Lotus" },
    { game: "yugioh", search: "Blue-Eyes White Dragon" },
    { game: "onepiece", search: "Roronoa Zoro" },
];

async function getFeaturedCards() {

    const container = document.getElementById("featuredCards");
    const heading = document.getElementById("featuredHeading");
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/listings/deals`);
        const deals = await response.json();

        if (Array.isArray(deals) && deals.length > 0) {
            if (heading) heading.textContent = "🔥 Melhores Ofertas";
            displayDeals(deals);
            return;
        }

    } catch (error) {
        console.error(error);
    }

    // Sem ofertas suficientes ainda (normal numa fase inicial) — mostra cartas icónicas.
    if (heading) heading.textContent = "✨ Cartas Icónicas";
    await displayIconicCards();

}

function displayDeals(listings) {

    const container = document.getElementById("featuredCards");
    container.innerHTML = "";

    listings.forEach(listing => {
        const discount = Math.round((1 - listing.price / listing.trend_price) * 100);

        const el = document.createElement("div");
        el.className = "card";
        el.style.cursor = "pointer";
        el.innerHTML = `
            <img src="${listing.card_image ?? ""}">
            <h3>${listing.card_name}</h3>
            <p>${listing.seller_name}</p>
            <strong>${Number(listing.price).toFixed(2)} €</strong>
            <span style="color:#4ADE80; font-size:12px; display:block;">-${discount}% vs. preço médio</span>
        `;

        el.addEventListener("click", () => {
            window.location.href = `product.html?id=${listing.id}`;
        });

        container.appendChild(el);
    });

}

async function displayIconicCards() {

    const container = document.getElementById("featuredCards");

    try {
        const results = await Promise.all(
            ICONIC_CARDS.map(async ({ game, search }) => {
                try {
                    const response = await fetch(`${API_BASE}/cards?q=${encodeURIComponent(search)}&game=${game}`);
                    const cards = await response.json();
                    return Array.isArray(cards) && cards.length > 0 ? cards[0] : null;
                } catch {
                    return null;
                }
            })
        );

        const found = results.filter(Boolean);

        if (found.length === 0) {
            container.innerHTML = "<p>Não foi possível carregar as cartas em destaque.</p>";
            return;
        }

        container.innerHTML = "";

        found.forEach(card => {
            const el = document.createElement("div");
            el.className = "card";
            el.innerHTML = `
                <img src="${card.image ?? ""}">
                <h3>${card.name}</h3>
            `;
            container.appendChild(el);
        });

    } catch (error) {
        console.error(error);
    }

}

getFeaturedCards();

// A caixa de pesquisa antiga (#searchInput) já não existe em todas as páginas —
// esta parte só corre se ela existir mesmo, para não rebentar noutras páginas.
const input = document.getElementById("searchInput");

if (input) {
    let timeout;

    input.addEventListener("input", () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            if (input.value.trim().length < 2) {
                getFeaturedCards();
            }
        }, 400);
    });

    // Enter leva a sério ao marketplace, filtrado pelo que a pessoa escreveu.
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && input.value.trim().length >= 2) {
            window.location.href = `marketplace.html?q=${encodeURIComponent(input.value.trim())}`;
        }
    });
}