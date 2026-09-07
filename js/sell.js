// =========================================================
// SELL.JS — TCGMarketPortugal
// =========================================================


// =========================================================
// EMAIL VERIFICATION
// =========================================================

function showVerificationPrompt(container, data) {
    if (data.code !== "EMAIL_NOT_VERIFIED") return false;

    container.innerHTML = `
        <span>
            Confirma o teu email antes de continuares.
        </span>

        <button
            id="resendVerifyBtn"
            type="button"
        >
            Reenviar email de confirmação
        </button>
    `;

    container.className = "sell-message error";

    document
        .getElementById("resendVerifyBtn")
        .addEventListener("click", async () => {

            const btn = document.getElementById("resendVerifyBtn");

            btn.disabled = true;
            btn.textContent = "A enviar...";

            try {

                const response = await fetch(
                    `${API_BASE}/auth/resend-verification`,
                    {
                        method: "POST",
                        headers: {
                            "Authorization":
                                `Bearer ${localStorage.getItem("token")}`
                        }
                    }
                );

                const result = await response.json();

                if (response.ok) {

                    container.textContent =
                        "Email reenviado! Verifica a tua caixa de correio.";

                    container.className =
                        "sell-message success";

                } else {

                    container.textContent =
                        result.error || "Erro ao reenviar.";

                    container.className =
                        "sell-message error";
                }

            } catch (error) {

                console.error(error);

                container.textContent =
                    "Erro ao ligar ao servidor.";

                container.className =
                    "sell-message error";
            }
        });

    return true;
}


// =========================================================
// ELEMENTOS
// =========================================================

const loginWarning =
    document.getElementById("loginWarning");

const sellFlow =
    document.getElementById("sellFlow");

const results =
    document.getElementById("results");

const listingForm =
    document.getElementById("listingForm");

const selectedCardPreview =
    document.getElementById("selectedCardPreview");

const message =
    document.getElementById("message");

const searchInput =
    document.getElementById("searchCard");

const searchButton =
    document.getElementById("searchBtn");

const realPhotoInput =
    document.getElementById("realPhoto");

const realPhotoPreview =
    document.getElementById("realPhotoPreview");


// =========================================================
// STATE
// =========================================================

let selectedCard = null;


// =========================================================
// TOKEN
// =========================================================

function getToken() {
    return localStorage.getItem("token");
}


// =========================================================
// IMAGE UPLOAD
// =========================================================

async function uploadImage(file) {

    const formData = new FormData();

    formData.append("image", file);

    const response = await fetch(
        `${API_BASE}/upload`,
        {
            method: "POST",

            headers: {
                "Authorization":
                    `Bearer ${getToken()}`
            },

            body: formData
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error ||
            "Erro ao enviar a imagem."
        );
    }

    return data.url;
}


// =========================================================
// PHOTO PREVIEW
// =========================================================

realPhotoInput?.addEventListener(
    "change",
    (event) => {

        const file =
            event.target.files?.[0];

        if (!file) {

            realPhotoPreview.innerHTML = `
                <span>
                    Nenhuma fotografia selecionada
                </span>
            `;

            return;
        }

        const imageUrl =
            URL.createObjectURL(file);

        realPhotoPreview.innerHTML = `
            <img
                src="${imageUrl}"
                alt="Pré-visualização da fotografia"
            >
        `;
    }
);


// =========================================================
// AUTHENTICATION
// =========================================================

function checkAuthentication() {

    const token = getToken();

    if (!token) {

        loginWarning.style.display = "flex";
        sellFlow.style.display = "none";

        return false;
    }

    loginWarning.style.display = "none";
    sellFlow.style.display = "block";

    return true;
}

checkAuthentication();


// =========================================================
// SEARCH CARD
// =========================================================

