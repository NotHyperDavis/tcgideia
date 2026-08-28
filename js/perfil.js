const API_BASE = "http://localhost:3000"; // troca pelo domínio real quando publicares o site

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = localStorage.getItem("token");

const profileEl = document.getElementById("profile");
const profileListingsEl = document.getElementById("profileListings");

const CONDITION_LABELS = {
    mint: "Mint",
    near_mint: "Near Mint",
    excellent: "Excelente",
    good: "Boa",
    played: "Usada",
    poor: "Danificada",
};

async function loadProfile() {

    if (!userId) {
        profileEl.innerHTML = "<p>Perfil não encontrado.</p>";
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/users/${userId}`);
        const user = await response.json();

        if (!response.ok) {
            profileEl.innerHTML = `<p>${user.error || "Perfil não encontrado."}</p>`;
            return;
        }

        const memberSince = new Date(user.created_at).toLocaleDateString("pt-PT", { year: "numeric", month: "long" });

        profileEl.innerHTML = `
            <h1>${user.name}</h1>
            <p>Membro desde ${memberSince}</p>
            ${token && Number(userId) !== getMyId() ? `<button id="messageBtn">Enviar mensagem</button>` : ""}
        `;

        document.getElementById("messageBtn")?.addEventListener("click", () => startConversation(user.id));

        if (user.active_listings.length === 0) {
            profileListingsEl.innerHTML = "<p>Sem anúncios ativos neste momento.</p>";
        } else {
            profileListingsEl.innerHTML = "";
            user.active_listings.forEach(listing => {
                profileListingsEl.innerHTML += `
                    <a href="product.html?id=${listing.id}" class="card">
                        <img src="${listing.card_image ?? ""}">
                        <h3>${listing.card_name}</h3>
                        <span>${CONDITION_LABELS[listing.condition] ?? listing.condition}</span>
                        <strong>${Number(listing.price).toFixed(2)} €</strong>
                    </a>
                `;
            });
        }

    } catch (error) {
        console.error(error);
        profileEl.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

// Descodifica o id do utilizador autenticado a partir do token, só para
// evitarmos mostrar o botão "Enviar mensagem" na tua própria página de perfil.
function getMyId() {
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.id;
    } catch {
        return null;
    }
}

async function startConversation(otherUserId) {
    try {
        const response = await fetch(`${API_BASE}/conversations`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ other_user_id: otherUserId }),
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Erro ao iniciar conversa.");
            return;
        }

        window.location.href = `mensagens.html?conversation=${data.id}`;

    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
    }
}

loadProfile();