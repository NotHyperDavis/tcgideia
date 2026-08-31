const API_BASE = "http://localhost:3000";

const params = new URLSearchParams(window.location.search);
const token = localStorage.getItem("token");

function getMyId() {
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.id;
    } catch (error) {
        console.error("Erro ao ler token:", error);
        return null;
    }
}

const urlId = params.get("id");
const myId = getMyId();

// Se não houver ID no URL, assumimos que é o perfil do próprio utilizador logado (/me)
const isMyProfile = !urlId || (myId && Number(urlId) === Number(myId));
const userId = urlId || myId;

const profileLoading = document.getElementById("profileLoading");
const profileError = document.getElementById("profileError");
const profileContent = document.getElementById("profileContent");

const profileAvatar = document.getElementById("profileAvatar");
const profileName = document.getElementById("profileName");
const memberSince = document.getElementById("memberSince");
const emailField = document.getElementById("email"); // Caso exista no teu HTML de edição

const activeListings = document.getElementById("activeListings");
const sales = document.getElementById("sales");
const purchases = document.getElementById("purchases");
const rating = document.getElementById("rating");

const profileListings = document.getElementById("profileListings");
const noListings = document.getElementById("noListings");
const listingCountText = document.getElementById("listingCountText");
const messageBtn = document.getElementById("messageBtn");

const editForm = document.getElementById("editForm");
const nameInput = document.getElementById("name");
const messageFeedback = document.getElementById("message");

const CONDITION_LABELS = {
    mint: "Mint",
    near_mint: "Near Mint",
    excellent: "Excelente",
    good: "Boa",
    played: "Usada",
    poor: "Danificada"
};

/*
--------------------------------------------------
UTILITÁRIOS
--------------------------------------------------
*/

function getInitial(name) {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
}

function formatMemberDate(date) {
    return new Date(date).toLocaleDateString("pt-PT", {
        year: "numeric",
        month: "long"
    });
}

/*
--------------------------------------------------
CARREGAR PERFIL
--------------------------------------------------
*/

async function loadProfile() {
    if (!userId) {
        showError();
        return;
    }

    try {
        // Se for o próprio perfil, usamos a rota protegida /users/me para ter acesso ao email e edição
        const endpoint = isMyProfile && token 
            ? `${API_BASE}/users/me` 
            : `${API_BASE}/users/${userId}`;

        const headers = {};
        if (isMyProfile && token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(endpoint, { headers });
        const user = await response.json();

        if (!response.ok) {
            showError();
            return;
        }

        /*
        Dados principais
        */
        if (profileName) profileName.textContent = user.name;
        if (nameInput) nameInput.value = user.name; // Preenche o input se existir formulário de edição
        if (emailField) emailField.textContent = user.email || "Não disponível";

        if (profileAvatar) profileAvatar.textContent = getInitial(user.name);
        if (memberSince) memberSince.textContent = `Membro desde ${formatMemberDate(user.created_at)}`;

        /*
        Estatísticas
        */
        const listings = user.active_listings || [];

        if (activeListings) activeListings.textContent = listings.length;
        if (sales) sales.textContent = user.stats?.sales ?? 0;
        if (purchases) purchases.textContent = user.stats?.purchases ?? 0;
        if (rating) rating.textContent = user.stats?.rating ?? "—";

        if (listingCountText) {
            listingCountText.textContent = listings.length === 1
                ? "1 carta disponível para venda"
                : `${listings.length} cartas disponíveis para venda`;
        }

        /*
        Botão de mensagem (apenas se for o perfil de outra pessoa)
        */
        if (token && myId && messageBtn && Number(myId) !== Number(user.id)) {
            messageBtn.classList.remove("hidden");
            messageBtn.addEventListener("click", () => startConversation(user.id));
        }

        /*
        Anúncios e Avaliações
        */
        renderListings(listings);
        loadReviews(user.id);

        /*
        Mostrar página
        */
        if (profileLoading) profileLoading.classList.add("hidden");
        if (profileContent) profileContent.classList.remove("hidden");

    } catch (error) {
        console.error(error);
        showError();
    }
}

/*
--------------------------------------------------
EDITAR PERFIL (Submissão do Formulário)
--------------------------------------------------
*/

if (editForm) {
    editForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!token) return;

        const newName = nameInput.value;

        try {
            const response = await fetch(`${API_BASE}/users/me`, {
                method: "PUT", // Ou PATCH, dependendo de como implementaste no teu backend
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ name: newName })
            });

            const data = await response.json();

            if (!response.ok) {
                if (messageFeedback) messageFeedback.textContent = data.error || "Erro ao atualizar perfil.";
                return;
            }

            if (messageFeedback) {
                messageFeedback.style.color = "#4ade80";
                messageFeedback.textContent = "Alterações guardadas com sucesso!";
                setTimeout(() => messageFeedback.textContent = "", 4000);
            }
            
            if (profileName) profileName.textContent = newName;
            if (profileAvatar) profileAvatar.textContent = getInitial(newName);

        } catch (error) {
            console.error(error);
            if (messageFeedback) messageFeedback.textContent = "Erro ao ligar ao servidor.";
        }
    });
}

