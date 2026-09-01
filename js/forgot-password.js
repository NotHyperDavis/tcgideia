const form = document.getElementById("forgotForm");
const message = document.getElementById("message");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    message.textContent = "A enviar...";

    try {
        const response = await fetch(`${API_BASE}/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.error || "Erro ao processar o pedido.";
            return;
        }

        message.textContent = "Se esse email tiver conta no TCG Ideia, vais receber um link para repores a password.";
        form.reset();

    } catch (error) {
        console.error(error);
        message.textContent = "Erro ao ligar ao servidor.";
    }
});