const token = localStorage.getItem("token");

const loginWarning = document.getElementById("loginWarning");
const walletFlow = document.getElementById("walletFlow");
const balanceEl = document.getElementById("balance");
const statBalanceEl = document.getElementById("statBalance");
const statPendingEl = document.getElementById("statPending");
const statMovementsEl = document.getElementById("statMovements");
const withdrawAvailableEl = document.getElementById("withdrawAvailable");
const historyEl = document.getElementById("history");
const historyCountEl = document.getElementById("historyCount");

if (!token) {
    loginWarning.style.display = "block";
    walletFlow.style.display = "none";
} else {
    loadWallet();

    const params = new URLSearchParams(window.location.search);
    const instantMessage = document.getElementById("instantDepositMessage");

    if (params.get("deposit") === "success") {
        instantMessage.textContent = "Pagamento confirmado! O saldo deverá ficar atualizado em instantes.";
    } else if (params.get("deposit") === "cancelled") {
        instantMessage.textContent = "O depósito foi cancelado.";
    }
}

function formatMoney(value) {
    return `${Number(value || 0).toLocaleString("pt-PT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} €`;
}

function formatDate(value) {
    return new Date(value).toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

async function loadWallet() {
    try {
        const response = await fetch(`${API_BASE}/wallet`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();

        if (!response.ok) {
            walletFlow.innerHTML = `<p>${data.error || "Erro ao carregar carteira."}</p>`;
            return;
        }

        const balance = Number(data.balance || 0);
        balanceEl.textContent = formatMoney(balance);
        statBalanceEl.textContent = formatMoney(balance);
        withdrawAvailableEl.textContent = formatMoney(balance);

        const movements = [
            ...data.deposits.map(d => ({ ...d, kind: "Depósito", direction: "in" })),
            ...data.withdrawals.map(w => ({ ...w, kind: "Levantamento", direction: "out" })),
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const pendingDeposits = data.deposits
            .filter(d => d.status === "pending")
            .reduce((sum, d) => sum + Number(d.amount || 0), 0);

        const pendingWithdrawals = data.withdrawals
            .filter(w => w.status === "pending")
            .reduce((sum, w) => sum + Number(w.amount || 0), 0);

        statPendingEl.textContent = formatMoney(pendingDeposits + pendingWithdrawals);
        statMovementsEl.textContent = movements.length;
        historyCountEl.textContent = `${movements.length} ${movements.length === 1 ? "movimento" : "movimentos"}`;

        if (movements.length === 0) {
            historyEl.innerHTML = `
                <div class="wallet-history-empty">
                    Ainda não tens movimentos na carteira.
                </div>
            `;
            return;
        }

        historyEl.innerHTML = movements.map(m => {
            const isIn = m.direction === "in";
            const method = m.method === "stripe"
                ? "Cartão / MB WAY"
                : m.method === "bank_transfer"
                    ? "Transferência bancária"
                    : "";

            return `
                <div class="wallet-movement">
                    <div class="wallet-movement-icon ${isIn ? "" : "out"}">
                        ${isIn ? "+" : "−"}
                    </div>
                    <div>
                        <p class="wallet-movement-title">${m.kind}</p>
                        <p class="wallet-movement-meta">
                            ${formatDate(m.created_at)}
                            ${method ? ` · ${method}` : ""}
                            <span class="wallet-movement-status">${statusLabel(m.status)}</span>
                        </p>
                    </div>
                    <div class="wallet-movement-amount ${isIn ? "in" : "out"}">
                        ${isIn ? "+" : "−"}${formatMoney(m.amount)}
                    </div>
                </div>
            `;
        }).join("");
    } catch (error) {
        console.error(error);
        walletFlow.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

function statusLabel(status) {
    const labels = {
        pending: "Pendente",
        confirmed: "Confirmado",
        completed: "Concluído",
        rejected: "Rejeitado",
    };

    return labels[status] || status;
}

const instantAmount = document.getElementById("instantDepositAmount");
const instantFeePreview = document.getElementById("instantDepositFeePreview");

instantAmount.addEventListener("input", () => {
    const amount = Number(instantAmount.value);

    if (!amount || amount <= 0) {
        instantFeePreview.textContent = "Introduz um valor para calcular a taxa.";
        return;
    }

    const fee = Number((amount * 0.05 + 0.35).toFixed(2));
    const total = Number((amount + fee).toFixed(2));

    instantFeePreview.innerHTML =
        `<strong>Recebes ${formatMoney(amount)}</strong> · taxa ${formatMoney(fee)} · total a pagar ${formatMoney(total)}`;
});

document.getElementById("instantDepositForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const amount = instantAmount.value;
    const message = document.getElementById("instantDepositMessage");
    message.textContent = "A abrir o pagamento...";

    try {
        const response = await fetch(`${API_BASE}/wallet/deposit/checkout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ amount }),
        });

        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.error || "Erro ao iniciar o depósito.";
            return;
        }

        window.location.href = data.url;
    } catch (error) {
        console.error(error);
        message.textContent = "Erro ao ligar ao servidor.";
    }
});

document.getElementById("depositForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const amount = document.getElementById("depositAmount").value;
    const message = document.getElementById("depositMessage");
    message.textContent = "A enviar pedido...";

    try {
        const response = await fetch(`${API_BASE}/wallet/deposit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ amount }),
        });

        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.error || "Erro ao pedir depósito.";
            return;
        }

        message.textContent = "Pedido enviado! Assim que confirmarmos a transferência, o saldo é atualizado.";
        document.getElementById("depositForm").reset();
        loadWallet();
    } catch (error) {
        console.error(error);
        message.textContent = "Erro ao ligar ao servidor.";
    }
});

document.getElementById("withdrawForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const amount = document.getElementById("withdrawAmount").value;
    const iban = document.getElementById("withdrawIban").value.trim();
    const message = document.getElementById("withdrawMessage");
    message.textContent = "A enviar pedido...";

    try {
        const response = await fetch(`${API_BASE}/wallet/withdraw`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ amount, iban }),
        });

        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.error || "Erro ao pedir levantamento.";
            return;
        }

        message.textContent = "Pedido enviado! O valor foi reservado do teu saldo.";
        document.getElementById("withdrawForm").reset();
        loadWallet();
    } catch (error) {
        console.error(error);
        message.textContent = "Erro ao ligar ao servidor.";
    }
});
