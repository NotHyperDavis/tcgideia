const API_BASE = "http://localhost:3000";

const params = new URLSearchParams(window.location.search);

const token = localStorage.getItem("token");

function getMyId() {
    if (!token) {
        return null;
    }

    try {
        const payload = JSON.parse(
            atob(token.split(".")[1])
        );

        return payload.id;
    } catch (error) {
        console.error("Erro ao ler token:", error);
        return null;
    }
}

const userId = params.get("id") || getMyId()


const profileLoading =
    document.getElementById("profileLoading");

const profileError =
    document.getElementById("profileError");

const profileContent =
    document.getElementById("profileContent");


const profileAvatar =
    document.getElementById("profileAvatar");

const profileName =
    document.getElementById("profileName");

const memberSince =
    document.getElementById("memberSince");


const activeListings =
    document.getElementById("activeListings");

const sales =
    document.getElementById("sales");

const purchases =
    document.getElementById("purchases");

const rating =
    document.getElementById("rating");


const profileListings =
    document.getElementById("profileListings");

const noListings =
    document.getElementById("noListings");

const listingCountText =
    document.getElementById("listingCountText");


const messageBtn =
    document.getElementById("messageBtn");


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

    if (!name) {
        return "?";
    }

    return name
        .trim()
        .charAt(0)
        .toUpperCase();

}


function formatMemberDate(date) {

    return new Date(date).toLocaleDateString(
        "pt-PT",
        {
            year: "numeric",
            month: "long"
        }
    );

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

        const response =
            await fetch(
                `${API_BASE}/users/${userId}`
            );


        const user =
            await response.json();


        if (!response.ok) {

            showError();

            return;

        }


        /*
        Dados principais
        */

        profileName.textContent =
            user.name;


        profileAvatar.textContent =
            getInitial(user.name);


        memberSince.textContent =
            `Membro desde ${formatMemberDate(user.created_at)}`;


        /*
        Estatísticas
        */

        const listings =
            user.active_listings || [];


        activeListings.textContent =
            listings.length;


        sales.textContent =
            user.stats?.sales ?? 0;


        purchases.textContent =
            user.stats?.purchases ?? 0;


        rating.textContent =
            user.stats?.rating ?? "—";


        listingCountText.textContent =
            listings.length === 1
                ? "1 carta disponível para venda"
                : `${listings.length} cartas disponíveis para venda`;


        /*
        Botão de mensagem
        */

        const myId =
            getMyId();


        if (
            token &&
            myId &&
            Number(myId) !== Number(user.id)
        ) {

            messageBtn.classList.remove(
                "hidden"
            );


            messageBtn.addEventListener(
                "click",
                () => startConversation(user.id)
            );

        }


        /*
        Anúncios
        */

        renderListings(listings);


        /*
        Avaliações
        */

        loadReviews(user.id);


        /*
        Mostrar página
        */

        profileLoading.classList.add(
            "hidden"
        );

        profileContent.classList.remove(
            "hidden"
        );


    } catch (error) {

        console.error(error);

        showError();

    }

}


/*
--------------------------------------------------
ANÚNCIOS
--------------------------------------------------
*/

function renderListings(listings) {

    profileListings.innerHTML = "";


    if (
        !listings ||
        listings.length === 0
    ) {

        noListings.classList.remove(
            "hidden"
        );

        return;

    }


    noListings.classList.add(
        "hidden"
    );


    listings.forEach(listing => {

        const card =
            document.createElement("a");


        card.className =
            "profile-listing-card";


        card.href =
            `product.html?id=${listing.id}`;


        const condition =
            CONDITION_LABELS[
                listing.condition
            ] ?? listing.condition ?? "—";


        card.innerHTML = `

            <div class="profile-card-image-wrapper">

                <img
                    src="${listing.card_image ?? ""}"
                    alt="${listing.card_name}"
                    class="profile-card-image"
                >

            </div>


            <div class="profile-card-info">

                <h3>
                    ${listing.card_name}
                </h3>


                <span class="profile-card-condition">
                    ${condition}
                </span>


                <strong class="profile-card-price">
                    ${Number(listing.price).toFixed(2)} €
                </strong>

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

    profileLoading.classList.add(
        "hidden"
    );

    profileError.classList.remove(
        "hidden"
    );

}


/*
--------------------------------------------------
MENSAGENS
--------------------------------------------------
*/

async function startConversation(
    otherUserId
) {

    if (!token) {

        return;

    }


    try {

        const response =
            await fetch(
                `${API_BASE}/conversations`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        other_user_id:
                            otherUserId
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.error ||
                "Erro ao iniciar conversa."
            );

            return;

        }


        window.location.href =
            `mensagens.html?conversation=${data.id}`;


    } catch (error) {

        console.error(error);

        alert(
            "Erro ao ligar ao servidor."
        );

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

    try {
        const response = await fetch(`${API_BASE}/reviews/user/${profileUserId}`);
        const data = await response.json();

        if (!response.ok) {
            reviewsSummary.innerHTML = "<p>Erro ao carregar avaliações.</p>";
            return;
        }

        if (data.total === 0) {
            reviewsSummary.innerHTML = "";
            noReviews.classList.remove("hidden");
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