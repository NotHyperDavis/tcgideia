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

        const card = document.createElement("div");
        card.className = "card";
        card.style.cursor = "pointer";

        card.innerHTML = `
            <img src="${listing.card_image ?? ""}">
            <h3>${listing.card_name}</h3>
            <p><a href="perfil.html?id=${listing.user_id}" class="seller-link">${listing.seller_name}</a></p>
            <span>${CONDITION_LABELS[listing.condition] ?? listing.condition}</span>
            <strong>${Number(listing.price).toFixed(2)} €</strong>
        `;

        // Clicar no cartão vai para o produto, mas clicar no nome do vendedor vai para o perfil dele.
        card.addEventListener("click", (e) => {
            if (e.target.closest(".seller-link")) return;
            window.location.href = `product.html?id=${listing.id}`;
        });

        container.appendChild(card);

    });

}

loadCards();