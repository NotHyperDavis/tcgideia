document.addEventListener("DOMContentLoaded", () => {

    const API_BASE = window.API_BASE || "http://localhost:3000";

    const searchInput = document.getElementById("searchInput");
    const clearSearch = document.getElementById("clearSearch");

    const marketCards = document.getElementById("marketCards");
    const resultsCount = document.getElementById("resultsCount");

    const loading = document.getElementById("marketplaceLoading");
    const empty = document.getElementById("marketplaceEmpty");

    const sortSelect = document.getElementById("sortSelect");

    const clearFiltersButton =
        document.getElementById("clearFilters");

    const emptyClearFilters =
        document.getElementById("emptyClearFilters");

    const activeFilters =
        document.getElementById("activeFilters");

    const mobileFilterButton =
        document.getElementById("mobileFilterButton");

    const filtersPanel =
        document.getElementById("filtersPanel");

    const minPriceInput =
        document.getElementById("minPrice");

    const maxPriceInput =
        document.getElementById("maxPrice");

    const gameTabs =
        document.querySelectorAll(".game-tab");

    let allListings = [];
    let groupedCards = [];

    let currentGame = "all";


    /* =====================================================
       LABELS
       ===================================================== */

    const GAME_LABELS = {
        pokemon: "Pokémon",
        onepiece: "One Piece",
        yugioh: "Yu-Gi-Oh!",
        magic: "Magic"
    };


    const CONDITION_LABELS = {
        mint: "Mint",
        near_mint: "Near Mint",
        excellent: "Excellent",
        good: "Good",
        played: "Played",
        poor: "Poor"
    };


    const LANGUAGE_LABELS = {
        EN: "Inglês",
        PT: "Português",
        JP: "Japonês",
        ES: "Espanhol",
        FR: "Francês",
        DE: "Alemão"
    };


    /* =====================================================
       HELPERS
       ===================================================== */

    function escapeHtml(value) {

        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function formatPrice(value) {

        return Number(value || 0).toLocaleString("pt-PT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + " €";
    }


    function getSelectedValues(name) {

        return Array.from(
            document.querySelectorAll(
                `input[name="${name}"]:checked`
            )
        ).map(input => input.value);

    }


    /* =====================================================
       LOAD LISTINGS
       ===================================================== */

    async function loadListings() {

        loading.hidden = false;
        marketCards.innerHTML = "";
        empty.hidden = true;

        try {

            const response = await fetch(
                `${API_BASE}/listings`
            );

            if (!response.ok) {
                throw new Error(
                    `Erro ${response.status}`
                );
            }

            const data = await response.json();

            allListings = Array.isArray(data)
                ? data
                : (data.listings || []);

            groupListings();

            render();

        } catch (error) {

            console.error(
                "Erro ao carregar marketplace:",
                error
            );

            marketCards.innerHTML = `
                <div class="marketplace-empty">
                    <div class="empty-icon">⚠️</div>

                    <h2>Não foi possível carregar o Marketplace</h2>

                    <p>
                        Verifica se o servidor está a correr
                        e tenta novamente.
                    </p>

                    <button
                        type="button"
                        class="primary-marketplace-button"
                        onclick="location.reload()"
                    >
                        Tentar novamente
                    </button>
                </div>
            `;

            resultsCount.textContent = "0";

        } finally {

            loading.hidden = true;
        }
    }


    /* =====================================================
       GROUP LISTINGS BY CARD
       ===================================================== */

    function groupListings() {

        const groups = new Map();

        allListings.forEach(listing => {

            if (!listing) {
                return;
            }

            if (
                listing.status &&
                listing.status !== "active"
            ) {
                return;
            }

            if (
                listing.quantity !== undefined &&
                Number(listing.quantity) <= 0
            ) {
                return;
            }

            const cardId = String(
                listing.card_id || ""
            );

            if (!cardId) {
                return;
            }

            if (!groups.has(cardId)) {

                groups.set(cardId, {
                    card_id: cardId,

                    card_name:
                        listing.card_name ||
                        "Carta sem nome",

                    card_image:
                        listing.card_image ||
                        "",

                    game:
                        listing.game ||
                        "pokemon",

                    listings: []
                });
            }

            groups.get(cardId).listings.push(listing);
        });

        groupedCards = Array.from(groups.values());
    }


    /* =====================================================
       FILTER
       ===================================================== */

    function getFilteredCards() {

        const search =
            searchInput.value
                .trim()
                .toLowerCase();

        const selectedConditions =
            getSelectedValues("condition");

        const selectedLanguages =
            getSelectedValues("language");

        const minPrice =
            minPriceInput.value !== ""
                ? Number(minPriceInput.value)
                : null;

        const maxPrice =
            maxPriceInput.value !== ""
                ? Number(maxPriceInput.value)
                : null;

        const minSellers =
            Number(
                document.querySelector(
                    'input[name="sellerCount"]:checked'
                )?.value || 1
            );


        let filtered = groupedCards
            .map(card => {

                let offers = [...card.listings];


                /* GAME */

                if (
                    currentGame !== "all" &&
                    card.game !== currentGame
                ) {
                    return null;
                }


                /* SEARCH */

                if (
                    search &&
                    !card.card_name
                        .toLowerCase()
                        .includes(search)
                ) {
                    return null;
                }


                /* CONDITION */

                if (selectedConditions.length > 0) {

                    offers = offers.filter(listing =>
                        selectedConditions.includes(
                            String(listing.condition || "")
                        )
                    );
                }


                /* LANGUAGE */

                if (selectedLanguages.length > 0) {

                    offers = offers.filter(listing =>
                        selectedLanguages.includes(
                            String(listing.language || "")
                                .toUpperCase()
                        )
                    );
                }


                /* PRICE */

                offers = offers.filter(listing => {

                    const price =
                        Number(listing.price || 0);

                    if (
                        minPrice !== null &&
                        price < minPrice
                    ) {
                        return false;
                    }

                    if (
                        maxPrice !== null &&
                        price > maxPrice
                    ) {
                        return false;
                    }

                    return true;
                });


                /* SELLERS */

                const sellerIds = new Set(
                    offers.map(listing =>
                        listing.user_id ||
                        listing.seller_id ||
                        listing.id
                    )
                );

                if (
                    sellerIds.size < minSellers
                ) {
                    return null;
                }


                if (offers.length === 0) {
                    return null;
                }


                const prices = offers.map(
                    listing =>
                        Number(listing.price || 0)
                );


                return {
                    ...card,

                    listings: offers,

                    sellerCount: sellerIds.size,

                    minPrice:
                        Math.min(...prices)
                };

            })
            .filter(Boolean);


        return sortCards(filtered);
    }


    /* =====================================================
       SORT
       ===================================================== */

    function sortCards(cards) {

        const sort = sortSelect.value;

        return cards.sort((a, b) => {

            if (sort === "price_asc") {
                return a.minPrice - b.minPrice;
            }

            if (sort === "price_desc") {
                return b.minPrice - a.minPrice;
            }

            if (sort === "sellers_desc") {
                return b.sellerCount - a.sellerCount;
            }

            if (sort === "name_asc") {
                return a.card_name.localeCompare(
                    b.card_name,
                    "pt"
                );
            }

            return 0;
        });
    }


    /* =====================================================
       RENDER
       ===================================================== */

    function render() {

        const cards = getFilteredCards();

        resultsCount.textContent =
            cards.length.toLocaleString("pt-PT");


        renderActiveFilters();


        if (cards.length === 0) {

            marketCards.innerHTML = "";

            empty.hidden = false;

            return;
        }


        empty.hidden = true;


        marketCards.innerHTML =
            cards.map(renderCard).join("");
    }


    /* =====================================================
       CARD
       ===================================================== */

    function renderCard(card) {

        const gameLabel =
            GAME_LABELS[card.game] ||
            card.game ||
            "TCG";


        const sellerText =
            card.sellerCount === 1
                ? "1 vendedor"
                : `${card.sellerCount} vendedores`;


        const image =
            card.card_image ||
            "";


        const cardId =
            encodeURIComponent(card.card_id);


        const game =
            encodeURIComponent(card.game);


        return `
            <article
                class="market-card-row"
                data-card-id="${escapeHtml(card.card_id)}"
                onclick="openCard('${cardId}', '${game}')"
            >

                <div class="market-card-image-wrap">

                    <img
                        class="market-card-image"
                        src="${escapeHtml(image)}"
                        alt="${escapeHtml(card.card_name)}"
                        loading="lazy"
                        onerror="this.style.opacity='0.25'"
                    >

                </div>


                <div class="market-card-info">

                    <span class="market-card-game">
                        ${escapeHtml(gameLabel)}
                    </span>

                    <h2 class="market-card-name">
                        ${escapeHtml(card.card_name)}
                    </h2>

                    <div class="market-card-meta">

                        <span>
                            ${escapeHtml(sellerText)}
                        </span>

                        <span class="market-card-meta-dot">
                            •
                        </span>

                        <span>
                            Melhor oferta disponível
                        </span>

                    </div>

                </div>


                <div class="market-card-sellers">

                    <strong class="sellers-number">
                        ${escapeHtml(String(card.sellerCount))}
                    </strong>

                    <span class="sellers-label">
                        ${card.sellerCount === 1
                            ? "vendedor disponível"
                            : "vendedores disponíveis"
                        }
                    </span>

                </div>


                <div class="market-card-price">

                    <span class="price-label">
                        Desde
                    </span>

                    <strong class="price-value">
                        ${formatPrice(card.minPrice)}
                    </strong>

                    <span class="price-action">
                        Ver ofertas →
                    </span>

                </div>

            </article>
        `;
    }


    /* =====================================================
       OPEN CARD PAGE
       ===================================================== */

    window.openCard = function(cardId, game) {

        window.location.href =
            `carta.html?card_id=${cardId}&game=${game}`;
    };


    /* =====================================================
       ACTIVE FILTERS
       ===================================================== */

    function renderActiveFilters() {

        const chips = [];


        if (currentGame !== "all") {

            chips.push(`
                <div class="active-filter">

                    ${escapeHtml(
                        GAME_LABELS[currentGame] ||
                        currentGame
                    )}

                    <button
                        type="button"
                        data-remove-game
                    >
                        ×
                    </button>

                </div>
            `);
        }


        getSelectedValues("condition")
            .forEach(value => {

                chips.push(`
                    <div class="active-filter">

                        ${escapeHtml(
                            CONDITION_LABELS[value] ||
                            value
                        )}

                        <button
                            type="button"
                            data-remove-condition="${escapeHtml(value)}"
                        >
                            ×
                        </button>

                    </div>
                `);
            });


        getSelectedValues("language")
            .forEach(value => {

                chips.push(`
                    <div class="active-filter">

                        ${escapeHtml(
                            LANGUAGE_LABELS[value] ||
                            value
                        )}

                        <button
                            type="button"
                            data-remove-language="${escapeHtml(value)}"
                        >
                            ×
                        </button>

                    </div>
                `);
            });


        if (minPriceInput.value !== "") {

            chips.push(`
                <div class="active-filter">

                    Desde ${escapeHtml(
                        minPriceInput.value
                    )} €

                    <button
                        type="button"
                        data-remove-min-price
                    >
                        ×
                    </button>

                </div>
            `);
        }


        if (maxPriceInput.value !== "") {

            chips.push(`
                <div class="active-filter">

                    Até ${escapeHtml(
                        maxPriceInput.value
                    )} €

                    <button
                        type="button"
                        data-remove-max-price
                    >
                        ×
                    </button>

                </div>
            `);
        }


        if (chips.length === 0) {

            activeFilters.hidden = true;
            activeFilters.innerHTML = "";

            return;
        }


        activeFilters.hidden = false;

        activeFilters.innerHTML =
            chips.join("");
    }


    /* =====================================================
       EVENTS
       ===================================================== */

    searchInput.addEventListener(
        "input",
        () => {

            clearSearch.hidden =
                searchInput.value.trim() === "";

            render();
        }
    );


    clearSearch.addEventListener(
        "click",
        () => {

            searchInput.value = "";

            clearSearch.hidden = true;

            render();

            searchInput.focus();
        }
    );


    sortSelect.addEventListener(
        "change",
        render
    );


    document
        .querySelectorAll(
            'input[name="condition"], input[name="language"], input[name="sellerCount"]'
        )
        .forEach(input => {

            input.addEventListener(
                "change",
                render
            );
        });


    minPriceInput.addEventListener(
        "input",
        render
    );


    maxPriceInput.addEventListener(
        "input",
        render
    );


    gameTabs.forEach(tab => {

        tab.addEventListener(
            "click",
            () => {

                gameTabs.forEach(
                    button =>
                        button.classList.remove("active")
                );

                tab.classList.add("active");

                currentGame =
                    tab.dataset.game;

                render();
            }
        );
    });


    /* CLEAR FILTERS */

    function clearFilters() {

        searchInput.value = "";

        clearSearch.hidden = true;

        currentGame = "all";


        gameTabs.forEach(tab => {

            tab.classList.toggle(
                "active",
                tab.dataset.game === "all"
            );
        });


        document
            .querySelectorAll(
                'input[name="condition"], input[name="language"]'
            )
            .forEach(input => {
                input.checked = false;
            });


        const sellerAny =
            document.querySelector(
                'input[name="sellerCount"][value="1"]'
            );

        if (sellerAny) {
            sellerAny.checked = true;
        }


        minPriceInput.value = "";
        maxPriceInput.value = "";


        render();
    }


    clearFiltersButton.addEventListener(
        "click",
        clearFilters
    );


    emptyClearFilters.addEventListener(
        "click",
        clearFilters
    );


    /* ACTIVE FILTER REMOVE */

    activeFilters.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest("button");

            if (!button) {
                return;
            }


            if (
                button.hasAttribute("data-remove-game")
            ) {

                currentGame = "all";

                gameTabs.forEach(tab => {

                    tab.classList.toggle(
                        "active",
                        tab.dataset.game === "all"
                    );
                });
            }


            const condition =
                button.dataset.removeCondition;

            if (condition) {

                const input =
                    document.querySelector(
                        `input[name="condition"][value="${CSS.escape(condition)}"]`
                    );

                if (input) {
                    input.checked = false;
                }
            }


            const language =
                button.dataset.removeLanguage;

            if (language) {

                const input =
                    document.querySelector(
                        `input[name="language"][value="${CSS.escape(language)}"]`
                    );

                if (input) {
                    input.checked = false;
                }
            }


            if (
                button.hasAttribute(
                    "data-remove-min-price"
                )
            ) {
                minPriceInput.value = "";
            }


            if (
                button.hasAttribute(
                    "data-remove-max-price"
                )
            ) {
                maxPriceInput.value = "";
            }


            render();
        }
    );


    /* MOBILE FILTER */

    mobileFilterButton.addEventListener(
        "click",
        () => {

            filtersPanel.classList.toggle(
                "mobile-open"
            );
        }
    );


    /* =====================================================
       START
       ===================================================== */

    loadListings();

});