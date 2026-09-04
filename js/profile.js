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

        // --- ATUALIZAÇÃO DOS ELEMENTOS DO TOPO DO PERFIL ---
        const displayNameEl = document.getElementById("profileDisplayName");
        const profileCountryEl = document.getElementById("profileCountry");
        const heroRatingEl = document.getElementById("heroRating");

        if (displayNameEl) {
            displayNameEl.textContent = user.name || "Utilizador";
        }

        if (profileCountryEl) {
            const countries = {
                PT: "🇵🇹 Portugal",
                ES: "🇪🇸 Espanha"
            };

            profileCountryEl.textContent = countries[user.country] || user.country || "🌍";
        }
        // --------------------------------------------------

        document.getElementById("email").textContent = user.email;
        document.getElementById("name").value = user.name;
        document.getElementById("country").value = user.country || "PT";
        document.getElementById("addressName").value = user.address_name || "";
        document.getElementById("addressLine").value = user.address_line || "";
        document.getElementById("addressPostalCode").value = user.address_postal_code || "";
        document.getElementById("addressCity").value = user.address_city || "";
        document.getElementById("accountTypeDisplay").textContent = (user.account_type === "store") ? "🏪 Loja" : "🟢 Particular";
        document.getElementById("memberSince").textContent = "Membro desde " + new Date(user.created_at)
            .toLocaleDateString("pt-PT", { year: "numeric", month: "long" });

        const statusBadge = document.getElementById("profileStatusBadge");
        if (statusBadge) {
            if (user.is_suspended) {
                statusBadge.classList.add("profile-status--suspended");
                statusBadge.innerHTML = `<span></span> Conta Suspensa`;
            } else {
                statusBadge.classList.remove("profile-status--suspended");
                statusBadge.innerHTML = `<span></span> Conta ativa`;
            }
        }

        const strikesWarning = document.getElementById("profileStrikesWarning");
        if (strikesWarning) {
            const strikeMessages = [];
            if (user.late_shipment_strikes > 0) {
                strikeMessages.push(`⚠️ ${user.late_shipment_strikes}/3 avisos de envio em atraso (vendedor)`);
            }
            if (user.late_payment_strikes > 0) {
                strikeMessages.push(`⚠️ ${user.late_payment_strikes}/3 avisos de pagamento em atraso (comprador)`);
            }

            if (strikeMessages.length > 0) {
                strikesWarning.innerHTML = strikeMessages.join(" · ");
                strikesWarning.style.display = "block";
            } else {
                strikesWarning.style.display = "none";
            }
        }

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

        if (heroRatingEl) heroRatingEl.textContent = user.stats?.rating ?? "—";

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
    const country = document.getElementById("country").value;
    const address_name = document.getElementById("addressName").value;
    const address_line = document.getElementById("addressLine").value;
    const address_postal_code = document.getElementById("addressPostalCode").value;
    const address_city = document.getElementById("addressCity").value;

    if (address_postal_code) {
        const isValidPostalCode = country === "PT"
            ? /^\d{4}-\d{3}$/.test(address_postal_code)
            : /^\d{5}$/.test(address_postal_code);

        if (!isValidPostalCode) {
            message.textContent = country === "PT"
                ? "Código postal português inválido — tem de ter o formato 0000-000."
                : "Código postal espanhol inválido — tem de ter 5 dígitos.";
            message.className = "error";
            return;
        }
    }

    message.textContent = "A guardar...";

    try {
        const response = await fetch(`${API_BASE}/users/me`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ name, country, address_name, address_line, address_postal_code, address_city }),
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

        // Atualizar também o topo do perfil após submeter o formulário de edição
        const displayNameEl = document.getElementById("profileDisplayName");
        if (displayNameEl) {
            displayNameEl.textContent = name.trim() || "Utilizador";
        }

        setTimeout(() => { message.textContent = ""; }, 2000);

    } catch (error) {
        console.error(error);
        message.textContent = "Erro ao ligar ao servidor.";
    }
});

