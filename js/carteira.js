const token = localStorage.getItem("token");

const loginWarning = document.getElementById("loginWarning");
const walletFlow = document.getElementById("walletFlow");
const balanceEl = document.getElementById("balance");
const historyEl = document.getElementById("history");

if (!token) {
    loginWarning.style.display = "block";
    walletFlow.style.display = "none";
} else {
    loadWallet();

    const params = new URLSearchParams(window.location.search);
    if (params.get("deposit") === "success") {
        document.getElementById("instantDepositMessage").textContent = "Pagamento confirmado! O saldo já deve estar atualizado.";
    } else if (params.get("deposit") === "cancelled") {
        document.getElementById("instantDepositMessage").textContent = "Depósito cancelado.";
    }
}

async function loadWallet() {
    try {
        const response = await fetch(`${API_BASE}/wallet`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
            walletFlow.innerHTML = `<p>${data.error || "Erro ao carregar carteira."}</p>`;
            return;
        }

        balanceEl.textContent = `${Number(data.balance).toFixed(2)} €`;

        const movements = [
            ...data.deposits.map(d => ({ ...d, kind: "Depósito", sign: "+" })),
            ...data.withdrawals.map(w => ({ ...w, kind: "Levantamento", sign: "-" })),
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (movements.length === 0) {
            historyEl.innerHTML = "<p>Ainda não há movimentos.</p>";
        } else {
            historyEl.innerHTML = movements.map(m => `
                <div class="order-row">
                    <div>
                        <h3>${m.kind}: ${m.sign}${Number(m.amount).toFixed(2)} €</h3>
                        <p>Estado: ${statusLabel(m.status)} ${m.method === "stripe" ? "· Cartão/MB WAY" : m.method === "bank_transfer" ? "· Transferência bancária" : ""}</p>
                        <small>${new Date(m.created_at).toLocaleString("pt-PT")}</small>
                    </div>
                </div>
            `).join("");
        }

    } catch (error) {
        console.error(error);
        walletFlow.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

function statusLabel(status) {
    const labels = { pending: "Pendente", confirmed: "Confirmado", completed: "Concluído", rejected: "Rejeitado" };
    return labels[status] || status;
}

document.getElementById("instantDepositForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = document.getElementById("instantDepositAmount").value;
    const message = document.getElementById("instantDepositMessage");
    message.textContent = "A abrir o pagamento...";

    try {
        const response = await fetch(`${API_BASE}/wallet/deposit/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
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
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
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
    const iban = document.getElementById("withdrawIban").value;
    const message = document.getElementById("withdrawMessage");
    message.textContent = "A enviar pedido...";

    try {
        const response = await fetch(`${API_BASE}/wallet/withdraw`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ amount, iban }),
        });
        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.error || "Erro ao pedir levantamento.";
            return;
        }

        message.textContent = "Pedido enviado! O valor já saiu do teu saldo e é enviado assim que confirmarmos.";
        document.getElementById("withdrawForm").reset();
        loadWallet();

    } catch (error) {
        console.error(error);
        message.textContent = "Erro ao ligar ao servidor.";
    }
});