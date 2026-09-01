const token = localStorage.getItem("token");
const statusText = document.getElementById("statusText");
const connectBtn = document.getElementById("connectBtn");

if (!token) {
    statusText.textContent = "Precisas de iniciar sessão.";
} else {
    checkStatus();
}

async function checkStatus() {
    try {
        const response = await fetch(`${API_BASE}/stripe-connect/status`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
            statusText.textContent = data.error || "Erro ao verificar o estado.";
            return;
        }

        if (data.connected && data.charges_enabled && data.payouts_enabled) {
            statusText.textContent = "✅ A tua conta está pronta para receber pagamentos por cartão!";
        } else if (data.connected) {
            statusText.textContent = "⚠️ Já começaste a ligação, mas falta completares alguns dados na Stripe.";
            connectBtn.style.display = "inline-block";
            connectBtn.textContent = "Continuar Configuração";
        } else {
            statusText.textContent = "Ainda não ligaste nenhuma conta.";
            connectBtn.style.display = "inline-block";
            connectBtn.textContent = "Ligar Conta Stripe";
        }

    } catch (error) {
        console.error(error);
        statusText.textContent = "Erro ao ligar ao servidor.";
    }
}

connectBtn.addEventListener("click", async () => {
    connectBtn.disabled = true;
    connectBtn.textContent = "A abrir a Stripe...";

    try {
        const response = await fetch(`${API_BASE}/stripe-connect/onboard`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
            statusText.textContent = data.error || "Erro ao iniciar a ligação.";
            connectBtn.disabled = false;
            return;
        }

        window.location.href = data.url;

    } catch (error) {
        console.error(error);
        statusText.textContent = "Erro ao ligar ao servidor.";
        connectBtn.disabled = false;
    }
});