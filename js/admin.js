const token = localStorage.getItem("token");
const container = document.getElementById("orders");

const PAYMENT_STATUS_LABELS = { pending: "Pendente", paid: "Pago", cancelled: "Cancelado" };
const STATUS_LABELS = { committed: "Comprometido", shipped: "Enviado", completed: "Concluído", cancelled: "Cancelado" };
const PAYOUT_LABELS = { pending: "Por repassar", paid_out: "Repassado" };

if (!token) {
    container.innerHTML = "<p>Precisas de iniciar sessão.</p>";
} else {
    loadOrders();
    loadWalletRequests();
}

async function loadWalletRequests() {
    const walletContainer = document.getElementById("walletRequests");
    walletContainer.innerHTML = "<p>A carregar...</p>";

    try {
        const response = await fetch(`${API_BASE}/wallet/admin/pending`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
            walletContainer.innerHTML = `<p>${data.error || "Sem acesso."}</p>`;
            return;
        }

        if (data.deposits.length === 0 && data.withdrawals.length === 0) {
            walletContainer.innerHTML = "<p>Sem pedidos pendentes.</p>";
            return;
        }

        walletContainer.innerHTML = "";

        data.deposits.forEach(dep => {
            const el = document.createElement("div");
            el.className = "admin-order-row";
            el.innerHTML = `
                <h3>Depósito — ${Number(dep.amount).toFixed(2)} €</h3>
                <p>${dep.user_name} (${dep.user_email})</p>
                <button class="approve-deposit-btn">Confirmar receção</button>
                <button class="reject-deposit-btn cancel-btn">Rejeitar</button>
            `;
            el.querySelector(".approve-deposit-btn").addEventListener("click", () => resolveDeposit(dep.id, "confirmed"));
            el.querySelector(".reject-deposit-btn").addEventListener("click", () => resolveDeposit(dep.id, "rejected"));
            walletContainer.appendChild(el);
        });

        data.withdrawals.forEach(w => {
            const el = document.createElement("div");
            el.className = "admin-order-row";
            el.innerHTML = `
                <h3>Levantamento — ${Number(w.amount).toFixed(2)} €</h3>
                <p>${w.user_name} (${w.user_email})</p>
                <p>IBAN: ${w.iban}</p>
                <button class="approve-withdrawal-btn">Confirmar que enviei</button>
                <button class="reject-withdrawal-btn cancel-btn">Rejeitar (devolve saldo)</button>
            `;
            el.querySelector(".approve-withdrawal-btn").addEventListener("click", () => resolveWithdrawal(w.id, "completed"));
            el.querySelector(".reject-withdrawal-btn").addEventListener("click", () => resolveWithdrawal(w.id, "rejected"));
            walletContainer.appendChild(el);
        });

    } catch (error) {
        console.error(error);
        walletContainer.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

async function resolveDeposit(id, status) {
    try {
        const response = await fetch(`${API_BASE}/wallet/admin/deposits/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ status }),
        });
        const data = await response.json();
        if (!response.ok) { alert(data.error || "Erro."); return; }
        loadWalletRequests();
    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
    }
}

async function resolveWithdrawal(id, status) {
    try {
        const response = await fetch(`${API_BASE}/wallet/admin/withdrawals/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ status }),
        });
        const data = await response.json();
        if (!response.ok) { alert(data.error || "Erro."); return; }
        loadWalletRequests();
    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
    }
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
                <p>Método: ${order.payment_method === "wallet" ? "Carteira" : order.payment_method === "stripe" ? "Cartão (Stripe)" : "Transferência bancária"}</p>
                <p>Pagamento: ${PAYMENT_STATUS_LABELS[order.payment_status]} · Estado: ${STATUS_LABELS[order.status]} · Repasse: ${PAYOUT_LABELS[order.payout_status]}</p>

                ${order.payment_method === "bank_transfer" && order.payment_status === "pending" ? `<button class="mark-paid-btn">Confirmar que recebi a transferência do comprador</button>` : ""}
                ${order.payment_method === "bank_transfer" && order.status === "completed" && order.payout_status === "pending" ? `<button class="mark-payout-btn">Confirmar que repassei ao vendedor</button>` : ""}
                ${order.payment_method !== "bank_transfer" && order.payout_status === "pending" ? `<p style="font-size:12px; color:var(--text-dim);"><em>Repasse automático — só acontece depois de o comprador confirmar a receção.</em></p>` : ""}
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