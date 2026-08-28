function updateAuthNav() {

    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");

    const loginLink = document.querySelector(
        'nav a[href="login.html"]'
    );

    if (!loginLink) {
        return;
    }

    if (token && userRaw) {

        try {

            const user = JSON.parse(userRaw);

            // "Entrar" passa a ser "Olá, David"
            loginLink.textContent = `Olá, ${user.name}`;

            // Ao clicar vai para o perfil
            loginLink.href = `profile.html?id=${user.id}`;

            /*
            Criar botão Sair
            */

            if (!document.getElementById("logoutBtn")) {

                const logoutBtn = document.createElement("a");

                logoutBtn.href = "#";
                logoutBtn.textContent = "Sair";
                logoutBtn.id = "logoutBtn";

                logoutBtn.addEventListener("click", (e) => {

                    e.preventDefault();

                    localStorage.removeItem("token");
                    localStorage.removeItem("user");

                    window.location.href = "main.html";

                });

                loginLink.insertAdjacentElement(
                    "afterend",
                    logoutBtn
                );
            }

        } catch (error) {

            console.error(error);

        }
    }
}

updateAuthNav();