async function getFeaturedCards() {

    try {

        const response = await fetch(`${API_BASE}/cards?q=charizard`);

        const cards = await response.json(); // a TCGdex devolve um array direto

        displayCards(cards);

    } catch (error) {

        console.error(error);

    }

}

function displayCards(cards) {

    const container = document.getElementById("featuredCards");

    container.innerHTML = "";

    cards.forEach(card => {

        const imageUrl = `${card.image}/low.webp`;

        container.innerHTML += `
            <div class="card">
                <img src="${imageUrl}">
                <h3>${card.name}</h3>
            </div>
        `;
    });

}

async function searchCards(name) {

    if (name.length < 2) {
        getFeaturedCards();
        return;
    }

    try {

        const response = await fetch(`${API_BASE}/cards?q=${encodeURIComponent(name)}`);

        if (!response.ok) {
            throw new Error(`Erro ${response.status}`);
        }

        const cards = await response.json();

        displayCards(cards);

    } catch (error) {

        console.error(error);

    }

}

getFeaturedCards();

const input = document.getElementById("searchInput");

let timeout;

input.addEventListener("input", () => {

    clearTimeout(timeout);

    timeout = setTimeout(() => {
        searchCards(input.value);
    }, 400);

});

// Enter leva a sério ao marketplace, filtrado pelo que a pessoa escreveu.
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim().length >= 2) {
        window.location.href = `marketplace.html?q=${encodeURIComponent(input.value.trim())}`;
    }
});