const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const message = document.getElementById("message");

async function verify() {
    if (!token) {
        message.textContent = "Link inválido.";
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/verify-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.error || "Erro ao confirmar o email.";
            return;
        }

        message.textContent = `Email confirmado! Bem-vindo, ${data.name}.`;

    } catch (error) {
        console.error(error);
        message.textContent = "Erro ao ligar ao servidor.";
    }
}

verify();