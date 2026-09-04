// =========================================================
// TCGMARKETPORTUGAL — AUTH NAV
// =========================================================

function updateAuthNav() {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");

    const loginLink = document.querySelector(
        'nav a[href="login.html"]'
    );

    const nav = loginLink
        ? loginLink.closest("nav")
        : document.querySelector("nav");

    // Evita duplicar elementos se a função correr novamente
    document
        .querySelectorAll(".nav-utility-group, .nav-user-group, #topBarExtras")
        .forEach(el => el.remove());

    // -----------------------------------------------------
    // SEM SESSÃO
    // -----------------------------------------------------

    if (!token) {
        setupMobileNavToggle();
        return;
    }

    // -----------------------------------------------------
    // UTILIDADES
    // -----------------------------------------------------

    const utilityGroup = document.createElement("div");
    utilityGroup.className = "nav-utility-group";

    const cartPill = buildPill(
        "cartPill",
        "carrinho.html",
        "🛒",
        "0"
    );

    const walletPill = buildPill(
        "walletPill",
        "carteira.html",
        "€",
        "—"
    );

    const bell = buildNotificationBell(
        token,
        !!nav
    );

    utilityGroup.appendChild(cartPill);
    utilityGroup.appendChild(walletPill);
    utilityGroup.appendChild(bell);

    // -----------------------------------------------------
    // UTILIZADOR
    // -----------------------------------------------------

    if (userRaw && loginLink) {
        let user;

        try {
            user = JSON.parse(userRaw);
        } catch (error) {
            console.error(
                "Erro ao ler os dados do utilizador:",
                error
            );

            localStorage.removeItem("user");

            setupMobileNavToggle();
            return;
        }

        const userGroup = document.createElement("div");
        userGroup.className = "nav-user-group";

        // Avatar
        const avatar = document.createElement("span");
        avatar.className = "nav-avatar";

        const userName = user.name || "Utilizador";

        avatar.textContent = userName
            .charAt(0)
            .toUpperCase();

        // Nome
        loginLink.textContent = userName;
        loginLink.href = "profile.html";
        loginLink.className = "nav-user-name";

        // Logout
        const logoutBtn = document.createElement("a");

        logoutBtn.href = "#";
        logoutBtn.textContent = "Sair";
        logoutBtn.id = "logoutBtn";
        logoutBtn.className = "nav-logout";

        logoutBtn.addEventListener("click", function (event) {
            event.preventDefault();

            localStorage.removeItem("token");
            localStorage.removeItem("user");

            // Vai para a homepage
            window.location.href = "main.html";
        });

        userGroup.appendChild(avatar);
        userGroup.appendChild(loginLink);
        userGroup.appendChild(logoutBtn);

        // Adiciona utilizador no final da navbar
        nav.appendChild(userGroup);

        // Utilidades antes do utilizador
        nav.insertBefore(
            utilityGroup,
            userGroup
        );
    } else if (nav) {
        // Caso exista token mas não exista informação
        // do utilizador
        nav.appendChild(utilityGroup);
    } else {
        // Fallback para páginas sem navbar
        const wrapper = document.createElement("div");

        wrapper.id = "topBarExtras";
        wrapper.appendChild(utilityGroup);

        document.body.appendChild(wrapper);
    }

    // Atualizar carrinho e carteira
    updateCartAndWallet(token);

    // Atualização periódica
    setInterval(() => {
        updateCartAndWallet(token);
    }, 30000);

    setupMobileNavToggle();
}


// =========================================================
// PILLS
// =========================================================

function buildPill(id, href, icon, initialValue) {

    const pill = document.createElement("a");

    pill.href = href;
    pill.id = id;
    pill.className = "nav-pill";

    pill.innerHTML = `
        <span class="nav-pill-icon">
            ${icon}
        </span>

        <span class="nav-pill-value">
            ${initialValue}
        </span>
    `;

    return pill;
}


// =========================================================
// CARTEIRA + CARRINHO
// =========================================================

async function updateCartAndWallet(token) {

    // -------------------------------
    // WALLET
    // -------------------------------

    try {

        const response = await fetch(
            `${API_BASE}/wallet`,
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            return;
        }

        const wallet = await response.json();

        const walletValue =
            document.querySelector(
                "#walletPill .nav-pill-value"
            );

        if (walletValue) {

            const balance =
                Number(wallet.balance);

            walletValue.textContent =
                `${balance.toFixed(2)} €`;
        }

    } catch (error) {

        console.error(
            "Erro ao carregar carteira:",
            error
        );
    }


    // -------------------------------
    // CARRINHO
    // -------------------------------

    try {

        const response = await fetch(
            `${API_BASE}/cart`,
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            return;
        }

        const cart = await response.json();

        const cartValue =
            document.querySelector(
                "#cartPill .nav-pill-value"
            );

        if (cartValue) {

            const items =
                Array.isArray(cart.items)
                    ? cart.items
                    : [];

            const count =
                items.reduce(
                    (sum, item) =>
                        sum + Number(item.quantity || 0),
                    0
                );

            cartValue.textContent = count;
        }

    } catch (error) {

        console.error(
            "Erro ao carregar carrinho:",
            error
        );
    }
}


// =========================================================
// NOTIFICAÇÕES
// =========================================================

