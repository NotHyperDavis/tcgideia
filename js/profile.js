const API_BASE = "http://localhost:3000"; // troca pelo domínio real quando publicares o site

const token = localStorage.getItem("token");

const loginWarning = document.getElementById("loginWarning");
const profileFlow = document.getElementById("profileFlow");
const message = document.getElementById("message");

if (!token) {
    loginWarning.style.display = "block";
    profileFlow.style.display = "none";
} else {
    loadMyProfile();
}

async function loadMyProfile() {
    try {
        const response = await fetch(`${API_BASE}/users/me`, {
            headers: { "Authorization": `Bearer ${token}` },
        });

        const user = await response.json();

        if (!response.ok) {
            profileFlow.innerHTML = `<p>${user.error || "Erro ao carregar perfil."}</p>`;
            return;
        }

        document.getElementById("email").textContent = user.email;
        document.getElementById("name").value = user.name;
        document.getElementById("memberSince").textContent = new Date(user.created_at)
            .toLocaleDateString("pt-PT", { year: "numeric", month: "long" });

    } catch (error) {
        console.error(error);
        profileFlow.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

document.getElementById("editForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value;
    message.textContent = "A guardar...";

    try {
        const response = await fetch(`${API_BASE}/users/me`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ name }),
        });

        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.error || "Erro ao guardar.";
            return;
        }

        message.textContent = "Guardado!";
        setTimeout(() => { message.textContent = ""; }, 2000);

    } catch (error) {
        console.error(error);
        message.textContent = "Erro ao ligar ao servidor.";
    }
});