// Inclui este script em todas as páginas (marketplace, product, sell, etc.)
// Atualiza o link "Entrar" do header para mostrar o nome do utilizador + "Sair", se estiver logado.
// Também injeta o sino de notificações, o saldo da carteira e o carrinho —
// dentro do <nav>, se existir uma, ou como bolhas fixas no canto como recurso.

const NOTIF_API_BASE = "http://localhost:3000"; // troca pelo domínio real quando publicares o site

function updateAuthNav() {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");

    const loginLink = document.querySelector('nav a[href="login.html"]');
    const nav = loginLink ? loginLink.closest("nav") : null;

    if (token && userRaw && loginLink) {
        const user = JSON.parse(userRaw);

        loginLink.textContent = `Olá, ${user.name}`;
        loginLink.setAttribute("href", "profile.html");

        const logoutBtn = document.createElement("a");
        logoutBtn.href = "#";
        logoutBtn.textContent = "Sair";
        logoutBtn.id = "logoutBtn";

        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "marketplace.html";
        });

        loginLink.insertAdjacentElement("afterend", logoutBtn);
    }

    if (token) {
        setupNotificationBell(token, nav, loginLink);
        setupCartAndWallet(token, nav, loginLink);
    }
}

// Estilo comum a estas bolhas, tanto inline (dentro do nav) como fixas (páginas sem nav)
const PILL_STYLE = "background:#1A2333; border:1px solid #2D3B52; color:white; padding:6px 12px; border-radius:999px; text-decoration:none; font-size:13px; font-weight:600; white-space:nowrap;";

function setupCartAndWallet(token, nav, loginLink) {
    const walletPill = document.createElement("a");
    walletPill.href = "carteira.html";
    walletPill.id = "walletPill";
    walletPill.style.cssText = PILL_STYLE;
    walletPill.textContent = "💰 —";

    const cartPill = document.createElement("a");
    cartPill.href = "carrinho.html";
    cartPill.id = "cartPill";
    cartPill.style.cssText = PILL_STYLE;
    cartPill.textContent = "🛒 0";

    if (nav && loginLink) {
        // Insere dentro do próprio navbar, antes do "Olá, nome", para seguir o layout da página
        loginLink.insertAdjacentElement("beforebegin", cartPill);
        loginLink.insertAdjacentElement("beforebegin", walletPill);
    } else {
        // Páginas sem <nav> (ex: carteira.html, my-listings.html): fica fixo no canto,
        // um pouco abaixo do sino para não ficarem em cima um do outro.
        const wrapper = document.createElement("div");
        wrapper.id = "topBarExtras";
        wrapper.style.cssText = "position:fixed; top:10px; right:60px; display:flex; gap:10px; z-index:1000;";
        wrapper.appendChild(walletPill);
        wrapper.appendChild(cartPill);
        document.body.appendChild(wrapper);
    }

    updateCartAndWallet(token);
    setInterval(() => updateCartAndWallet(token), 30000);
}

async function updateCartAndWallet(token) {
    try {
        const walletResponse = await fetch(`${NOTIF_API_BASE}/wallet`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const wallet = await walletResponse.json();
        const walletPill = document.getElementById("walletPill");
        if (walletPill && walletResponse.ok) {
            walletPill.textContent = `💰 ${Number(wallet.balance).toFixed(2)} €`;
        }
    } catch (error) {
        console.error(error);
    }

    try {
        const cartResponse = await fetch(`${NOTIF_API_BASE}/cart`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const cart = await cartResponse.json();
        const cartPill = document.getElementById("cartPill");
        if (cartPill && cartResponse.ok) {
            const count = cart.items.reduce((sum, i) => sum + i.quantity, 0);
            cartPill.textContent = `🛒 ${count}`;
        }
    } catch (error) {
        console.error(error);
    }
}

function setupNotificationBell(token, nav, loginLink) {
    const bell = document.createElement("a");
    bell.href = "#";
    bell.id = "notificationBell";
    bell.style.cssText = "cursor:pointer; font-size:18px; position:relative; text-decoration:none;";
    bell.innerHTML = `🔔<span id="notifCount" style="display:none; background:red; color:white; border-radius:50%; font-size:11px; padding:1px 5px; position:absolute; top:-6px; right:-10px;"></span>`;

    const dropdown = document.createElement("div");
    dropdown.id = "notifDropdown";
    dropdown.style.cssText = "display:none; position:absolute; top:36px; right:0; background:white; color:black; border:1px solid #ccc; width:280px; max-height:400px; overflow-y:auto; z-index:1000; padding:8px; text-align:left;";

    if (nav && loginLink) {
        bell.style.position = "relative";
        bell.appendChild(dropdown);
        loginLink.insertAdjacentElement("beforebegin", bell);
    } else {
        bell.style.cssText += "position:fixed; top:10px; right:10px; z-index:1000;";
        dropdown.style.cssText = dropdown.style.cssText.replace("position:absolute", "position:fixed").replace("top:36px", "top:40px");
        document.body.appendChild(bell);
        document.body.appendChild(dropdown);
    }

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
            countEl.style.display = "inline";
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
            <a href="${n.link || '#'}" style="display:block; padding:6px 0; border-bottom:1px solid #eee; text-decoration:none; color:${n.is_read ? '#888' : 'black'}; font-weight:${n.is_read ? 'normal' : 'bold'};">
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