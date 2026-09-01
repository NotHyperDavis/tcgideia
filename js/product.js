const params = new URLSearchParams(window.location.search);
const id = params.get("id");
const token = localStorage.getItem("token");

const container = document.getElementById("product");

let buyerCountry = "PT";

const CONDITION_LABELS = {
    mint: "Mint",
    near_mint: "Near Mint",
    excellent: "Excelente",
    good: "Boa",
    played: "Usada",
    poor: "Danificada",
};

function estimateWeight(quantity) {
    return 15 + quantity * 2;
}

function calcShipping(totalWeightGrams, country = "PT") {
    if (country === "ES") {
        if (totalWeightGrams <= 100) return 2.10;
        if (totalWeightGrams <= 500) return 3.90;
        return 7.80;
    }

    if (totalWeightGrams <= 20) return 1.15;
    if (totalWeightGrams <= 50) return 1.50;
    if (totalWeightGrams <= 100) return 1.80;
    if (totalWeightGrams <= 500) return 3.00;
    return 5.55;
}

async function loadBuyerCountry() {
    if (!token) return;
    try {
        const response = await fetch(`${API_BASE}/users/me`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        if (response.ok) {
            const user = await response.json();
            buyerCountry = user.country || "PT";
        }
    } catch (error) {
        console.error(error);
    }
}

async function loadProduct() {

    try {

        await loadBuyerCountry();

        const response = await fetch(`${API_BASE}/listings/${id}`);

        if (!response.ok) {
            container.innerHTML = "<p>Anúncio não encontrado (pode já ter sido vendido ou removido).</p>";
            return;
        }

        const listing = await response.json();

        container.innerHTML = `
            <div class="product">

                <img src="${listing.real_photo_url || listing.card_image || ""}">
                ${listing.real_photo_url ? `<p style="font-size:12px; color:var(--text-dim);">📷 Foto real da carta, tirada pelo vendedor</p>` : ""}

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
        document.getElementById("addToCartBtn")?.addEventListener("click", () => addToCart(listing));

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
        <div style="margin-bottom:16px;">
            <label for="cartQuantity">Quantidade</label>
            <input type="number" id="cartQuantity" min="1" max="${listing.quantity}" value="1" style="max-width:100px;">
            <button id="addToCartBtn" type="button">Adicionar ao carrinho</button>
            <p id="cartMessage" style="font-size:14px;"></p>
        </div>

        <h2 style="margin-top:24px;">Ou comprar já</h2>

        <form id="buyForm">

            <label for="quantity">Quantidade</label>
            <input type="number" id="quantity" min="1" max="${listing.quantity}" value="1" required>

            <fieldset>
                <legend>Método de pagamento</legend>

                <label>
                    <input type="radio" name="payment_method" value="wallet" checked>
                    Carteira do site
                </label>

                <label>
                    <input type="radio" name="payment_method" value="bank_transfer">
                    Transferência bancária
                </label>

                <label>
                    <input type="radio" name="payment_method" value="stripe">
                    Cartão de crédito/débito (Stripe)
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
    const totalWeight = estimateWeight(quantity);
    const shippingCost = calcShipping(totalWeight, buyerCountry);
    const total = basePrice + shippingCost;

    document.getElementById("priceBreakdown").innerHTML = `
        <p>
            Cartas: ${basePrice.toFixed(2)} €<br>
            Portes (${buyerCountry === "ES" ? "Espanha" : "Portugal"}): ${shippingCost.toFixed(2)} €<br>
            <strong>Total a pagar: ${total.toFixed(2)} €</strong>
        </p>
        <p style="font-size:12px; color:var(--text-dim);">
            Os portes dependem do país da tua conta. Podes mudar em <a href="profile.html">O Meu Perfil</a>.
        </p>
    `;
}

async function submitOrder(e, listing) {
    e.preventDefault();

    const quantity = document.getElementById("quantity").value;
    const payment_method = document.querySelector('input[name="payment_method"]:checked').value;
    const buyMessage = document.getElementById("buyMessage");

    buyMessage.textContent = "A processar...";

    if (payment_method === "stripe") {
        try {
            const response = await fetch(`${API_BASE}/checkout/session`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ listing_id: listing.id, quantity }),
            });

            const data = await response.json();

            if (!response.ok) {
                buyMessage.textContent = data.error || "Erro ao iniciar o pagamento.";
                return;
            }

            window.location.href = data.url;

        } catch (error) {
            console.error(error);
            buyMessage.textContent = "Erro ao ligar ao servidor.";
        }

        return;
    }

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

        if (payment_method === "wallet") {
            buyMessage.innerHTML = `
                Compra concluída e paga pela carteira! Total: <strong>${Number(data.total_price).toFixed(2)} €</strong>.<br>
                O vendedor já foi avisado para enviar. O valor só é repassado a ele depois de confirmares a receção.
                Vê o estado em <a href="encomendas.html">As Minhas Encomendas</a>.
            `;
        } else {
            buyMessage.innerHTML = `
                Compromisso registado! Total a transferir: <strong>${Number(data.total_price).toFixed(2)} €</strong>
                (cartas + ${Number(data.shipping_cost).toFixed(2)} € de portes).<br>
                Transfere esse valor para o IBAN do site (substitui este texto pelo teu IBAN real).<br>
                Assim que o site confirmar o pagamento, o vendedor é notificado para enviar a carta.
                Vê o estado em <a href="encomendas.html">As Minhas Encomendas</a>.
            `;
        }

    } catch (error) {
        console.error(error);
        buyMessage.textContent = "Erro ao ligar ao servidor.";
    }
}

async function addToCart(listing) {
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const quantity = document.getElementById("cartQuantity").value;
    const cartMessage = document.getElementById("cartMessage");
    cartMessage.textContent = "A adicionar...";

    try {
        const response = await fetch(`${API_BASE}/cart`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ listing_id: listing.id, quantity }),
        });

        const data = await response.json();

        if (!response.ok) {
            cartMessage.textContent = data.error || "Erro ao adicionar ao carrinho.";
            return;
        }

        cartMessage.innerHTML = `Adicionado! <a href="carrinho.html">Ver carrinho</a>`;

    } catch (error) {
        console.error(error);
        cartMessage.textContent = "Erro ao ligar ao servidor.";
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