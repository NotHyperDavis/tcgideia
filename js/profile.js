const API_BASE = "http://localhost:3000";

const loading = document.getElementById("loading");
const errorContainer = document.getElementById("error");
const profileContent = document.getElementById("profileContent");

const profileName = document.getElementById("profileName");
const profileAvatar = document.getElementById("profileAvatar");
const memberSince = document.getElementById("memberSince");

const activeListings = document.getElementById("activeListings");
const sales = document.getElementById("sales");
const purchases = document.getElementById("purchases");

const listingOwner = document.getElementById("listingOwner");
const profileListings = document.getElementById("profileListings");
const noListings = document.getElementById("noListings");

const editProfileBtn = document.getElementById("editProfileBtn");
const editProfileSection = document.getElementById("editProfileSection");

const editProfileForm = document.getElementById("editProfileForm");
const editName = document.getElementById("editName");

const cancelEditBtn = document.getElementById("cancelEditBtn");
const editMessage = document.getElementById("editMessage");


const CONDITION_LABELS = {
    mint: "Mint",
    near_mint: "Near Mint",
    excellent: "Excelente",
    good: "Boa",
    played: "Usada",
    poor: "Danificada"
};


/*
Obter ID do utilizador através da URL

Exemplo:

profile.html?id=12
*/

const params = new URLSearchParams(window.location.search);
const profileId = params.get("id");


/*
Se não existir ID,
tentamos abrir o próprio perfil.
*/

async function getProfileId() {

    if (profileId) {
        return profileId;
    }

    const userRaw = localStorage.getItem("user");

    if (!userRaw) {
        return null;
    }

    try {
        const user = JSON.parse(userRaw);

        return user.id;

    } catch (error) {

        console.error(error);

        return null;
    }
}


/*
Formatar data
*/

function formatDate(date) {

    return new Date(date).toLocaleDateString(
        "pt-PT",
        {
            month: "long",
            year: "numeric"
        }
    );
}


/*
Primeira letra do nome
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


/*
Mostrar anúncios
*/

function renderListings(listings) {

    profileListings.innerHTML = "";

    if (!listings || listings.length === 0) {

        noListings.classList.remove("hidden");

        return;
    }

    noListings.classList.add("hidden");


    listings.forEach(listing => {

        const card = document.createElement("a");

        card.className = "profile-card";

        card.href = `product.html?id=${listing.id}`;


        const condition =
            CONDITION_LABELS[listing.condition]
            ?? listing.condition;


        card.innerHTML = `

            <img
                class="profile-card-image"
                src="${listing.card_image ?? ""}"
                alt="${listing.card_name}"
            >

            <h3>
                ${listing.card_name}
            </h3>

            <span class="profile-card-condition">
                ${condition}
            </span>

            <strong class="profile-card-price">
                ${Number(listing.price).toFixed(2)} €
            </strong>

        `;


        profileListings.appendChild(card);

    });

}


/*
Carregar perfil
*/

async function loadProfile() {

    const id = await getProfileId();

    if (!id) {

        loading.classList.add("hidden");

        errorContainer.classList.remove("hidden");

        return;
    }


    try {

        const response = await fetch(
            `${API_BASE}/users/${id}`
        );


        const data = await response.json();


        if (!response.ok) {
            throw new Error(
                data.error || "Erro ao carregar perfil."
            );
        }


        /*
        Perfil
        */

        profileName.textContent = data.name;

        profileAvatar.textContent =
            getInitial(data.name);

        memberSince.textContent =
            `Membro desde ${formatDate(data.created_at)}`;

        listingOwner.textContent =
            data.name;


        /*
        Estatísticas
        */

        activeListings.textContent =
            data.stats.active_listings;

        sales.textContent =
            data.stats.sales;

        purchases.textContent =
            data.stats.purchases;


        /*
        Verificar se é o próprio perfil
        */

        const loggedUserRaw =
            localStorage.getItem("user");

        if (loggedUserRaw) {

            try {

                const loggedUser =
                    JSON.parse(loggedUserRaw);


                if (
                    Number(loggedUser.id) ===
                    Number(data.id)
                ) {

                    editProfileBtn.classList.remove(
                        "hidden"
                    );

                    editName.value =
                        data.name;
                }

            } catch (error) {

                console.error(error);

            }

        }


        /*
        Anúncios
        */

        renderListings(
            data.active_listings
        );


        /*
        Mostrar página
        */

        loading.classList.add("hidden");

        profileContent.classList.remove(
            "hidden"
        );


    } catch (error) {

        console.error(error);

        loading.classList.add("hidden");

        errorContainer.classList.remove(
            "hidden"
        );

    }

}


/*
Abrir edição
*/

editProfileBtn.addEventListener(
    "click",
    () => {

        editProfileSection.classList.remove(
            "hidden"
        );

        editProfileSection.scrollIntoView({
            behavior: "smooth"
        });

    }
);


/*
Cancelar edição
*/

cancelEditBtn.addEventListener(
    "click",
    () => {

        editProfileSection.classList.add(
            "hidden"
        );

        editMessage.textContent = "";

    }
);


/*
Guardar alterações
*/

editProfileForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const token =
            localStorage.getItem("token");


        if (!token) {

            editMessage.textContent =
                "Precisas de iniciar sessão.";

            return;
        }


        const name =
            editName.value.trim();


        if (!name) {

            editMessage.textContent =
                "O nome não pode estar vazio.";

            return;
        }


        try {

            const response = await fetch(
                `${API_BASE}/users/me`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        name
                    })
                }
            );


            const data =
                await response.json();


            if (!response.ok) {

                editMessage.textContent =
                    data.error ||
                    "Erro ao atualizar perfil.";

                return;
            }


            /*
            Atualizar localStorage
            */

            const currentUser =
                JSON.parse(
                    localStorage.getItem("user")
                );


            currentUser.name =
                data.name;


            localStorage.setItem(
                "user",
                JSON.stringify(currentUser)
            );


            /*
            Atualizar página
            */

            profileName.textContent =
                data.name;

            profileAvatar.textContent =
                getInitial(data.name);

            listingOwner.textContent =
                data.name;


            editMessage.textContent =
                "Perfil atualizado com sucesso!";


            setTimeout(() => {

                editProfileSection.classList.add(
                    "hidden"
                );

                editMessage.textContent = "";

            }, 1000);


        } catch (error) {

            console.error(error);

            editMessage.textContent =
                "Erro ao ligar ao servidor.";

        }

    }
);


loadProfile();