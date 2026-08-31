// Inclui este script em todas as páginas (marketplace, product, sell, etc.)
// Atualiza o link "Entrar" do header para mostrar o nome do utilizador + "Sair", se estiver logado.
// Também injeta o sino de notificações, o saldo da carteira e o carrinho —
// agrupados dentro do <nav>, se existir uma, ou como bolhas fixas no canto como recurso.

const NOTIF_API_BASE = "http://localhost:3000"; // troca pelo domínio real quando publicares o site

function updateAuthNav() {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");

    const loginLink = document.querySelector('nav a[href="login.html"]');
    const nav = loginLink ? loginLink.closest("nav") : null;

    if (!token) return;

    // --- Grupo do meio: sino + carrinho + carteira ---
    const utilityGroup = document.createElement("div");
    utilityGroup.className = "nav-utility-group";

    const bell = buildNotificationBell(token, !!nav);
    const cartPill = buildPill("cartPill", "carrinho.html", "🛒", "0");
    const walletPill = buildPill("walletPill", "carteira.html", "💰", "—");

    utilityGroup.appendChild(cartPill);
    utilityGroup.appendChild(walletPill);
    utilityGroup.appendChild(bell);

    if (nav && loginLink) {
        // Insere já aqui, enquanto o loginLink ainda está no sítio original do nav
        loginLink.insertAdjacentElement("beforebegin", utilityGroup);
    } else {
        const wrapper = document.createElement("div");
        wrapper.id = "topBarExtras";
        wrapper.appendChild(utilityGroup);
        document.body.appendChild(wrapper);
    }

    // --- Grupo da direita: avatar + nome + sair ---
    if (userRaw && loginLink) {
        const user = JSON.parse(userRaw);

        const userGroup = document.createElement("div");
        userGroup.className = "nav-user-group";

        const avatar = document.createElement("span");
        avatar.className = "nav-avatar";
        avatar.textContent = user.name.charAt(0).toUpperCase();

        loginLink.textContent = user.name;
        loginLink.setAttribute("href", "profile.html");
        loginLink.className = "nav-user-name";

        const logoutBtn = document.createElement("a");
        logoutBtn.href = "#";
        logoutBtn.textContent = "Sair";
        logoutBtn.id = "logoutBtn";
        logoutBtn.className = "nav-logout";

        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "marketplace.html";
        });

        userGroup.appendChild(avatar);
        userGroup.appendChild(logoutBtn);

        // Insere o grupo (ainda sem o loginLink lá dentro) mesmo antes do loginLink,
        // enquanto este ainda está no seu sítio original — só depois de userGroup já
        // estar mesmo na página é que é seguro mover o loginLink para dentro dele.
        loginLink.insertAdjacentElement("beforebegin", userGroup);
        userGroup.insertBefore(loginLink, logoutBtn);
    }

    updateCartAndWallet(token);
    setInterval(() => updateCartAndWallet(token), 30000);
}

function buildPill(id, href, icon, initialValue) {
    const pill = document.createElement("a");
    pill.href = href;
    pill.id = id;
    pill.className = "nav-pill";
    pill.innerHTML = `<span class="nav-pill-icon">${icon}</span><span class="nav-pill-value">${initialValue}</span>`;
    return pill;
}

async function updateCartAndWallet(token) {
    try {
        const walletResponse = await fetch(`${NOTIF_API_BASE}/wallet`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const wallet = await walletResponse.json();
        const walletValue = document.querySelector("#walletPill .nav-pill-value");
        if (walletValue && walletResponse.ok) {
            walletValue.textContent = `${Number(wallet.balance).toFixed(2)} €`;
        }
    } catch (error) {
        console.error(error);
    }

    try {
        const cartResponse = await fetch(`${NOTIF_API_BASE}/cart`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const cart = await cartResponse.json();
        const cartValue = document.querySelector("#cartPill .nav-pill-value");
        if (cartValue && cartResponse.ok) {
            const count = cart.items.reduce((sum, i) => sum + i.quantity, 0);
            cartValue.textContent = count;
        }
    } catch (error) {
        console.error(error);
    }
}

function buildNotificationBell(token, insideNav) {
    const bell = document.createElement("div");
    bell.id = "notificationBell";
    bell.className = "nav-bell";
    bell.innerHTML = `🔔<span id="notifCount" class="nav-bell-badge" style="display:none;"></span>`;

    const dropdown = document.createElement("div");
    dropdown.id = "notifDropdown";
    dropdown.className = insideNav ? "nav-dropdown-panel" : "nav-dropdown-panel nav-dropdown-panel--fixed";

    bell.appendChild(dropdown);

    bell.addEventListener("click", async (e) => {
        e.preventDefault();
        const isOpen = dropdown.style.display === "block";
        dropdown.style.display = isOpen ? "none" : "block";

        if (!isOpen) {
            await loadNotifications(token, dropdown);
            await markAllRead(token);
            updateUnreadCount(token);
        }
    });

    updateUnreadCount(token);
    setInterval(() => updateUnreadCount(token), 30000); // atualiza a cada 30s

    return bell;
}

async function updateUnreadCount(token) {
    try {
        const response = await fetch(`${NOTIF_API_BASE}/notifications/unread-count`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await response.json();
        const countEl = document.getElementById("notifCount");

        if (data.count > 0) {
            countEl.textContent = data.count;
            countEl.style.display = "flex";
        } else {
            countEl.style.display = "none";
        }
    } catch (error) {
        console.error(error);
    }
}

async function loadNotifications(token, dropdown) {
    dropdown.innerHTML = "<p>A carregar...</p>";

    try {
        const response = await fetch(`${NOTIF_API_BASE}/notifications`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const notifications = await response.json();

        if (notifications.length === 0) {
            dropdown.innerHTML = "<p>Sem notificações.</p>";
            return;
        }

        dropdown.innerHTML = notifications.map(n => `
            <a href="${n.link || '#'}" class="nav-dropdown-item" style="font-weight:${n.is_read ? 'normal' : '700'}; opacity:${n.is_read ? '0.6' : '1'};">
                ${n.content}
                <br><small>${new Date(n.created_at).toLocaleString("pt-PT")}</small>
            </a>
        `).join("");

    } catch (error) {
        console.error(error);
        dropdown.innerHTML = "<p>Erro ao carregar notificações.</p>";
    }
}

async function markAllRead(token) {
    try {
        await fetch(`${NOTIF_API_BASE}/notifications/read-all`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` },
        });
    } catch (error) {
        console.error(error);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateAuthNav);
} else {
    updateAuthNav();
}