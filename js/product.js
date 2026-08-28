const API_BASE = "http://localhost:3000"; // troca pelo domínio real quando publicares o site

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const container = document.getElementById("product");

const CONDITION_LABELS = {
    mint: "Mint",
    near_mint: "Near Mint",
    excellent: "Excelente",
    good: "Boa",
    played: "Usada",
    poor: "Danificada",
};

async function loadProduct() {

    try {

        const response = await fetch(`${API_BASE}/listings/${id}`);

        if (!response.ok) {
            container.innerHTML = "<p>Anúncio não encontrado (pode já ter sido vendido ou removido).</p>";
            return;
        }

        const listing = await response.json();

        container.innerHTML = `
            <div class="product">

                <img src="${listing.card_image ?? ""}">

                <div class="info">

                    <h1>${listing.card_name}</h1>

                    <p><strong>Preço:</strong> ${Number(listing.price).toFixed(2)} €</p>

                    <p><strong>Vendedor:</strong> ${listing.seller_name}</p>

                    <p><strong>Condição:</strong> ${CONDITION_LABELS[listing.condition] ?? listing.condition}</p>

                    <p><strong>Quantidade disponível:</strong> ${listing.quantity}</p>

                    ${listing.description ? `<p><strong>Descrição:</strong> ${listing.description}</p>` : ""}

                    <button class="buy">Comprar</button>

                </div>

            </div>
        `;

    } catch (error) {

        console.error(error);
        container.innerHTML = "<p>Erro ao carregar o anúncio.</p>";

    }

}

loadProduct();