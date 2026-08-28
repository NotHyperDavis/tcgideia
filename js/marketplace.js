const API_BASE = "http://localhost:3000";

const container = document.getElementById("marketCards");

const CONDITION_LABELS = {
    mint: "Mint",
    near_mint: "Near Mint",
    excellent: "Excelente",
    good: "Boa",
    played: "Usada",
    poor: "Danificada"
};


async function loadCards() {

    try {

        const response =
            await fetch(`${API_BASE}/listings`);

        const listings =
            await response.json();


        container.innerHTML = "";


        if (listings.length === 0) {

            container.innerHTML =
                "<p>Ainda não há nenhuma carta à venda. Sê o primeiro a vender!</p>";

            return;
        }


        listings.forEach(listing => {

            container.innerHTML += `

                <div class="card">

                    <a
                        href="product.html?id=${listing.id}"
                        class="card-product-link"
                    >

                        <img
                            src="${listing.card_image ?? ""}"
                            alt="${listing.card_name}"
                        >

                        <h3>
                            ${listing.card_name}
                        </h3>

                    </a>


                    <a
                        href="profile.html?id=${listing.user_id}"
                        class="seller-link"
                    >
                        👤 ${listing.seller_name}
                    </a>


                    <span>
                        ${CONDITION_LABELS[listing.condition] ?? listing.condition}
                    </span>


                    <strong>
                        ${Number(listing.price).toFixed(2)} €
                    </strong>

                </div>

            `;

        });


    } catch (error) {

        console.error(error);

        container.innerHTML =
            "<p>Erro ao carregar os anúncios.</p>";

    }

}


loadCards();