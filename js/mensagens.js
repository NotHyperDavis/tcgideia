const token = localStorage.getItem("token");

let currentUserName = "";
let conversationsCache = [];
let activeConversationId = null;

// Envia um ficheiro para o Cloudinary (via backend) e devolve o URL público.
async function uploadImage(file) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar a imagem.");
    }

    return data.url;
}

const loginWarning = document.getElementById("loginWarning");
const messagesLayout = document.getElementById("messagesLayout");
const conversationList = document.getElementById("conversationList");
const conversationView = document.getElementById("conversationView");
const messagesCount = document.getElementById("messagesCount");
const conversationSearch = document.getElementById("conversationSearch");

if (!token) {
    loginWarning.style.display = "block";
    messagesLayout.style.display = "none";
} else {
    init();
}

async function init() {
    await loadCurrentUser();
    await loadConversations();

    const params = new URLSearchParams(window.location.search);
    const conversationId = params.get("conversation");

    if (conversationId) {
        openConversation(conversationId);
    }
}

async function loadCurrentUser() {
    try {
        const response = await fetch(`${API_BASE}/users/me`, {
            headers: { "Authorization": `Bearer ${token}` },
        });

        if (!response.ok) return;

        const user = await response.json();
        currentUserName = user.name || "";
    } catch (error) {
        console.warn("Não foi possível obter o utilizador atual.", error);
    }
}

async function loadConversations() {
    conversationList.innerHTML = `
        <div class="conversation-loading">
            <span class="loading-dot"></span>
            A carregar conversas...
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE}/conversations`, {
            headers: { "Authorization": `Bearer ${token}` },
        });

        const conversations = await response.json();

        if (!response.ok) {
            conversationList.innerHTML = `
                <div class="conversation-empty-list">
                    ${escapeHtml(conversations.error || "Erro ao carregar conversas.")}
                </div>
            `;
            return;
        }

        conversationsCache = Array.isArray(conversations) ? conversations : [];

        if (messagesCount) {
            messagesCount.textContent = conversationsCache.length;
        }

        renderConversationList(conversationsCache);

    } catch (error) {
        console.error(error);

        conversationList.innerHTML = `
            <div class="conversation-empty-list">
                Não foi possível ligar ao servidor.
            </div>
        `;
    }
}

function renderConversationList(conversations) {
    if (!conversations.length) {
        conversationList.innerHTML = `
            <div class="conversation-empty-list">
                Ainda não tens conversas.<br>
                Quando contactares um vendedor ou comprador, elas aparecerão aqui.
            </div>
        `;
        return;
    }

    conversationList.innerHTML = "";

    conversations.forEach(conv => {
        const el = document.createElement("div");

        el.className = "conversation-item";
        if (String(conv.id) === String(activeConversationId)) {
            el.classList.add("active");
        }

        const name = conv.other_user_name || "Utilizador";
        const initial = name.trim().charAt(0).toUpperCase() || "?";
        const cardName = conv.card_name || "";
        const lastMessage = conv.last_message || "Ainda não há mensagens.";

        el.innerHTML = `
            <div class="conversation-avatar">${escapeHtml(initial)}</div>

            <div class="conversation-info">
                <div class="conversation-name-row">
                    <span class="conversation-name">${escapeHtml(name)}</span>
                </div>

                ${cardName
                    ? `<div class="conversation-card">🃏 ${escapeHtml(cardName)}</div>`
                    : ""
                }

                <div class="conversation-preview">
                    ${escapeHtml(lastMessage.slice(0, 70))}
                </div>
            </div>
        `;

        el.addEventListener("click", () => openConversation(conv.id));
        conversationList.appendChild(el);
    });
}

if (conversationSearch) {
    conversationSearch.addEventListener("input", () => {
        const query = conversationSearch.value.trim().toLowerCase();

        if (!query) {
            renderConversationList(conversationsCache);
            return;
        }

        const filtered = conversationsCache.filter(conv => {
            const name = String(conv.other_user_name || "").toLowerCase();
            const card = String(conv.card_name || "").toLowerCase();
            const message = String(conv.last_message || "").toLowerCase();

            return (
                name.includes(query) ||
                card.includes(query) ||
                message.includes(query)
            );
        });

        renderConversationList(filtered);
    });
}

async function openConversation(conversationId) {
    activeConversationId = conversationId;

    renderConversationList(
        conversationsCache.filter(() => true)
    );

    conversationView.innerHTML = `
        <div class="chat-empty">
            <div class="chat-empty-inner">
                <div class="chat-empty-icon">⏳</div>
                <h2>A carregar conversa...</h2>
                <p>Aguarda um momento.</p>
            </div>
        </div>
    `;

    messagesLayout.classList.add("chat-open");

    try {
        const response = await fetch(
            `${API_BASE}/conversations/${conversationId}/messages`,
            {
                headers: { "Authorization": `Bearer ${token}` },
            }
        );

        const messages = await response.json();

        if (!response.ok) {
            conversationView.innerHTML = `
                <div class="chat-empty">
                    <div class="chat-empty-inner">
                        <div class="chat-empty-icon">⚠️</div>
                        <h2>Não foi possível abrir a conversa</h2>
                        <p>${escapeHtml(messages.error || "Erro ao carregar conversa.")}</p>
                    </div>
                </div>
            `;
            return;
        }

        const conversation = conversationsCache.find(
            conv => String(conv.id) === String(conversationId)
        );

        renderConversation(conversationId, conversation, messages);

    } catch (error) {
        console.error(error);

        conversationView.innerHTML = `
            <div class="chat-empty">
                <div class="chat-empty-inner">
                    <div class="chat-empty-icon">⚠️</div>
                    <h2>Erro de ligação</h2>
                    <p>Não foi possível ligar ao servidor.</p>
                </div>
            </div>
        `;
    }
}

