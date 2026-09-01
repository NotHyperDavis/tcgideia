const form = document.getElementById("registerForm");
const message = document.getElementById("message");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    message.textContent = "";

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.error || "Erro ao criar conta.";
            message.className = "error";
            return;
        }

        message.textContent = "Conta criada! Enviámos-te um email para confirmares a tua conta. A redirecionar para o login...";
        message.className = "success";

        setTimeout(() => {
            window.location.href = "login.html";
        }, 2500);

    } catch (error) {
        console.error(error);
        message.textContent = "Erro ao ligar ao servidor.";
        message.className = "error";
    }
});