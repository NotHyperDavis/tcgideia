const API_BASE = "http://localhost:3000"; // troca pelo domínio real quando publicares o site

const container = document.getElementById("marketCards");

const CONDITION_LABELS = {
    mint: "Mint",
    near_mint: "Near Mint",
    excellent: "Excelente",
    good: "Boa",
    played: "Usada",
    poor: "Danificada",
};

async function loadCards() {

    const response = await fetch(`${API_BASE}/listings`);
    const listings = await response.json();

    container.innerHTML = "";

    if (listings.length === 0) {
        container.innerHTML = "<p>Ainda não há nenhuma carta à venda. Sê o primeiro a vender!</p>";
        return;
    }

    listings.forEach(listing => {

        container.innerHTML += `

        <a href="product.html?id=${listing.id}" class="card">

        <img src="${listing.card_image ?? ""}">

        <h3>${listing.card_name}</h3>

        <p>${listing.seller_name}</p>

        <span>${CONDITION_LABELS[listing.condition] ?? listing.condition}</span>

        <strong>${Number(listing.price).toFixed(2)} €</strong>

        </a>
    `;

    });

}

loadCards();