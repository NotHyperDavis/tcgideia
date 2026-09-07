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

const PAYMENT_STATUS_LABELS = { pending: "Pendente", paid: "Pago", cancelled: "Cancelado" };
const STATUS_LABELS = { committed: "Comprometido", shipped: "Enviado", completed: "Concluído", cancelled: "Cancelado" };

if (!token) {
    loginWarning.style.display = "block";
    ordersFlow.style.display = "none";
} else {
    loadPurchases();
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
                    <h3>${escapeHtml(order.card_name)} (x${order.quantity})</h3>
                    <p>Vendedor: ${escapeHtml(order.seller_name)} — ${escapeHtml(order.seller_email)}</p>
                    <p>Total a transferir para o site: <strong>${Number(order.total_price).toFixed(2)} €</strong>
                        (cartas ${Number(order.unit_price * order.quantity).toFixed(2)} € + portes ${Number(order.shipping_cost).toFixed(2)} €)</p>
                    <p>Pagamento: ${PAYMENT_STATUS_LABELS[order.payment_status]} · Estado: ${STATUS_LABELS[order.status]}</p>
                    ${order.payment_status === "paid" ? `<button class="invoice-btn" data-order-id="${order.id}">📄 Recibo</button>` : ""}
                    ${order.payment_method === "wallet" && order.payment_status === "pending" && order.status === "committed" ? `<button class="pay-now-btn">💳 Pagar agora</button>` : ""}
                    ${order.status === "committed" ? `<button class="cancel-btn">Cancelar</button>` : ""}
                    ${order.status === "shipped" ? `<button class="confirm-received-btn">Confirma Receção</button>` : ""}
                    ${order.status === "completed" ? `<button class="confirm-review-btn">Avaliar Vendedor</button>` : ""}
                    ${order.status !== "cancelled" ? `<button class="dispute-btn" data-order-id="${order.id}">⚠️ Abrir Reclamação</button>` : ""}
                    <button class="chat-btn" data-order-id="${order.id}" data-conversation-id="${order.conversation_id ?? ''}" data-other-user-id="${order.seller_id ?? order.buyer_id}" data-listing-id="${order.listing_id}">💬 Conversa</button>
                </div>
                <div class="dispute-form" id="disputeForm-${order.id}" style="display:none; margin-top:12px; padding:14px; border:1px solid var(--border, #DDD6C8); border-radius:10px; background:var(--panel-2, #F8F5EF);">
                    <label>Motivo</label>
                    <select class="dispute-reason">
                        <option value="nao_chegou">A carta não chegou</option>
                        <option value="diferente_do_anuncio">A carta é diferente do anunciado</option>
                        <option value="vendedor_nao_responde">O vendedor não responde</option>
                        <option value="outro">Outro motivo</option>
                    </select>
                    <label>Descrição</label>
                    <textarea class="dispute-description" rows="3" placeholder="Explica o que se passou..."></textarea>
                    <button class="dispute-submit-btn" data-order-id="${order.id}">Enviar reclamação</button>
                    <button class="dispute-cancel-btn" data-order-id="${order.id}" type="button">Cancelar</button>
                    <p class="dispute-message" style="font-size:13px; margin-top:6px;"></p>
                </div>
            `;

            el.querySelector(".dispute-btn")?.addEventListener("click", () => {
                const form = document.getElementById(`disputeForm-${order.id}`);
                form.style.display = form.style.display === "none" ? "block" : "none";
            });

            el.querySelector(".dispute-cancel-btn")?.addEventListener("click", () => {
                document.getElementById(`disputeForm-${order.id}`).style.display = "none";
            });

            el.querySelector(".dispute-submit-btn")?.addEventListener("click", () => submitDispute(order.id, el));

            el.querySelector(".cancel-btn")?.addEventListener("click", () => cancelOrder(order.id));
            el.querySelector(".confirm-received-btn")?.addEventListener("click", () => confirmReceived(order.id));
            el.querySelector(".pay-now-btn")?.addEventListener("click", () => payNow(order.id));
            el.querySelector(".invoice-btn")?.addEventListener("click", () => downloadInvoice(order.id));
            el.querySelector(".confirm-review-btn")?.addEventListener("click", () => openReviewForm(order));
            el.querySelector(".chat-btn").addEventListener("click", (e) => openConversation(e.currentTarget));

            purchasesEl.appendChild(el);
        });

    } catch (error) {
        console.error(error);
        purchasesEl.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
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

// ---- Conversa (unificada com mensagens.html) ----

async function openConversation(button) {
    const conversationId = button.dataset.conversationId;

    if (conversationId) {
        window.location.href = `mensagens.html?conversation=${conversationId}`;
        return;
    }

    // Encomendas mais antigas ainda não têm conversa ligada — cria-se agora.
    const otherUserId = button.dataset.otherUserId;
    const listingId = button.dataset.listingId;

    button.disabled = true;
    button.textContent = "A abrir...";

    try {
        const response = await fetch(`${API_BASE}/conversations`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ other_user_id: otherUserId, listing_id: listingId }),
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Erro ao abrir a conversa.");
            button.disabled = false;
            button.textContent = "💬 Conversa";
            return;
        }

        window.location.href = `mensagens.html?conversation=${data.id}`;

    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
        button.disabled = false;
        button.textContent = "💬 Conversa";
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
async function submitDispute(orderId, el) {
    const form = el.querySelector(".dispute-form");
    const reason = form.querySelector(".dispute-reason").value;
    const description = form.querySelector(".dispute-description").value.trim();
    const messageEl = form.querySelector(".dispute-message");
    const submitBtn = form.querySelector(".dispute-submit-btn");

    if (!description) {
        messageEl.textContent = "Descreve o que se passou, por favor.";
        return;
    }

    submitBtn.disabled = true;
    messageEl.textContent = "A enviar...";

    try {
        const response = await fetch(`${API_BASE}/disputes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ order_id: orderId, reason, description }),
        });

        const data = await response.json();

        if (!response.ok) {
            messageEl.textContent = data.error || "Erro ao enviar a reclamação.";
            submitBtn.disabled = false;
            return;
        }

        messageEl.textContent = "Reclamação enviada! A nossa equipa vai analisar.";
        form.querySelector(".dispute-description").disabled = true;
        form.querySelector(".dispute-reason").disabled = true;
        submitBtn.style.display = "none";

    } catch (error) {
        console.error(error);
        messageEl.textContent = "Erro ao ligar ao servidor.";
        submitBtn.disabled = false;
    }
}

async function downloadInvoice(orderId) {
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/invoice`, {
            headers: { "Authorization": `Bearer ${token}` },
        });

        if (!response.ok) {
            alert("Erro ao gerar o recibo.");
            return;
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recibo-encomenda-${orderId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
    }
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