async function searchCard() {

    const search =
        searchInput?.value.trim();

    if (!search) {

        results.innerHTML = `
            <p class="search-feedback">
                Escreve o nome de uma carta.
            </p>
        `;

        return;
    }

    if (search.length < 2) {

        results.innerHTML = `
            <p class="search-feedback">
                Escreve pelo menos 2 letras para pesquisar.
            </p>
        `;

        return;
    }


    // Estado de loading

    results.innerHTML = `
        <div class="search-loading">
            <span class="loading-spinner"></span>

            <span>
                A pesquisar cartas...
            </span>
        </div>
    `;


    try {

        const game =
            document.getElementById("gameSelect")?.value
            || "pokemon";


        const response = await fetch(
            `${API_BASE}/cards?q=${encodeURIComponent(search)}&game=${game}`
        );


        const cards =
            await response.json();


        if (!response.ok) {

            throw new Error(
                cards.error ||
                "Erro ao pesquisar cartas."
            );
        }


        if (!cards || cards.length === 0) {

            results.innerHTML = `
                <div class="search-empty">

                    <div class="search-empty-icon">
                        🃏
                    </div>

                    <strong>
                        Nenhuma carta encontrada
                    </strong>

                    <p>
                        Tenta outro nome ou verifica a pesquisa.
                    </p>

                </div>
            `;

            return;
        }


        results.innerHTML = "";


        cards.forEach(card => {

            const imageUrl =
                card.image || "";


            const element =
                document.createElement("div");

            element.className =
                "card";


            element.innerHTML = `
                <img
                    src="${imageUrl}"
                    alt="${escapeHtml(card.name || "Carta")}"
                    loading="lazy"
                >

                <h3>
                    ${escapeHtml(card.name || "Carta")}
                </h3>

                ${
                    card.set_name
                        ? `
                            <small>
                                ${escapeHtml(card.set_name)}
                            </small>
                        `
                        : ""
                }
            `;


            element.addEventListener(
                "click",
                () => selectCard(
                    card,
                    imageUrl
                )
            );


            results.appendChild(element);
        });


    } catch (error) {

        console.error(error);

        results.innerHTML = `
            <div class="search-empty">

                <div class="search-empty-icon">
                    ⚠️
                </div>

                <strong>
                    Não foi possível pesquisar
                </strong>

                <p>
                    Verifica a ligação ao servidor e tenta novamente.
                </p>

            </div>
        `;
    }
}


// =========================================================
// SEARCH BUTTON
// =========================================================
//
// O HTML já chama searchCard() com onclick.
// Por isso NÃO adicionamos outro listener ao botão.
// Evitamos a pesquisa duplicada.
//

if (searchButton) {
    searchButton.removeAttribute("onclick");

    searchButton.addEventListener(
        "click",
        searchCard
    );
}


// =========================================================
// ENTER TO SEARCH
// =========================================================

searchInput?.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {

            event.preventDefault();

            searchCard();
        }
    }
);


// =========================================================
// SELECT CARD
// =========================================================

function selectCard(card, imageUrl) {

    selectedCard = {
        ...card,
        resolvedImage: imageUrl
    };


    // Mostrar carta selecionada

    selectedCardPreview.innerHTML = `

        <img
            src="${imageUrl}"
            alt="${escapeHtml(card.name || "Carta")}"
        >

        <div class="selected-card-info">

            <span class="selected-card-label">
                CARTA SELECIONADA
            </span>

            <p class="selected-card-name">
                ${escapeHtml(card.name || "Carta")}
            </p>

            ${
                card.set_name
                    ? `
                        <p class="selected-card-set">
                            Expansão:
                            <strong>
                                ${escapeHtml(card.set_name)}
                            </strong>
                        </p>
                    `
                    : ""
            }

            <p
                id="trendPriceInfo"
                class="trend-price-info"
            >
                A verificar preço de referência...
            </p>

        </div>
    `;


    // Limpar resultados

    results.innerHTML = "";


    // Colocar nome da carta na pesquisa

    if (searchInput) {
        searchInput.value =
            card.name || "";
    }


    // Mostrar formulário

    listingForm.style.display =
        "block";


    // Remover estado vazio

    const emptyState =
        document.querySelector(
            ".no-card-selected"
        );

    if (emptyState) {
        emptyState.style.display =
            "none";
    }


    // Ir para o formulário

    setTimeout(() => {

        listingForm.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }, 100);


    // Buscar preço de referência

    loadTrendPrice(card.id);
}


// =========================================================
// TREND PRICE
// =========================================================

async function loadTrendPrice(cardId) {

    const trendElement =
        document.getElementById(
            "trendPriceInfo"
        );

    if (!trendElement) return;


    try {

        const response = await fetch(
            `${API_BASE}/listings/trend/${encodeURIComponent(cardId)}`
        );


        const data =
            await response.json();


        if (
            !response.ok ||
            data.source === "none"
        ) {

            trendElement.innerHTML = `
                <span class="trend-no-data">
                    💡 Ainda não existem dados de preço
                    suficientes para esta carta.
                </span>
            `;

            return;
        }


        const label =
            data.source === "sales"
                ? "vendas recentes"
                : "anúncios ativos";


        const sampleText =
            data.sample_size === 1
                ? "amostra"
                : "amostras";


        trendElement.innerHTML = `

            <span>
                💡 Preço de referência
                (${label})
            </span>

            <strong>
                ${Number(data.avg_price).toFixed(2)} €
            </strong>

            <small>
                ${data.sample_size} ${sampleText}
                · entre
                ${Number(data.min_price).toFixed(2)} €
                e
                ${Number(data.max_price).toFixed(2)} €
            </small>
        `;


    } catch (error) {

        console.error(
            "Erro ao carregar preço:",
            error
        );

        trendElement.innerHTML = `
            <span>
                💡 Preço de referência indisponível.
            </span>
        `;
    }
}