function buildNotificationBell(
    token,
    insideNav
) {

    const bell = document.createElement("div");

    bell.id = "notificationBell";
    bell.className = "nav-bell";

    bell.innerHTML = `
        <span class="nav-bell-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z"/>
                <path d="M9.5 17.5a2.5 2.5 0 0 0 5 0"/>
            </svg>
        </span>

        <span
            id="notifCount"
            class="nav-bell-badge"
            style="display:none;"
        ></span>
    `;

    const dropdown =
        document.createElement("div");

    dropdown.id = "notifDropdown";

    dropdown.className =
        insideNav
            ? "nav-dropdown-panel"
            : "nav-dropdown-panel nav-dropdown-panel--fixed";

    bell.appendChild(dropdown);


    bell.addEventListener(
        "click",
        async function (event) {

            // Se clicou numa notificação,
            // deixa o link funcionar normalmente
            if (
                event.target.closest(
                    ".nav-dropdown-item"
                )
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            const isOpen =
                dropdown.classList.contains(
                    "is-open"
                );

            if (isOpen) {

                dropdown.classList.remove(
                    "is-open"
                );

                return;
            }

            dropdown.classList.add(
                "is-open"
            );

            await loadNotifications(
                token,
                dropdown
            );

            await markAllRead(token);

            updateUnreadCount(token);
        }
    );


    updateUnreadCount(token);

    setInterval(() => {
        updateUnreadCount(token);
    }, 30000);


    return bell;
}


// =========================================================
// CONTADOR DE NOTIFICAÇÕES
// =========================================================

async function updateUnreadCount(token) {

    try {

        const response = await fetch(
            `${API_BASE}/notifications/unread-count`,
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        const countEl =
            document.getElementById(
                "notifCount"
            );

        if (!countEl) {
            return;
        }

        const count =
            Number(data.count || 0);

        if (count > 0) {

            countEl.textContent =
                count > 99
                    ? "99+"
                    : count;

            countEl.style.display =
                "flex";

        } else {

            countEl.style.display =
                "none";
        }

    } catch (error) {

        console.error(
            "Erro ao carregar notificações:",
            error
        );
    }
}


// =========================================================
// CARREGAR NOTIFICAÇÕES
// =========================================================

async function loadNotifications(
    token,
    dropdown
) {

    dropdown.innerHTML = `
        <div class="nav-dropdown-loading">
            A carregar...
        </div>
    `;

    try {

        const response = await fetch(
            `${API_BASE}/notifications`,
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {

            dropdown.innerHTML = `
                <div class="nav-dropdown-empty">
                    Não foi possível carregar as notificações.
                </div>
            `;

            return;
        }

        const notifications =
            await response.json();

        if (
            !Array.isArray(notifications) ||
            notifications.length === 0
        ) {

            dropdown.innerHTML = `
                <div class="nav-dropdown-empty">
                    <strong>Sem notificações</strong>
                    <span>
                        Não tens novas notificações.
                    </span>
                </div>
            `;

            return;
        }

        dropdown.innerHTML =
            notifications
                .map(notification => {

                    const unread =
                        !notification.is_read;

                    const date =
                        new Date(
                            notification.created_at
                        ).toLocaleString(
                            "pt-PT"
                        );

                    return `
                        <a
                            href="${escapeAttribute(
                                notification.link || "#"
                            )}"
                            class="nav-dropdown-item ${
                                unread
                                    ? "is-unread"
                                    : ""
                            }"
                        >

                            <span>
                                ${escapeHtml(
                                    notification.content || ""
                                )}
                            </span>

                            <small>
                                ${date}
                            </small>

                        </a>
                    `;
                })
                .join("");

    } catch (error) {

        console.error(
            "Erro ao carregar notificações:",
            error
        );

        dropdown.innerHTML = `
            <div class="nav-dropdown-empty">
                Ocorreu um erro ao carregar.
            </div>
        `;
    }
}


// =========================================================
// MARCAR COMO LIDAS
// =========================================================

async function markAllRead(token) {

    try {

        await fetch(
            `${API_BASE}/notifications/read-all`,
            {
                method: "PATCH",

                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

    } catch (error) {

        console.error(
            "Erro ao marcar notificações como lidas:",
            error
        );
    }
}


// =========================================================
// MOBILE NAV
// =========================================================

function setupMobileNavToggle() {

    const navbar =
        document.querySelector(
            ".navbar"
        );

    if (!navbar) {
        return;
    }

    let toggle =
        navbar.querySelector(
            ".navbar-toggle"
        );

    if (toggle) {
        return;
    }

    toggle =
        document.createElement("button");

    toggle.className =
        "navbar-toggle";

    toggle.type = "button";

    toggle.setAttribute(
        "aria-label",
        "Abrir menu"
    );

    toggle.setAttribute(
        "aria-expanded",
        "false"
    );

    toggle.textContent = "☰";


    toggle.addEventListener(
        "click",
        function () {

            const isOpen =
                navbar.classList.toggle(
                    "nav-open"
                );

            toggle.textContent =
                isOpen
                    ? "✕"
                    : "☰";

            toggle.setAttribute(
                "aria-expanded",
                isOpen
                    ? "true"
                    : "false"
            );
        }
    );


    navbar.appendChild(toggle);
}


// =========================================================
// SEGURANÇA
// =========================================================

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeAttribute(value) {

    return escapeHtml(value)
        .replaceAll("`", "&#096;");
}


// =========================================================
// START
// =========================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        updateAuthNav
    );

} else {

    updateAuthNav();
}