const token = localStorage.getItem("token");

// Envia um ficheiro para o Cloudinary (via o backend) e devolve o URL público.
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
                    : messages.map(m => `
                        <p><strong>${m.sender_name}:</strong> ${m.message ? escapeHtml(m.message) : ""}</p>
                        ${m.image_url ? `<img src="${m.image_url}" class="chat-image" onclick="window.open('${m.image_url}')">` : ""}
                    `).join("")}
            </div>
            <form id="chatForm">
                <input type="text" id="chatInput" placeholder="Escreve uma mensagem...">
                <label class="chat-attach-btn" title="Anexar foto">
                    📷
                    <input type="file" id="chatFileInput" accept="image/*" style="display:none;">
                </label>
                <button type="submit">Enviar</button>
            </form>
            <p id="chatFileName"></p>
        `;

        const fileInput = document.getElementById("chatFileInput");
        fileInput.addEventListener("change", () => {
            document.getElementById("chatFileName").textContent = fileInput.files[0] ? `📎 ${fileInput.files[0].name}` : "";
        });

        document.getElementById("chatForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            const input = document.getElementById("chatInput");
            const message = input.value.trim();
            const file = fileInput.files[0];

            if (!message && !file) return;

            try {
                let image_url = null;
                if (file) {
                    image_url = await uploadImage(file);
                }

                const sendResponse = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                    },
                    body: JSON.stringify({ message, image_url }),
                });

                if (sendResponse.ok) {
                    input.value = "";
                    fileInput.value = "";
                    openConversation(conversationId);
                } else {
                    const data = await sendResponse.json();
                    if (data.code === "EMAIL_NOT_VERIFIED") {
                        if (confirm("Confirma o teu email antes de continuares. Queres que reenviemos o link de confirmação agora?")) {
                            await fetch(`${API_BASE}/auth/resend-verification`, {
                                method: "POST",
                                headers: { "Authorization": `Bearer ${token}` },
                            });
                            alert("Email reenviado! Verifica a tua caixa de correio.");
                        }
                    } else {
                        alert(data.error || "Erro ao enviar a mensagem.");
                    }
                }
            } catch (error) {
                console.error(error);
                alert(error.message || "Erro ao enviar a mensagem.");
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