function renderConversation(conversationId, conversation, messages) {
    const otherName = conversation?.other_user_name || "Utilizador";
    const initial = otherName.trim().charAt(0).toUpperCase() || "?";
    const cardName = conversation?.card_name || "";

    const messageHtml = messages.length
        ? messages.map(renderMessage).join("")
        : `
            <div class="chat-empty">
                <div class="chat-empty-inner">
                    <div class="chat-empty-icon">👋</div>
                    <h2>Diz olá!</h2>
                    <p>Ainda não existem mensagens nesta conversa.</p>
                </div>
            </div>
        `;

    conversationView.innerHTML = `
        <div class="chat-header">
            <button class="mobile-back" type="button" id="mobileBackBtn" aria-label="Voltar">
                ←
            </button>

            <div class="chat-header-avatar">${escapeHtml(initial)}</div>

            <div class="chat-header-info">
                <h2 class="chat-header-name">${escapeHtml(otherName)}</h2>
                <p class="chat-header-context">
                    ${cardName ? `🃏 ${escapeHtml(cardName)}` : "Conversa TCGMarketPortugal"}
                </p>
            </div>
        </div>

        <div class="chat-messages" id="chatMessages">
            ${messageHtml}
        </div>

        <div class="chat-composer-wrap">
            <div id="chatFileName" class="chat-file-preview"></div>

            <form id="chatForm" class="chat-form">
                <label class="chat-attach-btn" title="Anexar foto">
                    📎
                    <input
                        type="file"
                        id="chatFileInput"
                        accept="image/*"
                        hidden
                    >
                </label>

                <input
                    type="text"
                    id="chatInput"
                    class="chat-input"
                    placeholder="Escreve uma mensagem..."
                    autocomplete="off"
                >

                <button type="submit" class="chat-send-btn">
                    Enviar
                </button>
            </form>
        </div>
    `;

    const messagesContainer = document.getElementById("chatMessages");

    if (messagesContainer && messages.length) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    const backBtn = document.getElementById("mobileBackBtn");

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            messagesLayout.classList.remove("chat-open");
            activeConversationId = null;
            renderConversationList(conversationsCache);
        });
    }

    const fileInput = document.getElementById("chatFileInput");
    const fileName = document.getElementById("chatFileName");

    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];

        if (!file) {
            fileName.style.display = "none";
            fileName.textContent = "";
            return;
        }

        fileName.style.display = "flex";
        fileName.textContent = `📎 ${file.name}`;
    });

    document.getElementById("chatForm").addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const input = document.getElementById("chatInput");
            const sendButton = event.currentTarget.querySelector("button");
            const message = input.value.trim();
            const file = fileInput.files[0];

            if (!message && !file) return;

            try {
                sendButton.disabled = true;
                sendButton.textContent = "A enviar...";

                let image_url = null;

                if (file) {
                    image_url = await uploadImage(file);
                }

                const sendResponse = await fetch(
                    `${API_BASE}/conversations/${conversationId}/messages`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`,
                        },
                        body: JSON.stringify({ message, image_url }),
                    }
                );

                if (sendResponse.ok) {
                    input.value = "";
                    fileInput.value = "";
                    fileName.style.display = "none";
                    fileName.textContent = "";

                    await loadConversations();
                    await openConversation(conversationId);
                } else {
                    const data = await sendResponse.json();

                    if (data.code === "EMAIL_NOT_VERIFIED") {
                        if (
                            confirm(
                                "Confirma o teu email antes de continuares. Queres que reenviemos o link de confirmação agora?"
                            )
                        ) {
                            await fetch(`${API_BASE}/auth/resend-verification`, {
                                method: "POST",
                                headers: {
                                    "Authorization": `Bearer ${token}`,
                                },
                            });

                            alert(
                                "Email reenviado! Verifica a tua caixa de correio."
                            );
                        }
                    } else {
                        alert(data.error || "Erro ao enviar a mensagem.");
                    }
                }

            } catch (error) {
                console.error(error);
                alert(error.message || "Erro ao enviar a mensagem.");

            } finally {
                sendButton.disabled = false;
                sendButton.textContent = "Enviar";
            }
        }
    );
}

function renderMessage(message) {
    const senderName = message.sender_name || "Utilizador";

    const isMine =
        currentUserName &&
        senderName.trim().toLowerCase() === currentUserName.trim().toLowerCase();

    const sideClass = isMine ? "mine" : "theirs";

    return `
        <div class="message-row ${sideClass}">
            <div class="message-bubble">

                ${!isMine
                    ? `<div class="message-author">${escapeHtml(senderName)}</div>`
                    : ""
                }

                ${message.message
                    ? `<div class="message-text">${escapeHtml(message.message)}</div>`
                    : ""
                }

                ${message.image_url
                    ? `
                        <img
                            src="${escapeHtml(message.image_url)}"
                            class="message-image"
                            alt="Imagem enviada"
                            onclick="window.open('${escapeJsUrl(message.image_url)}', '_blank')"
                        >
                    `
                    : ""
                }

                <div class="message-time">
                    ${isMine ? "Tu" : escapeHtml(senderName)}
                </div>

            </div>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
}

function escapeJsUrl(url) {
    return String(url || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}
