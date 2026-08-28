const API_BASE = "http://localhost:3000"; // troca pelo domínio real quando publicares o site

const token = localStorage.getItem("token");

const loginWarning = document.getElementById("loginWarning");
const messagesLayout = document.getElementById("messagesLayout");
const conversationList = document.getElementById("conversationList");
const conversationView = document.getElementById("conversationView");

if (!token) {
    loginWarning.style.display = "block";
    messagesLayout.style.display = "none";
} else {
    init();
}

async function init() {
    await loadConversations();

    // Se chegámos aqui a partir de um botão "Contactar vendedor" (ver product.js),
    // abre logo essa conversa.
    const params = new URLSearchParams(window.location.search);
    const conversationId = params.get("conversation");
    if (conversationId) {
        openConversation(conversationId);
    }
}

async function loadConversations() {
    conversationList.innerHTML = "<p>A carregar...</p>";

    try {
        const response = await fetch(`${API_BASE}/conversations`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const conversations = await response.json();

        if (!response.ok) {
            conversationList.innerHTML = `<p>${conversations.error || "Erro ao carregar conversas."}</p>`;
            return;
        }

        if (conversations.length === 0) {
            conversationList.innerHTML = "<p>Ainda não tens conversas.</p>";
            return;
        }

        conversationList.innerHTML = "";

        conversations.forEach(conv => {
            const el = document.createElement("div");
            el.className = "conversation-item";
            el.style.cursor = "pointer";
            el.innerHTML = `
                <strong>${conv.other_user_name}</strong>
                ${conv.card_name ? `<br><small>sobre: ${conv.card_name}</small>` : ""}
                ${conv.last_message ? `<br><small>${conv.last_message.slice(0, 40)}</small>` : ""}
            `;
            el.addEventListener("click", () => openConversation(conv.id));
            conversationList.appendChild(el);
        });

    } catch (error) {
        console.error(error);
        conversationList.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

async function openConversation(conversationId) {
    conversationView.innerHTML = "<p>A carregar...</p>";

    try {
        const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const messages = await response.json();

        if (!response.ok) {
            conversationView.innerHTML = `<p>${messages.error || "Erro ao carregar conversa."}</p>`;
            return;
        }

        conversationView.innerHTML = `
            <div class="chat-messages">
                ${messages.length === 0
                    ? "<p><em>Ainda não há mensagens. Diz olá!</em></p>"
                    : messages.map(m => `<p><strong>${m.sender_name}:</strong> ${escapeHtml(m.message)}</p>`).join("")}
            </div>
            <form id="chatForm">
                <input type="text" id="chatInput" placeholder="Escreve uma mensagem..." required>
                <button type="submit">Enviar</button>
            </form>
        `;

        document.getElementById("chatForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            const input = document.getElementById("chatInput");
            const message = input.value.trim();
            if (!message) return;

            const sendResponse = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ message }),
            });

            if (sendResponse.ok) {
                input.value = "";
                openConversation(conversationId);
            }
        });

    } catch (error) {
        console.error(error);
        conversationView.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}