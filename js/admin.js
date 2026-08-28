const API_BASE = "http://localhost:3000"; // troca pelo domínio real quando publicares o site

const token = localStorage.getItem("token");
const container = document.getElementById("orders");

const PAYMENT_STATUS_LABELS = { pending: "Pendente", paid: "Pago", cancelled: "Cancelado" };
const STATUS_LABELS = { committed: "Comprometido", shipped: "Enviado", completed: "Concluído", cancelled: "Cancelado" };
const PAYOUT_LABELS = { pending: "Por repassar", paid_out: "Repassado" };

if (!token) {
    container.innerHTML = "<p>Precisas de iniciar sessão.</p>";
} else {
    loadOrders();
}

async function loadOrders() {
    container.innerHTML = "<p>A carregar...</p>";

    try {
        const response = await fetch(`${API_BASE}/orders/admin/payouts`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const orders = await response.json();

        if (!response.ok) {
            container.innerHTML = `<p>${orders.error || "Sem acesso."}</p>`;
            return;
        }

        if (orders.length === 0) {
            container.innerHTML = "<p>Ainda não há encomendas.</p>";
            return;
        }

        container.innerHTML = "";

        orders.forEach(order => {
            const el = document.createElement("div");
            el.className = "admin-order-row";
            el.innerHTML = `
                <h3>#${order.id} — ${order.card_name} (x${order.quantity})</h3>
                <p>Comprador: ${order.buyer_name} (${order.buyer_email})</p>
                <p>Vendedor: ${order.seller_name} (${order.seller_email})</p>
                <p>Total: ${Number(order.total_price).toFixed(2)} € · Comissão: ${Number(order.platform_fee).toFixed(2)} € · A repassar: ${Number(order.seller_payout).toFixed(2)} €</p>
                <p>Pagamento: ${PAYMENT_STATUS_LABELS[order.payment_status]} · Estado: ${STATUS_LABELS[order.status]} · Repasse: ${PAYOUT_LABELS[order.payout_status]}</p>

                ${order.payment_status === "pending" ? `<button class="mark-paid-btn">Confirmar que recebi a transferência do comprador</button>` : ""}
                ${order.payment_status === "paid" && order.payout_status === "pending" ? `<button class="mark-payout-btn">Confirmar que repassei ao vendedor</button>` : ""}
            `;

            el.querySelector(".mark-paid-btn")?.addEventListener("click", () => updateOrder(order.id, { payment_status: "paid" }));
            el.querySelector(".mark-payout-btn")?.addEventListener("click", () => updateOrder(order.id, { payout_status: "paid_out" }));

            container.appendChild(el);
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

async function updateOrder(id, body) {
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
            alert(data.error || "Erro ao atualizar.");
            return;
        }

        loadOrders();

    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
    }
}