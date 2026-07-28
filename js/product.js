const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const container = document.getElementById("product");

async function loadProduct() {

    try {

        const response = await fetch(
            `https://api.pokemontcg.io/v2/cards/${id}`
        );

        const data = await response.json();

        const card = data.data;

        container.innerHTML = `
            <div class="product">

                <img src="${card.images.large}">

                <div class="info">

                    <h1>${card.name}</h1>

                    <p><strong>Set:</strong> ${card.set.name}</p>

                    <p><strong>HP:</strong> ${card.hp ?? "N/A"}</p>

                    <p><strong>Raridade:</strong> ${card.rarity ?? "Sem raridade"}</p>

                    <p><strong>Tipos:</strong> ${card.types ? card.types.join(", ") : "N/A"}</p>

                    <button class="buy">Comprar</button>

                </div>

            </div>
        `;

    } catch (error) {

        console.error(error);

    }

}

loadProduct();