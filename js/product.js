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

const LANGUAGE_LABELS = {
    PT: "Português", EN: "Inglês", ES: "Espanhol", FR: "Francês",
    DE: "Alemão", IT: "Italiano", JP: "Japonês", KO: "Coreano", ZH: "Chinês",
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

let buyerProfile = null;

async function loadTrendPrice(cardId, listingPrice) {
    const trendEl = document.getElementById("trendPriceInfo");
    if (!trendEl || !cardId) return;

    try {
        const response = await fetch(`${API_BASE}/listings/trend/${cardId}`);
        const data = await response.json();

        if (!response.ok || data.source === "none") {
            trendEl.textContent = "";
            return;
        }

        const label = data.source === "sales" ? "vendas recentes" : "outros anúncios ativos";
        let comparison = "";

        if (listingPrice) {
            const diff = ((listingPrice - data.avg_price) / data.avg_price) * 100;
            if (diff <= -10) comparison = ` — <span style="color:#4ADE80;">abaixo da média 👍</span>`;
            else if (diff >= 15) comparison = ` — <span style="color:#F87171;">acima da média</span>`;
        }

        trendEl.innerHTML = `💡 Preço de referência (${label}): <strong>${data.avg_price.toFixed(2)} €</strong>${comparison}`;

    } catch (error) {
        console.error(error);
    }
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
            buyerProfile = user;
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

            container.innerHTML = `
                <div class="product-unavailable">
                    <h1>Anúncio não encontrado</h1>
                    <p>
                        Este anúncio pode já ter sido vendido,
                        removido ou estar indisponível.
                    </p>
                </div>
            `;

            return;
        }

        const listing = await response.json();

        const cardImage =
            listing.card_image ||
            listing.real_photo_url ||
            "";

        const realPhoto =
            listing.real_photo_url || "";

        const condition =
            CONDITION_LABELS[listing.condition] ??
            listing.condition ??
            "Não especificada";

        const language =
            LANGUAGE_LABELS[listing.language] ??
            listing.language ??
            "Não especificado";

        const variant = listing.is_foil ? "Foil / Holo" : "Normal";

        const price =
            Number(listing.price).toFixed(2);

        const sellerName =
            listing.seller_name || "Vendedor";

        const sellerInitial =
            sellerName.charAt(0).toUpperCase();

        container.innerHTML = `

            <div class="product-breadcrumb">

                <a href="marketplace.html">
                    Marketplace
                </a>

                <span class="separator">›</span>

                <span>Pokémon</span>

                <span class="separator">›</span>

                <span>${listing.card_name}</span>

            </div>


            <div class="product-page">


                <!-- =====================================
                     LEFT SIDE
                     ===================================== -->

                <div class="product-main">

                    <section class="product-top">


                        <!-- IMAGE -->
                        <div class="product-gallery">

                            <div class="product-main-image-wrap">

                                <img
                                    id="mainProductImage"
                                    class="product-main-image"
                                    src="${cardImage}"
                                    alt="${listing.card_name}"
                                >

                            </div>


                            <div class="product-thumbnails">

                                <img
                                    class="product-thumbnail active"
                                    src="${cardImage}"
                                    data-image="${cardImage}"
                                    alt="${listing.card_name}"
                                >

                                ${
                                    realPhoto &&
                                    realPhoto !== cardImage
                                    ?
                                    `
                                    <img
                                        class="product-thumbnail"
                                        src="${realPhoto}"
                                        data-image="${realPhoto}"
                                        alt="Foto real da carta"
                                    >
                                    `
                                    :
                                    ""
                                }

                            </div>


                            ${
                                listing.real_photo_url
                                ?
                                `
                                <div class="real-photo-note">
                                    📷
                                    <span>
                                        Foto real da carta,
                                        tirada pelo vendedor.
                                    </span>
                                </div>
                                `
                                :
                                ""
                            }

                        </div>


                        <!-- INFO -->
                        <div class="product-info">

                            <span class="product-tag">
                                Pokémon
                            </span>


                            <h1>
                                ${listing.card_name}
                            </h1>


                            <div class="product-subtitle">

                                <span class="product-pill">
                                    Pokémon TCG
                                </span>

                                <span class="product-pill">
                                    Anúncio #${listing.id}
                                </span>

                            </div>


                            <div class="product-price">
                                ${price} €
                            </div>

                            <div class="product-price-label">
                                Preço por unidade
                            </div>


                            <span class="product-condition">
                                ${condition}
                            </span>


                            <div class="product-stock">

                                <span class="stock-dot"></span>

                                <span>
                                    Quantidade disponível:
                                    <strong>
                                        ${listing.quantity}
                                    </strong>
                                </span>

                            </div>


                            <!-- SELLER -->

                            <div class="seller-card">

                                <div class="seller-title">
                                    VENDEDOR
                                </div>


                                <div class="seller-content">

                                    <div class="seller-avatar">
                                        ${sellerInitial}
                                    </div>

                                    <div>

                                        <div class="seller-name">
                                            ${sellerName}
                                        </div>

                                        <div class="seller-country">
                                            Vendedor TCGMarketPortugal
                                        </div>

                                    </div>

                                </div>


                                <div class="seller-actions">

                                    <a
                                        href="perfil.html?id=${listing.user_id}"
                                    >
                                        Ver perfil
                                    </a>

                                    ${
                                        token
                                        ?
                                        `
                                        <button
                                            id="contactSellerBtn"
                                            type="button"
                                        >
                                            Mensagem
                                        </button>
                                        `
                                        :
                                        ""
                                    }

                                    ${
                                        token
                                        ?
                                        `
                                        <button
                                            id="wishlistBtn"
                                            type="button"
                                        >
                                            ❤️ Adicionar aos desejos
                                        </button>
                                        `
                                        :
                                        ""
                                    }

                                </div>

                            </div>


                            ${
                                listing.description
                                ?
                                `
                                <div class="product-description">
                                    ${listing.description}
                                </div>
                                `
                                :
                                ""
                            }

                        </div>

                    </section>


                    <!-- =====================================
                         BENEFITS
                         ===================================== -->

                    <section class="product-benefits">

                        <div class="benefit">

                            <div class="benefit-icon">
                                🛡️
                            </div>

                            <div>

                                <div class="benefit-title">
                                    Proteção ao comprador
                                </div>

                                <div class="benefit-text">
                                    Compra com segurança
                                    através do marketplace.
                                </div>

                            </div>

                        </div>


                        <div class="benefit">

                            <div class="benefit-icon">
                                📦
                            </div>

                            <div>

                                <div class="benefit-title">
                                    Envio
                                </div>

                                <div class="benefit-text">
                                    O vendedor prepara
                                    a encomenda após pagamento.
                                </div>

                            </div>

                        </div>


                        <div class="benefit">

                            <div class="benefit-icon">
                                ⭐
                            </div>

                            <div>

                                <div class="benefit-title">
                                    Comunidade
                                </div>

                                <div class="benefit-text">
                                    Avaliações ajudam a
                                    criar confiança.
                                </div>

                            </div>

                        </div>


                        <div class="benefit">

                            <div class="benefit-icon">
                                💬
                            </div>

                            <div>

                                <div class="benefit-title">
                                    Mensagens
                                </div>

                                <div class="benefit-text">
                                    Fala diretamente com
                                    o vendedor.
                                </div>

                            </div>

                        </div>

                    </section>


                    <!-- =====================================
                         DETAILS
                         ===================================== -->

                    <section class="product-details">

                        <div class="details-header">

                            <span class="details-tab active">
                                Detalhes
                            </span>

                        </div>


                        <div class="details-content">

                            <div class="detail-list">

                                <span class="detail-label">
                                    Jogo
                                </span>

                                <span class="detail-value">
                                    Pokémon
                                </span>


                                <span class="detail-label">
                                    Condição
                                </span>

                                <span class="detail-value">
                                    ${condition}
                                </span>


                                <span class="detail-label">
                                    Idioma
                                </span>

                                <span class="detail-value">
                                    ${language}
                                </span>


                                <span class="detail-label">
                                    Variante
                                </span>

                                <span class="detail-value">
                                    ${variant}
                                </span>


                                <span class="detail-label">
                                    Quantidade
                                </span>

                                <span class="detail-value">
                                    ${listing.quantity}
                                    unidade(s)
                                </span>


                                <span class="detail-label">
                                    Anúncio
                                </span>

                                <span class="detail-value">
                                    #${listing.id}
                                </span>

                            </div>


                            <div>

                                <h3 style="
                                    margin-top:0;
                                    margin-bottom:10px;
                                ">
                                    Sobre esta venda
                                </h3>

                                <p style="
                                    margin:0;
                                    color:#94a3b8;
                                    font-size:13px;
                                    line-height:1.7;
                                ">
                                    ${
                                        listing.description
                                        ||
                                        "O vendedor não adicionou uma descrição."
                                    }
                                </p>

                            </div>

                        </div>

                    </section>

                </div>


                <!-- =====================================
                     PURCHASE CARD
                     ===================================== -->

                <aside class="purchase-card">

                    <div class="purchase-inner">

                        <h2 class="purchase-title">

                            <span class="purchase-title-icon">
                                🛒
                            </span>

                            Comprar esta carta

                        </h2>


                        ${
                            listing.status !== "active" ||
                            listing.quantity < 1

                            ?

                            `
                            <div class="product-unavailable">

                                <h2>
                                    Indisponível
                                </h2>

                                <p>
                                    Este anúncio já não
                                    está disponível.
                                </p>

                            </div>
                            `

                            :

                            renderBuyArea(listing)
                        }

                    </div>

                </aside>

            </div>
        `;


        /* =========================================
           CONTACT SELLER
           ========================================= */

        document
            .getElementById("contactSellerBtn")
            ?.addEventListener(
                "click",
                () => contactSeller(listing)
            );


        /* =========================================
           WISHLIST
           ========================================= */

        document
            .getElementById("wishlistBtn")
            ?.addEventListener(
                "click",
                () => addToWishlist(listing)
            );


        /* =========================================
           IMAGE THUMBNAILS
           ========================================= */

        const mainImage =
            document.getElementById("mainProductImage");

        document
            .querySelectorAll(".product-thumbnail")
            .forEach(thumbnail => {

                thumbnail.addEventListener(
                    "click",
                    () => {

                        if (mainImage) {
                            mainImage.src =
                                thumbnail.dataset.image;
                        }

                        document
                            .querySelectorAll(".product-thumbnail")
                            .forEach(t =>
                                t.classList.remove("active")
                            );

                        thumbnail.classList.add("active");

                    }
                );

            });


        /* =========================================
           CART
           ========================================= */

        document
            .getElementById("addToCartBtn")
            ?.addEventListener(
                "click",
                () => addToCart(listing)
            );


        /* =========================================
           BUY FORM
           ========================================= */

        if (token) {

            const form =
                document.getElementById("buyForm");

            if (form) {

                form.addEventListener(
                    "submit",
                    (e) => submitOrder(e, listing)
                );


                const quantityInput =
                    document.getElementById("quantity");


                const minusBtn =
                    document.getElementById("quantityMinus");


                const plusBtn =
                    document.getElementById("quantityPlus");


                minusBtn?.addEventListener(
                    "click",
                    () => {

                        const current =
                            Number(quantityInput.value) || 1;

                        quantityInput.value =
                            Math.max(1, current - 1);

                        updatePriceBreakdown(listing);

                    }
                );


                plusBtn?.addEventListener(
                    "click",
                    () => {

                        const current =
                            Number(quantityInput.value) || 1;

                        quantityInput.value =
                            Math.min(
                                listing.quantity,
                                current + 1
                            );

                        updatePriceBreakdown(listing);

                    }
                );


                quantityInput?.addEventListener(
                    "input",
                    () => updatePriceBreakdown(listing)
                );


                updatePriceBreakdown(listing);

            }

        }

    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="product-unavailable">

                <h1>
                    Erro ao carregar o anúncio
                </h1>

                <p>
                    Não foi possível carregar
                    esta página.
                </p>

            </div>
        `;

    }

}

function renderBuyArea(listing) {

    if (
        listing.status !== "active" ||
        listing.quantity < 1
    ) {

        return `
            <div class="product-unavailable">

                <h2>
                    Indisponível
                </h2>

                <p>
                    Este anúncio já não está disponível.
                </p>

            </div>
        `;

    }


    if (!token) {

        return `
            <div class="product-unavailable">

                <h2>
                    Inicia sessão
                </h2>

                <p>
                    Precisas de iniciar sessão
                    para comprar esta carta.
                </p>

                <a
                    href="login.html"
                    class="btn-primary"
                    style="
                        display:block;
                        text-decoration:none;
                        margin-top:18px;
                    "
                >
                    Iniciar sessão
                </a>

            </div>
        `;

    }


    return `

        <!-- QUANTITY -->

        <label class="quantity-label">
            Quantidade
        </label>


        <div class="quantity-control">

            <button
                id="quantityMinus"
                type="button"
                aria-label="Diminuir quantidade"
            >
                −
            </button>


            <input
                type="number"
                id="quantity"
                min="1"
                max="${listing.quantity}"
                value="1"
                required
            >


            <button
                id="quantityPlus"
                type="button"
                aria-label="Aumentar quantidade"
            >
                +
            </button>

        </div>


        <!-- CART -->

        <div style="margin-top:14px;">

            <button
                id="addToCartBtn"
                type="button"
                class="btn-secondary"
            >
                🛒 Adicionar ao carrinho
            </button>

            <p id="cartMessage"></p>

        </div>


        <!-- CHECKOUT -->

        <form
            id="buyForm"
            class="checkout-form"
        >


            <!-- SHIPPING -->

            <div class="checkout-section">

                <h3 class="checkout-section-title">
                    📦 Morada de envio
                </h3>


                <div class="form-group">

                    <label for="shipName">
                        Nome de quem recebe
                    </label>

                    <input
                        type="text"
                        id="shipName"
                        value="${
                            buyerProfile?.address_name ||
                            buyerProfile?.name ||
                            ""
                        }"
                        required
                    >

                </div>


                <div class="form-group">

                    <label for="shipAddress">
                        Morada
                    </label>

                    <input
                        type="text"
                        id="shipAddress"
                        value="${
                            buyerProfile?.address_line ||
                            ""
                        }"
                        placeholder="Rua, número, andar"
                        required
                    >

                </div>


                <div class="checkout-grid">

                    <div class="form-group">

                        <label for="shipPostalCode">
                            Código postal
                        </label>

                        <input
                            type="text"
                            id="shipPostalCode"
                            value="${
                                buyerProfile?.address_postal_code ||
                                ""
                            }"
                            placeholder="0000-000"
                            required
                        >

                    </div>


                    <div class="form-group">

                        <label for="shipCity">
                            Localidade
                        </label>

                        <input
                            type="text"
                            id="shipCity"
                            value="${
                                buyerProfile?.address_city ||
                                ""
                            }"
                            placeholder="Ex: Porto"
                            required
                        >

                    </div>

                </div>


                <p style="
                    margin:10px 0 0;
                    color:#64748b;
                    font-size:11px;
                    line-height:1.5;
                ">
                    A morada é pré-preenchida
                    a partir do teu perfil.
                    Podes alterá-la apenas para esta compra.
                </p>

            </div>


            <!-- PAYMENT -->

            <div class="checkout-section">

                <h3 class="checkout-section-title">
                    💳 Método de pagamento
                </h3>


                <div class="payment-options">


                    <label class="payment-option">

                        <input
                            type="radio"
                            name="payment_method"
                            value="wallet"
                            checked
                        >

                        <span>
                            Carteira TCGMarketPortugal
                        </span>

                    </label>


                    <label class="payment-option">

                        <input
                            type="radio"
                            name="payment_method"
                            value="bank_transfer"
                        >

                        <span>
                            Transferência bancária
                        </span>

                    </label>


                    <label class="payment-option">

                        <input
                            type="radio"
                            name="payment_method"
                            value="stripe"
                        >

                        <span>
                            Cartão / MB WAY
                        </span>

                    </label>


                </div>

            </div>


            <!-- PRICE -->

            <div
                id="priceBreakdown"
                class="price-breakdown"
            ></div>


            <!-- BUY -->

            <button
                type="submit"
                class="btn-primary"
            >
                ⚡ Comprar agora
            </button>


            <p id="buyMessage"></p>

        </form>

    `;

}

function updatePriceBreakdown(listing) {

    const quantityInput =
        document.getElementById("quantity");

    if (!quantityInput) return;


    let quantity =
        Number(quantityInput.value) || 1;


    quantity = Math.max(
        1,
        Math.min(
            quantity,
            Number(listing.quantity)
        )
    );


    quantityInput.value = quantity;


    const basePrice =
        Number(listing.price) * quantity;


    const totalWeight =
        estimateWeight(quantity);


    const shippingCost =
        calcShipping(
            totalWeight,
            buyerCountry
        );


    const total =
        basePrice + shippingCost;


    const countryLabel =
        buyerCountry === "ES"
            ? "Espanha"
            : "Portugal";


    const priceBreakdown =
        document.getElementById(
            "priceBreakdown"
        );


    if (!priceBreakdown) return;


    priceBreakdown.innerHTML = `

        <div class="price-line">

            <span>
                Cartas × ${quantity}
            </span>

            <span>
                ${basePrice.toFixed(2)} €
            </span>

        </div>


        <div class="price-line">

            <span>
                Portes (${countryLabel})
            </span>

            <span>
                ${shippingCost.toFixed(2)} €
            </span>

        </div>


        <div class="price-total">

            <span>
                Total
            </span>

            <strong>
                ${total.toFixed(2)} €
            </strong>

        </div>


        <p style="
            margin:13px 0 0;
            color:#64748b;
            font-size:11px;
            line-height:1.5;
        ">
            Os portes são calculados de acordo
            com o país e peso estimado da encomenda.
        </p>

    `;

}

// Reutilizável: mostra um aviso com botão de reenviar, se o erro for de email por confirmar.
// Devolve true se tratou o erro (não precisas de mostrar mais nada), false caso contrário.
function showVerificationPrompt(container, data) {
    if (data.code !== "EMAIL_NOT_VERIFIED") return false;

    container.innerHTML = `Confirma o teu email antes de continuares. <button id="resendVerifyBtn" type="button">Reenviar email de confirmação</button>`;

    document.getElementById("resendVerifyBtn").addEventListener("click", async () => {
        const btn = document.getElementById("resendVerifyBtn");
        btn.disabled = true;
        btn.textContent = "A enviar...";

        try {
            const response = await fetch(`${API_BASE}/auth/resend-verification`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
            });
            const result = await response.json();
            container.textContent = response.ok ? "Email reenviado! Verifica a tua caixa de correio." : (result.error || "Erro ao reenviar.");
        } catch (error) {
            console.error(error);
            container.textContent = "Erro ao ligar ao servidor.";
        }
    });

    return true;
}

async function submitOrder(e, listing) {
    e.preventDefault();

    const quantity = document.getElementById("quantity").value;
    const payment_method = document.querySelector('input[name="payment_method"]:checked').value;
    const buyMessage = document.getElementById("buyMessage");

    const shipping = {
        name: document.getElementById("shipName").value.trim(),
        address_line: document.getElementById("shipAddress").value.trim(),
        postal_code: document.getElementById("shipPostalCode").value.trim(),
        city: document.getElementById("shipCity").value.trim(),
    };

    buyMessage.textContent = "A processar...";

    if (payment_method === "stripe") {
        try {
            const response = await fetch(`${API_BASE}/checkout/session`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ listing_id: listing.id, quantity, shipping }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (!showVerificationPrompt(buyMessage, data)) buyMessage.textContent = data.error || "Erro ao iniciar o pagamento.";
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
                shipping,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            if (!showVerificationPrompt(buyMessage, data)) buyMessage.textContent = data.error || "Erro ao processar a compra.";
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
            if (data.code === "EMAIL_NOT_VERIFIED") {
                if (confirm("Confirma o teu email antes de continuares. Queres que reenviemos o link de confirmação agora?")) {
                    await fetch(`${API_BASE}/auth/resend-verification`, {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${token}` },
                    });
                    alert("Email reenviado! Verifica a tua caixa de correio.");
                }
            } else {
                alert(data.error || "Erro ao iniciar conversa.");
            }
            return;
        }

        window.location.href = `mensagens.html?conversation=${data.id}`;

    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
    }
}

async function addToWishlist(listing) {
    try {
        const response = await fetch(`${API_BASE}/wishlist`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
                card_id: listing.card_id,
                card_name: listing.card_name,
                card_image: listing.card_image,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Erro ao adicionar à lista de desejos.");
            return;
        }

        alert(data.already_saved ? "Já tinhas esta carta na tua lista de desejos." : "Adicionada à tua lista de desejos! ❤️");

    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
    }
}

loadProduct();