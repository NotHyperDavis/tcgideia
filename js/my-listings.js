const API_BASE = "http://localhost:3000"; // troca pelo domínio real quando publicares o site

const token = localStorage.getItem("token");

const loginWarning = document.getElementById("loginWarning");
const listingsContainer = document.getElementById("listings");

const CONDITION_LABELS = {
    mint: "Mint",
    near_mint: "Near Mint",
    excellent: "Excelente",
    good: "Boa",
    played: "Usada",
    poor: "Danificada",
};

const STATUS_LABELS = {
    active: "Ativo",
    sold: "Vendido",
    removed: "Removido",
};

if (!token) {
    loginWarning.style.display = "block";
} else {
    loadMyListings();
}

async function loadMyListings() {
    listingsContainer.innerHTML = "<p>A carregar...</p>";

    try {
        const response = await fetch(`${API_BASE}/listings/mine`, {
            headers: { "Authorization": `Bearer ${token}` },
        });

        if (!response.ok) {
            listingsContainer.innerHTML = "<p>Erro ao carregar os teus anúncios.</p>";
            return;
        }

        const listings = await response.json();

        if (listings.length === 0) {
            listingsContainer.innerHTML = "<p>Ainda não tens nenhum anúncio. <a href='sell.html'>Vender uma carta</a>.</p>";
            return;
        }

        listingsContainer.innerHTML = "";
        listings.forEach(renderListing);

    } catch (error) {
        console.error(error);
        listingsContainer.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

function renderListing(listing) {
    const el = document.createElement("div");
    el.className = "listing-row";
    el.dataset.id = listing.id;

    el.innerHTML = `
        <img src="${listing.card_image ?? ""}">

        <div class="listing-info">
            <h3>${listing.card_name}</h3>
            <p>Estado: <strong>${STATUS_LABELS[listing.status] ?? listing.status}</strong></p>
        </div>

        <div class="listing-edit">
            <label>Preço (€)</label>
            <input type="number" step="0.01" min="0.01" class="edit-price" value="${listing.price}">

            <label>Condição</label>
            <select class="edit-condition">
                ${Object.entries(CONDITION_LABELS).map(([value, label]) =>
                    `<option value="${value}" ${value === listing.condition ? "selected" : ""}>${label}</option>`
                ).join("")}
            </select>

            <label>Quantidade</label>
            <input type="number" min="1" class="edit-quantity" value="${listing.quantity}">

            <label>Estado</label>
            <select class="edit-status">
                ${Object.entries(STATUS_LABELS).map(([value, label]) =>
                    `<option value="${value}" ${value === listing.status ? "selected" : ""}>${label}</option>`
                ).join("")}
            </select>
        </div>

        <div class="listing-actions">
            <button class="save-btn">Guardar alterações</button>
            <button class="delete-btn">Remover anúncio</button>
        </div>

        <p class="listing-message"></p>
    `;

    el.querySelector(".save-btn").addEventListener("click", () => saveListing(el, listing.id));
    el.querySelector(".delete-btn").addEventListener("click", () => deleteListing(el, listing.id));

    listingsContainer.appendChild(el);
}

async function saveListing(el, id) {
    const messageEl = el.querySelector(".listing-message");
    messageEl.textContent = "A guardar...";

    const body = {
        price: el.querySelector(".edit-price").value,
        condition: el.querySelector(".edit-condition").value,
        quantity: el.querySelector(".edit-quantity").value,
        status: el.querySelector(".edit-status").value,
    };

    try {
        const response = await fetch(`${API_BASE}/listings/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            messageEl.textContent = data.error || "Erro ao guardar alterações.";
            return;
        }

        messageEl.textContent = "Guardado!";
        setTimeout(() => { messageEl.textContent = ""; }, 2000);

    } catch (error) {
        console.error(error);
        messageEl.textContent = "Erro ao ligar ao servidor.";
    }
}

async function deleteListing(el, id) {
    const confirmed = confirm("Tens a certeza que queres remover este anúncio? Não é possível desfazer.");
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_BASE}/listings/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` },
        });

        const data = await response.json();

        if (!response.ok) {
            el.querySelector(".listing-message").textContent = data.error || "Erro ao remover anúncio.";
            return;
        }

        el.remove();

    } catch (error) {
        console.error(error);
        el.querySelector(".listing-message").textContent = "Erro ao ligar ao servidor.";
    }
}