document.getElementById("exportDataBtn")?.addEventListener("click", async () => {
    const gdprMessage = document.getElementById("gdprMessage");
    gdprMessage.textContent = "A preparar o ficheiro...";

    try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE}/users/me/export`, {
            headers: { "Authorization": `Bearer ${token}` },
        });

        if (!response.ok) {
            gdprMessage.textContent = "Erro ao exportar os dados.";
            return;
        }

        const data = await response.json();
        const html = buildExportHtml(data);
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "os-meus-dados-tcgmarketportugal.html";
        a.click();
        URL.revokeObjectURL(url);

        gdprMessage.textContent = "Descarregado! Abre o ficheiro com duplo-clique.";
        setTimeout(() => { gdprMessage.textContent = ""; }, 4000);

    } catch (error) {
        console.error(error);
        gdprMessage.textContent = "Erro ao ligar ao servidor.";
    }
});

function buildExportHtml(data) {
    const esc = (v) => String(v ?? "").replace(/</g, "&lt;");

    const table = (rows, columns) => {
        if (!rows || rows.length === 0) return "<p><em>Nada aqui.</em></p>";
        return `
            <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
                <thead><tr>${columns.map(c => `<th style="text-align:left; padding:8px; border-bottom:2px solid #DDD6C8; font-size:13px;">${c.label}</th>`).join("")}</tr></thead>
                <tbody>
                    ${rows.map(row => `<tr>${columns.map(c => `<td style="padding:8px; border-bottom:1px solid #EEE9DE; font-size:13px;">${esc(typeof c.value === "function" ? c.value(row) : row[c.value])}</td>`).join("")}</tr>`).join("")}
                </tbody>
            </table>
        `;
    };

    return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="UTF-8">
<title>Os meus dados — TCGMarketPortugal</title>
<style>
    body { font-family: -apple-system, Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #201D1A; background: #F5F1E8; }
    h1 { color: #8B1E2D; }
    h2 { margin-top: 40px; border-bottom: 2px solid #8B1E2D; padding-bottom: 6px; }
    .box { background: #FFFFFF; border: 1px solid #DDD6C8; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
</style>
</head>
<body>
    <h1>Os meus dados — TCGMarketPortugal</h1>
    <p>Exportado em ${new Date(data.exported_at).toLocaleString("pt-PT")}</p>

    <h2>Perfil</h2>
    <div class="box">
        <p><strong>Nome:</strong> ${esc(data.profile?.name)}</p>
        <p><strong>Email:</strong> ${esc(data.profile?.email)}</p>
        <p><strong>País:</strong> ${esc(data.profile?.country)}</p>
        <p><strong>Tipo de conta:</strong> ${esc(data.profile?.account_type)}</p>
        <p><strong>Membro desde:</strong> ${data.profile?.created_at ? new Date(data.profile.created_at).toLocaleDateString("pt-PT") : "—"}</p>
        <p><strong>Morada:</strong> ${esc(data.profile?.address_line)} ${esc(data.profile?.address_postal_code)} ${esc(data.profile?.address_city)}</p>
    </div>

    <h2>Os meus anúncios (${data.listings?.length ?? 0})</h2>
    ${table(data.listings, [
        { label: "Carta", value: "card_name" },
        { label: "Preço", value: (r) => `${Number(r.price).toFixed(2)} €` },
        { label: "Estado", value: "status" },
        { label: "Criado em", value: (r) => new Date(r.created_at).toLocaleDateString("pt-PT") },
    ])}

    <h2>As minhas compras (${data.purchases?.length ?? 0})</h2>
    ${table(data.purchases, [
        { label: "Encomenda", value: "id" },
        { label: "Total", value: (r) => `${Number(r.total_price).toFixed(2)} €` },
        { label: "Estado", value: "status" },
        { label: "Data", value: (r) => new Date(r.created_at).toLocaleDateString("pt-PT") },
    ])}

    <h2>As minhas vendas (${data.sales?.length ?? 0})</h2>
    ${table(data.sales, [
        { label: "Encomenda", value: "id" },
        { label: "Total", value: (r) => `${Number(r.total_price).toFixed(2)} €` },
        { label: "Estado", value: "status" },
        { label: "Data", value: (r) => new Date(r.created_at).toLocaleDateString("pt-PT") },
    ])}

    <h2>As minhas avaliações (${data.reviews?.length ?? 0})</h2>
    ${table(data.reviews, [
        { label: "Nota", value: (r) => `${r.rating} ★` },
        { label: "Comentário", value: "comment" },
        { label: "Data", value: (r) => new Date(r.created_at).toLocaleDateString("pt-PT") },
    ])}

    <h2>A minha lista de desejos (${data.wishlist?.length ?? 0})</h2>
    ${table(data.wishlist, [
        { label: "Carta", value: "card_name" },
        { label: "Adicionada em", value: (r) => new Date(r.created_at).toLocaleDateString("pt-PT") },
    ])}

</body>
</html>`;
}

document.getElementById("deleteAccountBtn")?.addEventListener("click", async () => {
    const gdprMessage = document.getElementById("gdprMessage");

    const confirmed = confirm(
        "Tens a certeza que queres apagar a tua conta? Isto não pode ser desfeito. " +
        "Os teus dados pessoais serão removidos, e os teus anúncios ativos serão retirados."
    );
    if (!confirmed) return;

    const doubleConfirmed = confirm("Última confirmação: apagar a conta definitivamente?");
    if (!doubleConfirmed) return;

    try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE}/users/me`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` },
        });

        const data = await response.json();

        if (!response.ok) {
            gdprMessage.textContent = data.error || "Erro ao apagar a conta.";
            return;
        }

        localStorage.removeItem("token");
        localStorage.removeItem("user");
        alert("A tua conta foi apagada. Vais ser redirecionado.");
        window.location.href = "main.html";

    } catch (error) {
        console.error(error);
        gdprMessage.textContent = "Erro ao ligar ao servidor.";
    }
});