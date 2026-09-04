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
const ordersFlow = document.getElementById("ordersFlow");
const purchasesEl = document.getElementById("purchases");
const salesEl = document.getElementById("sales");

const PAYMENT_STATUS_LABELS = { pending: "Pendente", paid: "Pago", cancelled: "Cancelado" };
const STATUS_LABELS = { committed: "Comprometido", shipped: "Enviado", completed: "Concluído", cancelled: "Cancelado" };

if (!token) {
    loginWarning.style.display = "block";
    ordersFlow.style.display = "none";
} else {
    loadPurchases();
    loadSales();
}

async function loadPurchases() {
    purchasesEl.innerHTML = "<p>A carregar...</p>";

    try {
        const response = await fetch(`${API_BASE}/orders/mine`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const orders = await response.json();

        if (!response.ok) {
            purchasesEl.innerHTML = `<p>${orders.error || "Erro ao carregar compras."}</p>`;
            return;
        }

        if (orders.length === 0) {
            purchasesEl.innerHTML = "<p>Ainda não compraste nada.</p>";
            return;
        }

        purchasesEl.innerHTML = "";

        orders.forEach(order => {
            const el = document.createElement("div");
            el.className = "order-row";
            el.innerHTML = `
                <img src="${order.card_image ?? ""}">
                <div>
                    <h3>${order.card_name} (x${order.quantity})</h3>
                    <p>Vendedor: ${order.seller_name} — ${order.seller_email}</p>
                    <p>Total a transferir para o site: <strong>${Number(order.total_price).toFixed(2)} €</strong>
                        (cartas ${Number(order.unit_price * order.quantity).toFixed(2)} € + portes ${Number(order.shipping_cost).toFixed(2)} €)</p>
                    <p>Pagamento: ${PAYMENT_STATUS_LABELS[order.payment_status]} · Estado: ${STATUS_LABELS[order.status]}</p>
                    ${order.payment_method === "wallet" && order.payment_status === "pending" && order.status === "committed" ? `<button class="pay-now-btn">💳 Pagar agora</button>` : ""}
                    ${order.status === "committed" ? `<button class="cancel-btn">Cancelar</button>` : ""}
                    ${order.status === "shipped" ? `<button class="confirm-received-btn">Confirma Receção</button>` : ""}
                    ${order.status === "completed" ? `<button class="confirm-review-btn">Avaliar Vendedor</button>` : ""}
                    <button class="chat-btn">Conversa</button>
                    <div class="chat-box" style="display:none;"></div>
                </div>
            `;

            el.querySelector(".cancel-btn")?.addEventListener("click", () => cancelOrder(order.id));
            el.querySelector(".confirm-received-btn")?.addEventListener("click", () => confirmReceived(order.id));
            el.querySelector(".pay-now-btn")?.addEventListener("click", () => payNow(order.id));
            el.querySelector(".confirm-review-btn")?.addEventListener("click", () => openReviewForm(order));
            el.querySelector(".chat-btn").addEventListener("click", () => toggleChat(el, order.id));

            purchasesEl.appendChild(el);
        });

    } catch (error) {
        console.error(error);
        purchasesEl.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

async function loadSales() {
    salesEl.innerHTML = "<p>A carregar...</p>";

    try {
        const response = await fetch(`${API_BASE}/orders/selling`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const orders = await response.json();

        if (!response.ok) {
            salesEl.innerHTML = `<p>${orders.error || "Erro ao carregar vendas."}</p>`;
            return;
        }

        if (orders.length === 0) {
            salesEl.innerHTML = "<p>Ainda não vendeste nada.</p>";
            return;
        }

        salesEl.innerHTML = "";

        orders.forEach(order => {
            const el = document.createElement("div");
            el.className = "order-row";
            el.innerHTML = `
                <img src="${order.card_image ?? ""}">
                <div>
                    <h3>${order.card_name} (x${order.quantity})</h3>
                    <p>Comprador: ${order.buyer_name} — ${order.buyer_email}</p>

                    ${order.shipping_name ? `
                        <div style="background:var(--panel-2); border:1px solid var(--border); border-radius:10px; padding:12px; margin:10px 0;">
                            <strong style="font-size:13px; color:var(--text-dim);">📦 ENVIAR PARA</strong>
                            <p style="margin:6px 0 0; line-height:1.5;">
                                ${escapeHtml(order.shipping_name)}<br>
                                ${escapeHtml(order.shipping_address_line)}<br>
                                ${escapeHtml(order.shipping_postal_code)} ${escapeHtml(order.shipping_city)}<br>
                                ${order.shipping_country === "ES" ? "Espanha" : "Portugal"}
                            </p>
                        </div>
                    ` : `<p style="color:var(--text-dim); font-size:13px;"><em>Sem morada registada (encomenda anterior a esta funcionalidade) — pede-a ao comprador pela conversa.</em></p>`}
                    <p>Vais receber: <strong>${Number(order.seller_payout).toFixed(2)} €</strong>
                        ${order.payout_status === "paid_out"
                            ? ` <span style="color:var(--success, #4ADE80);">✓ já repassado</span>`
                            : ` <span style="color:var(--text-dim);">(retido até o comprador confirmar receção)</span>`}
                    </p>
                    <p>Pagamento: ${PAYMENT_STATUS_LABELS[order.payment_status]} · Estado: ${STATUS_LABELS[order.status]}</p>

                    <div class="seller-actions">
                        ${order.payment_status === "paid" && order.status === "committed" ? `<button class="mark-shipped-btn">Marcar como enviado</button>` : ""}
                        ${order.payment_status !== "paid" ? `<p><em>Aguarda a confirmação do pagamento pelo site antes de enviares.</em></p>` : ""}
                    </div>

                    <button class="chat-btn">Conversa</button>
                    <div class="chat-box" style="display:none;"></div>
                </div>
            `;

            el.querySelector(".mark-shipped-btn")?.addEventListener("click", () => updateOrder(order.id, { status: "shipped" }, loadSales));
            el.querySelector(".chat-btn").addEventListener("click", () => toggleChat(el, order.id));

            salesEl.appendChild(el);
        });

    } catch (error) {
        console.error(error);
        salesEl.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

async function updateOrder(id, body, reload) {
    try {
        const response = await fetch(`${API_BASE}/orders/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Erro ao atualizar encomenda.");
            return;
        }

        reload();

    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
    }
}

function cancelOrder(id) {
    if (!confirm("Cancelar esta encomenda?")) return;
    updateOrder(id, { status: "cancelled" }, loadPurchases);
}

// ---- Chat por encomenda ----

async function toggleChat(el, orderId) {
    const box = el.querySelector(".chat-box");

    if (box.style.display === "none") {
        box.style.display = "block";
        await loadMessages(box, orderId);
    } else {
        box.style.display = "none";
    }
}

async function loadMessages(box, orderId) {
    box.innerHTML = "<p>A carregar conversa...</p>";

    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/messages`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const messages = await response.json();

        if (!response.ok) {
            box.innerHTML = `<p>${messages.error || "Erro ao carregar conversa."}</p>`;
            return;
        }

        box.innerHTML = `
            <div class="chat-messages">
                ${messages.length === 0
                    ? "<p><em>Ainda não há mensagens.</em></p>"
                    : messages.map(m => `
                        <p><strong>${m.sender_name}:</strong> ${m.message ? escapeHtml(m.message) : ""}</p>
                        ${m.image_url ? `<img src="${m.image_url}" class="chat-image" onclick="window.open('${m.image_url}')">` : ""}
                    `).join("")}
            </div>
            <form class="chat-form">
                <input type="text" class="chat-input" placeholder="Escreve uma mensagem...">
                <label class="chat-attach-btn" title="Anexar foto">
                    📷
                    <input type="file" class="chat-file-input" accept="image/*" style="display:none;">
                </label>
                <button type="submit">Enviar</button>
            </form>
            <p class="chat-file-name"></p>
        `;

        const fileInput = box.querySelector(".chat-file-input");
        fileInput.addEventListener("change", () => {
            box.querySelector(".chat-file-name").textContent = fileInput.files[0] ? `📎 ${fileInput.files[0].name}` : "";
        });

        box.querySelector(".chat-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const input = box.querySelector(".chat-input");
            const message = input.value.trim();
            const file = fileInput.files[0];

            if (!message && !file) return;

            let image_url = null;

            try {
                if (file) {
                    image_url = await uploadImage(file);
                }

                const response = await fetch(`${API_BASE}/orders/${orderId}/messages`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                    },
                    body: JSON.stringify({ message, image_url }),
                });

                if (response.ok) {
                    input.value = "";
                    fileInput.value = "";
                    await loadMessages(box, orderId);
                } else {
                    const data = await response.json();
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
        box.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
async function payNow(orderId) {
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/pay-now`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Erro ao pagar.");
            return;
        }

        alert("Pago! O vendedor já foi avisado para enviar.");
        loadPurchases();

    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
    }
}

async function confirmReceived(orderId) {

    if (
        !confirm(
            "Confirmas que recebeste a carta?"
        )
    ) {
        return;
    }

    await updateOrder(
        orderId,
        {
            status: "completed"
        },
        loadPurchases
    );
}


function openReviewForm(order) {

    const rating = prompt(
        "Avaliação de 1 a 5 estrelas:"
    );

    if (!rating) {
        return;
    }

    const ratingNumber =
        Number(rating);

    if (
        !Number.isInteger(ratingNumber) ||
        ratingNumber < 1 ||
        ratingNumber > 5
    ) {
        alert(
            "A avaliação tem de ser entre 1 e 5."
        );

        return;
    }


    const comment =
        prompt(
            "Comentário (opcional):"
        ) || "";


    submitReview(
        order.id,
        order.seller_id,
        ratingNumber,
        comment
    );
}


async function submitReview(
    orderId,
    reviewedUserId,
    rating,
    comment
) {

    try {

        const response =
            await fetch(
                `${API_BASE}/reviews`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({

                        order_id:
                            orderId,

                        reviewed_user_id:
                            reviewedUserId,

                        rating,

                        comment

                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.error ||
                "Erro ao enviar avaliação."
            );

            return;

        }


        alert(
            "Avaliação enviada! ⭐"
        );


        loadPurchases();


    } catch (error) {

        console.error(error);

        alert(
            "Erro ao ligar ao servidor."
        );

    }

}