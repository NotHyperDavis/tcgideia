const form = document.getElementById("loginForm");
const message = document.getElementById("message");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    message.textContent = "";

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.error || "Erro ao entrar.";
            message.className = "error";
            return;
        }

        // Guarda o token e os dados do utilizador para usar noutras páginas
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        message.textContent = "Login efetuado! A redirecionar...";
        message.className = "success";

        setTimeout(() => {
            window.location.href = "marketplace.html";
        }, 1000);

    } catch (error) {
        console.error(error);
        message.textContent = "Erro ao ligar ao servidor.";
        message.className = "error";
    }
});