// =========================================================
// SUBMIT LISTING
// =========================================================

listingForm?.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        // -------------------------------------------------
        // Carta
        // -------------------------------------------------

        if (!selectedCard) {

            showMessage(
                "Escolhe primeiro uma carta na pesquisa.",
                "error"
            );

            return;
        }


        // -------------------------------------------------
        // Dados
        // -------------------------------------------------

        const price =
            document.getElementById("price")
                ?.value;

        const condition =
            document.getElementById("condition")
                ?.value;

        const quantity =
            document.getElementById("quantity")
                ?.value;

        const description =
            document.getElementById("description")
                ?.value.trim();


        const language =
            document.getElementById("language")
                ?.value || "EN";


        const variant =
            document.getElementById("variantSelect")
                ?.value || "normal";


        const shippingService =
            document.getElementById(
                "shippingServiceSelect"
            )?.value || "azul";


        // -------------------------------------------------
        // Validação básica
        // -------------------------------------------------

        if (
            !price ||
            Number(price) <= 0
        ) {

            showMessage(
                "Indica um preço válido.",
                "error"
            );

            return;
        }


        if (
            !quantity ||
            Number(quantity) < 1
        ) {

            showMessage(
                "Indica uma quantidade válida.",
                "error"
            );

            return;
        }


        // -------------------------------------------------
        // Estado
        // -------------------------------------------------

        showMessage(
            "A preparar o anúncio...",
            ""
        );


        try {

            // -------------------------------------------------
            // Upload da fotografia
            // -------------------------------------------------

            let realPhotoUrl = null;

            const photoFile =
                realPhotoInput
                    ?.files?.[0];


            if (photoFile) {

                showMessage(
                    "A enviar fotografia...",
                    ""
                );


                realPhotoUrl =
                    await uploadImage(
                        photoFile
                    );
            }


            // -------------------------------------------------
            // Criar anúncio
            // -------------------------------------------------

            showMessage(
                "A publicar anúncio...",
                ""
            );


            const response =
                await fetch(
                    `${API_BASE}/listings`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Authorization":
                                `Bearer ${getToken()}`
                        },

                        body: JSON.stringify({

                            card_id:
                                selectedCard.id,

                            card_name:
                                selectedCard.name,

                            card_image:
                                selectedCard.resolvedImage,

                            game:
                                document
                                    .getElementById(
                                        "gameSelect"
                                    )
                                    ?.value
                                || "pokemon",

                            set_name:
                                selectedCard.set_name
                                || null,

                            price:
                                Number(price),

                            condition,

                            quantity:
                                Number(quantity),

                            description:
                                description || null,

                            real_photo_url:
                                realPhotoUrl,

                            language,

                            variant,

                            shipping_service:
                                shippingService
                        })
                    }
                );


            const data =
                await response.json();


            // -------------------------------------------------
            // Erro
            // -------------------------------------------------

            if (!response.ok) {

                if (
                    !showVerificationPrompt(
                        message,
                        data
                    )
                ) {

                    showMessage(
                        data.error ||
                        "Erro ao publicar anúncio.",
                        "error"
                    );
                }

                return;
            }


            // -------------------------------------------------
            // Sucesso
            // -------------------------------------------------

            showMessage(
                "✓ Anúncio publicado! A redirecionar para o marketplace...",
                "success"
            );


            setTimeout(() => {

                window.location.href =
                    "marketplace.html";

            }, 1200);


        } catch (error) {

            console.error(error);

            showMessage(
                error.message ||
                "Erro ao ligar ao servidor.",
                "error"
            );
        }
    }
);


// =========================================================
// MESSAGE HELPER
// =========================================================

function showMessage(text, type = "") {

    if (!message) return;

    message.textContent = text;

    message.className =
        type
            ? `sell-message ${type}`
            : "sell-message";
}


// =========================================================
// ESCAPE HTML
// =========================================================

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}