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
    loadDisputes();
}

const DISPUTE_REASON_LABELS = {
    nao_chegou: "A carta não chegou",
    diferente_do_anuncio: "A carta é diferente do anunciado",
    vendedor_nao_responde: "O vendedor/comprador não responde",
    outro: "Outro problema",
};

const DISPUTE_STATUS_LABELS = { open: "Aberta", in_review: "Em análise", resolved: "Resolvida" };

async function loadDisputes() {
    const disputesContainer = document.getElementById("disputes");
    disputesContainer.innerHTML = "<p>A carregar...</p>";

    try {
        const response = await fetch(`${API_BASE}/disputes/admin`, {
            headers: { "Authorization": `Bearer ${token}` },
        });

        const disputes = await response.json();

        if (!response.ok) {
            disputesContainer.innerHTML = `<p>${disputes.error || "Erro ao carregar reclamações."}</p>`;
            return;
        }

        if (disputes.length === 0) {
            disputesContainer.innerHTML = "<p>Sem reclamações.</p>";
            return;
        }

        disputesContainer.innerHTML = disputes.map(d => `
            <div class="admin-order-row">
                <div>
                    <h3>${DISPUTE_REASON_LABELS[d.reason] ?? d.reason} — ${d.card_name}</h3>
                    <p>Aberta por: ${d.opened_by_name} (${d.opened_by_email})</p>
                    <p>Comprador: ${d.buyer_name} · Vendedor: ${d.seller_name} · Valor: ${Number(d.total_price).toFixed(2)} €</p>
                    ${d.description ? `<p><em>"${d.description}"</em></p>` : ""}
                    <p>Estado: <strong>${DISPUTE_STATUS_LABELS[d.status]}</strong> · Aberta em ${new Date(d.created_at).toLocaleString("pt-PT")}</p>

                    <select class="dispute-status-select" data-id="${d.id}">
                        <option value="open" ${d.status === "open" ? "selected" : ""}>Aberta</option>
                        <option value="in_review" ${d.status === "in_review" ? "selected" : ""}>Em análise</option>
                        <option value="resolved" ${d.status === "resolved" ? "selected" : ""}>Resolvida</option>
                    </select>

                    <label style="display:block; margin-top:8px; font-size:13px;">
                        <input type="checkbox" class="dispute-refund-check" data-id="${d.id}" style="width:auto;">
                        Emitir reembolso ao comprador
                    </label>
                    <input type="number" class="dispute-refund-amount" data-id="${d.id}" step="0.01" min="0.01" max="${Number(d.total_price).toFixed(2)}" placeholder="Valor (deixa vazio para reembolso total: ${Number(d.total_price).toFixed(2)} €)" style="margin-top:4px; width:100%;">

                    <button class="save-dispute-btn" data-id="${d.id}">Guardar</button>
                </div>
            </div>
        `).join("");

        document.querySelectorAll(".save-dispute-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.dataset.id;
                const status = document.querySelector(`.dispute-status-select[data-id="${id}"]`).value;
                const issue_refund = document.querySelector(`.dispute-refund-check[data-id="${id}"]`).checked;
                const refund_amount = document.querySelector(`.dispute-refund-amount[data-id="${id}"]`).value;

                if (issue_refund) {
                    const confirmed = confirm(
                        refund_amount
                            ? `Confirmas o reembolso de ${Number(refund_amount).toFixed(2)} € ao comprador?`
                            : "Confirmas o reembolso TOTAL ao comprador? A encomenda vai ser cancelada."
                    );
                    if (!confirmed) return;
                }

                const response = await fetch(`${API_BASE}/disputes/${id}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        status,
                        issue_refund,
                        refund_amount: refund_amount || null,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    alert(data.error || "Erro ao guardar.");
                    return;
                }

                loadDisputes();
            });
        });

    } catch (error) {
        console.error(error);
        disputesContainer.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
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
document.getElementById("updateAccountTypeBtn").addEventListener("click", async () => {
    const email = document.getElementById("accountTypeEmail").value.trim();
    const account_type = document.getElementById("accountTypeSelect").value;
    const messageEl = document.getElementById("accountTypeMessage");

    if (!email) {
        messageEl.textContent = "Indica o email do utilizador.";
        return;
    }

    messageEl.textContent = "A atualizar...";

    try {
        const response = await fetch(`${API_BASE}/users/admin/account-type`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ email, account_type }),
        });

        const data = await response.json();

        if (!response.ok) {
            messageEl.textContent = data.error || "Erro ao atualizar.";
            return;
        }

        messageEl.textContent = `Feito! ${data.name} (${data.email}) passou a "${data.account_type === "store" ? "Loja" : "Particular"}".`;
        document.getElementById("accountTypeEmail").value = "";

    } catch (error) {
        console.error(error);
        messageEl.textContent = "Erro ao ligar ao servidor.";
    }
});