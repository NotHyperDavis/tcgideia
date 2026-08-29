const API_BASE = "http://localhost:3000"; // troca pelo domínio real quando publicares o site
const COMMISSION_RATE = 0.08; // tem de bater certo com o COMMISSION_RATE do .env do servidor

const params = new URLSearchParams(window.location.search);
const id = params.get("id");
const token = localStorage.getItem("token");

const container = document.getElementById("product");

const CONDITION_LABELS = {
    mint: "Mint",
    near_mint: "Near Mint",
    excellent: "Excelente",
    good: "Boa",
    played: "Usada",
    poor: "Danificada",
};

// Tem de refletir exatamente a função calcShipping() do server/routes/orders.js
function calcShipping(totalWeightGrams) {
    if (totalWeightGrams <= 20) return 1.15;
    if (totalWeightGrams <= 50) return 1.50;
    if (totalWeightGrams <= 100) return 1.80;
    if (totalWeightGrams <= 500) return 3.00;
    return 5.55; // até 2kg
}

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

                    <p><strong>Preço:</strong> ${Number(listing.price).toFixed(2)} € / unidade</p>

                    <p><strong>Vendedor:</strong> <a href="perfil.html?id=${listing.user_id}">${listing.seller_name}</a>
                        ${token ? `<button id="contactSellerBtn" type="button">Contactar vendedor</button>` : ""}
                    </p>

                    <p><strong>Condição:</strong> ${CONDITION_LABELS[listing.condition] ?? listing.condition}</p>

                    <p><strong>Quantidade disponível:</strong> ${listing.quantity}</p>

                    ${listing.description ? `<p><strong>Descrição:</strong> ${listing.description}</p>` : ""}

                    ${renderBuyArea(listing)}

                </div>

            </div>
        `;

        document.getElementById("contactSellerBtn")?.addEventListener("click", () => contactSeller(listing));

        if (token) {
            const form = document.getElementById("buyForm");
            if (form) {
                form.addEventListener("submit", (e) => submitOrder(e, listing));

                const quantityInput = document.getElementById("quantity");
                quantityInput.addEventListener("input", () => updatePriceBreakdown(listing));
                updatePriceBreakdown(listing);
            }
        }

    } catch (error) {

        console.error(error);
        container.innerHTML = "<p>Erro ao carregar o anúncio.</p>";

    }

}

function renderBuyArea(listing) {

    if (listing.status !== "active" || listing.quantity < 1) {
        return `<p><em>Este anúncio já não está disponível.</em></p>`;
    }

    if (!token) {
        return `<p>Precisas de <a href="login.html">iniciar sessão</a> para comprares.</p>`;
    }

    return `
        <form id="buyForm">

            <label for="quantity">Quantidade</label>
            <input type="number" id="quantity" min="1" max="${listing.quantity}" value="1" required>

            <fieldset>
                <legend>Método de pagamento</legend>

                <label>
                    <input type="radio" name="payment_method" value="bank_transfer" checked>
                    Transferência bancária
                </label>

                <label>
                    <input type="radio" name="payment_method" value="stripe" disabled>
                    Cartão (Stripe) — brevemente
                </label>

                <label>
                    <input type="radio" name="payment_method" value="instant" disabled>
                    Pagamento instantâneo — brevemente
                </label>
            </fieldset>

            <div id="priceBreakdown"></div>

            <button type="submit">Comprometer-me a comprar</button>

        </form>

        <p id="buyMessage"></p>
    `;
}

function updatePriceBreakdown(listing) {
    const quantity = Number(document.getElementById("quantity").value) || 1;
    const basePrice = listing.price * quantity;
    const totalWeight = listing.weight_grams * quantity;
    const shippingCost = calcShipping(totalWeight);
    const platformFee = basePrice * COMMISSION_RATE;
    const total = basePrice + shippingCost + platformFee;

    document.getElementById("priceBreakdown").innerHTML = `
        <p>
            Cartas: ${basePrice.toFixed(2)} €<br>
            Portes (${totalWeight}g): ${shippingCost.toFixed(2)} €<br>
            Taxa de serviço: ${platformFee.toFixed(2)} €<br>
            <strong>Total a pagar: ${total.toFixed(2)} €</strong>
        </p>
    `;
}

async function submitOrder(e, listing) {
    e.preventDefault();

    const quantity = document.getElementById("quantity").value;
    const payment_method = document.querySelector('input[name="payment_method"]:checked').value;
    const buyMessage = document.getElementById("buyMessage");

    buyMessage.textContent = "A processar...";

    try {
        const response = await fetch(`${API_BASE}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
                listing_id: listing.id,
                quantity,
                payment_method,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            buyMessage.textContent = data.error || "Erro ao processar a compra.";
            return;
        }

        buyMessage.innerHTML = `
            Compromisso registado! Total a transferir: <strong>${Number(data.total_price).toFixed(2)} €</strong>
            (cartas + ${Number(data.shipping_cost).toFixed(2)} € de portes + ${Number(data.platform_fee).toFixed(2)} € de taxa).<br>
            Transfere esse valor para o IBAN do site (substitui este texto pelo teu IBAN real).<br>
            Assim que o site confirmar o pagamento, o vendedor é notificado para enviar a carta.
            Vê o estado em <a href="encomendas.html">As Minhas Encomendas</a>.
        `;

    } catch (error) {
        console.error(error);
        buyMessage.textContent = "Erro ao ligar ao servidor.";
    }
}

async function contactSeller(listing) {
    try {
        const response = await fetch(`${API_BASE}/conversations`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
                other_user_id: listing.user_id,
                listing_id: listing.id,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Erro ao iniciar conversa.");
            return;
        }

        window.location.href = `mensagens.html?conversation=${data.id}`;

    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
    }
}

loadProduct();