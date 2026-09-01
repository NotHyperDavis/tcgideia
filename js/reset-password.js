const params = new URLSearchParams(window.location.search);
const token = params.get("token");

const form = document.getElementById("resetForm");
const message = document.getElementById("message");

if (!token) {
    message.textContent = "Link inválido. Pede uma nova reposição em 'Esqueceste-te da password?'.";
    form.style.display = "none";
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = document.getElementById("password").value;
    const passwordConfirm = document.getElementById("passwordConfirm").value;

    if (password !== passwordConfirm) {
        message.textContent = "As passwords não coincidem.";
        return;
    }

    message.textContent = "A repor...";

    try {
        const response = await fetch(`${API_BASE}/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.error || "Erro ao repor a password.";
            return;
        }

        message.textContent = "Password reposta! A redirecionar para o login...";
        setTimeout(() => { window.location.href = "login.html"; }, 1500);

    } catch (error) {
        console.error(error);
        message.textContent = "Erro ao ligar ao servidor.";
    }
});