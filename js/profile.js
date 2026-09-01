const token = localStorage.getItem("token");

const loginWarning = document.getElementById("loginWarning");
const profileFlow = document.getElementById("profileFlow");
const message = document.getElementById("message");

const CONDITION_LABELS = {
    mint: "Mint",
    near_mint: "Near Mint",
    excellent: "Excelente",
    good: "Boa",
    played: "Usada",
    poor: "Danificada"
};

if (!token) {
    if (loginWarning) loginWarning.style.display = "block";
    if (profileFlow) profileFlow.style.display = "none";
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
        document.getElementById("memberSince").textContent = "Membro desde " + new Date(user.created_at)
            .toLocaleDateString("pt-PT", { year: "numeric", month: "long" });

        const avatarEl = document.getElementById("profileAvatar");
        if (avatarEl) {
            avatarEl.textContent = user.name ? user.name.trim().charAt(0).toUpperCase() : "?";
        }

        const listings = user.active_listings || [];
        
        const activeListingsEl = document.getElementById("activeListings");
        const salesEl = document.getElementById("sales");
        const purchasesEl = document.getElementById("purchases");
        const ratingEl = document.getElementById("rating");
        const listingCountTextEl = document.getElementById("listingCountText");

        if (activeListingsEl) activeListingsEl.textContent = listings.length;
        if (salesEl) salesEl.textContent = user.stats?.sales ?? 0;
        if (purchasesEl) purchasesEl.textContent = user.stats?.purchases ?? 0;
        if (ratingEl) ratingEl.textContent = user.stats?.rating ?? "—";

        if (listingCountTextEl) {
            listingCountTextEl.textContent = listings.length === 1
                ? "1 carta disponível para venda"
                : `${listings.length} cartas disponíveis para venda`;
        }

        renderListings(listings);
        loadReviews(user.id);

    } catch (error) {
        console.error(error);
        if (profileFlow) profileFlow.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

function renderListings(listings) {
    const profileListings = document.getElementById("profileListings");
    const noListings = document.getElementById("noListings");

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

function renderStars(rating) {
    const rounded = Math.round(rating);
    return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}

async function loadReviews(profileUserId) {
    const reviewsSummary = document.getElementById("reviewsSummary");
    const reviewsList = document.getElementById("reviewsList");
    const noReviews = document.getElementById("noReviews");

    if (!reviewsList) return;

    try {
        const response = await fetch(`${API_BASE}/reviews/user/${profileUserId}`);
        const data = await response.json();

        if (!response.ok) {
            if (reviewsSummary) reviewsSummary.innerHTML = "<p>Erro ao carregar avaliações.</p>";
            return;
        }

        if (!data.reviews || data.reviews.length === 0) {
            if (reviewsSummary) reviewsSummary.innerHTML = "";
            if (noReviews) noReviews.classList.remove("hidden");
            return;
        }

        if (noReviews) noReviews.classList.add("hidden");

        if (reviewsSummary) {
            reviewsSummary.innerHTML = `
                <p><strong>${renderStars(data.average)}</strong> ${data.average} / 5 (${data.total} avaliaç${data.total === 1 ? "ão" : "ões"})</p>
            `;
        }

        reviewsList.innerHTML = data.reviews.map(review => {
            // Distingue se a avaliação foi feita por ti ou recebida por ti
            const isAuthor = review.reviewer_id === Number(profileUserId);
            const label = isAuthor 
                ? `Avalieste <strong>${review.reviewed_user_name || "um utilizador"}</strong>` 
                : `Avaliação de <strong>${review.reviewer_name || "um utilizador"}</strong>`;

            return `
                <div class="review-item" style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                    <p style="margin: 0 0 5px 0;">${label} — <span style="color: #f39c12;">${renderStars(review.rating)}</span> (${review.rating}/5)</p>
                    ${review.comment ? `<p style="margin: 5px 0; color: #ccc;">"${review.comment}"</p>` : ""}
                    <small style="color: #888;">${new Date(review.created_at).toLocaleDateString("pt-PT")}</small>
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error(error);
        if (reviewsSummary) reviewsSummary.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
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
        
        const avatarEl = document.getElementById("profileAvatar");
        if (avatarEl) {
            avatarEl.textContent = name.trim().charAt(0).toUpperCase();
        }

        setTimeout(() => { message.textContent = ""; }, 2000);

    } catch (error) {
        console.error(error);
        message.textContent = "Erro ao ligar ao servidor.";
    }
});