const API_BASE = "http://localhost:3000"; // troca pelo domínio real quando publicares o site

const token = localStorage.getItem("token");

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
                        (cartas ${(order.total_price - order.shipping_cost - order.platform_fee).toFixed(2)} € + portes ${Number(order.shipping_cost).toFixed(2)} € + taxa ${Number(order.platform_fee).toFixed(2)} €)</p>
                    <p>Pagamento: ${PAYMENT_STATUS_LABELS[order.payment_status]} · Estado: ${STATUS_LABELS[order.status]}</p>
                    ${order.status === "committed" ? `<button class="cancel-btn">Cancelar</button>` : ""}
                    ${order.status === "shipped" ? `<button class="confirm-received-btn">Confirma Receção</button>` : ""}
                    ${order.status === "completed" ? `<button class="confirm-review-btn">Avaliar Vendedor</button>` : ""}
                    <button class="chat-btn">Conversa</button>
                    <div class="chat-box" style="display:none;"></div>
                </div>
            `;

            el.querySelector(".cancel-btn")?.addEventListener("click", () => cancelOrder(order.id));
            el.querySelector(".confirm-received-btn")?.addEventListener("click", () => confirmReceived(order.id));
            el.querySelector(".confirm-btn")?.addEventListener("click", () => openReviewForm(order));
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
                    <p>Vais receber (já com a comissão do site descontada): <strong>${Number(order.seller_payout).toFixed(2)} €</strong></p>
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
                    : messages.map(m => `<p><strong>${m.sender_name}:</strong> ${escapeHtml(m.message)}</p>`).join("")}
            </div>
            <form class="chat-form">
                <input type="text" class="chat-input" placeholder="Escreve uma mensagem..." required>
                <button type="submit">Enviar</button>
            </form>
        `;

        box.querySelector(".chat-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const input = box.querySelector(".chat-input");
            const message = input.value.trim();
            if (!message) return;

            const response = await fetch(`${API_BASE}/orders/${orderId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ message }),
            });

            if (response.ok) {
                input.value = "";
                await loadMessages(box, orderId);
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