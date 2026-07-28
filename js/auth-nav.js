// Inclui este script em todas as páginas (marketplace, product, sell, etc.)
// Atualiza o link "Entrar" do header para mostrar o nome do utilizador + "Sair", se estiver logado.

function updateAuthNav() {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");

    const loginLink = document.querySelector('nav a[href="login.html"]');
    if (!loginLink) return;

    if (token && userRaw) {
        const user = JSON.parse(userRaw);

        loginLink.textContent = `Olá, ${user.name}`;
        loginLink.removeAttribute("href");
        loginLink.style.cursor = "default";

        const logoutBtn = document.createElement("a");
        logoutBtn.href = "#";
        logoutBtn.textContent = "Sair";
        logoutBtn.id = "logoutBtn";

        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "marketplace.html";
        });

        loginLink.insertAdjacentElement("afterend", logoutBtn);
    }
}

updateAuthNav();