/*
--------------------------------------------------
ANÚNCIOS
--------------------------------------------------
*/

function renderListings(listings) {
    if (!profileListings) return;
    profileListings.innerHTML = "";

    if (!listings || listings.length === 0) {
        if (noListings) noListings.classList.remove("hidden");
        return;
    }

    if (noListings) noListings.classList.add("hidden");

    listings.forEach(listing => {
        const card = document.createElement("a");
        card.className = "profile-listing-card";
        card.href = `product.html?id=${listing.id}`;

        const condition = CONDITION_LABELS[listing.condition] ?? listing.condition ?? "—";

        card.innerHTML = `
            <div class="profile-card-image-wrapper">
                <img src="${listing.card_image ?? ""}" alt="${listing.card_name}" class="profile-card-image">
            </div>
            <div class="profile-card-info">
                <h3>${listing.card_name}</h3>
                <span class="profile-card-condition">${condition}</span>
                <strong class="profile-card-price">${Number(listing.price).toFixed(2)} €</strong>
            </div>
        `;

        profileListings.appendChild(card);
    });
}

/*
--------------------------------------------------
ERRO
--------------------------------------------------
*/

function showError() {
    if (profileLoading) profileLoading.classList.add("hidden");
    if (profileError) profileError.classList.remove("hidden");
}

/*
--------------------------------------------------
MENSAGENS
--------------------------------------------------
*/

async function startConversation(otherUserId) {
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE}/conversations`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ other_user_id: otherUserId })
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

/*
--------------------------------------------------
AVALIAÇÕES
--------------------------------------------------
*/

function renderStars(rating) {
    const rounded = Math.round(rating);
    return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}

async function loadReviews(profileUserId) {
    const reviewsSummary = document.getElementById("reviewsSummary");
    const reviewsList = document.getElementById("reviewsList");
    const noReviews = document.getElementById("noReviews");

    if (!reviewsSummary || !reviewsList) return;

    try {
        const response = await fetch(`${API_BASE}/reviews/user/${profileUserId}`);
        const data = await response.json();

        if (!response.ok) {
            reviewsSummary.innerHTML = "<p>Erro ao carregar avaliações.</p>";
            return;
        }

        if (data.total === 0) {
            reviewsSummary.innerHTML = "";
            if (noReviews) noReviews.classList.remove("hidden");
            return;
        }

        reviewsSummary.innerHTML = `
            <p><strong>${renderStars(data.average)}</strong> ${data.average} / 5 (${data.total} avaliaç${data.total === 1 ? "ão" : "ões"})</p>
        `;

        reviewsList.innerHTML = data.reviews.map(review => `
            <div class="review-item">
                <p><strong>${review.reviewer_name}</strong> — ${renderStars(review.rating)}</p>
                ${review.comment ? `<p>${review.comment}</p>` : ""}
                <small>${new Date(review.created_at).toLocaleDateString("pt-PT")}</small>
            </div>
        `).join("");

    } catch (error) {
        console.error(error);
        reviewsSummary.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

loadProfile();