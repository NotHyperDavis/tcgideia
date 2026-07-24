const API_URL = "https://api.pokemontcg.io/v2/cards";

async function getFeaturedCards() {

    try {

        const response = await fetch("https://api.pokemontcg.io/v2/cards?q=name:charizard");

        console.log(response.status);

        const data = await response.json();

        console.log(data);

        displayCards(data.data);

    } catch (error) {

        console.error(error);

    }

}

function displayCards(cards){

    const container = document.getElementById("featuredCards");

    container.innerHTML = "";

    cards.forEach(card => {

        container.innerHTML += `
            <div class="card">
                <img src="${card.images.small}">
                <h3>${card.name}</h3>
                <p>${card.set.name}</p>
                <span>${card.rarity ?? "Sem raridade"}</span>
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

        const response = await fetch(
            `https://api.pokemontcg.io/v2/cards?q=name:"${name}"`
        );

        if (!response.ok) {
            throw new Error(`Erro ${response.status}`);
        }

        const data = await response.json();

        displayCards(data.data);

    } catch (error) {

        console.error(error);

    }

}

getFeaturedCards();

const input = document.getElementById("searchInput");

input.addEventListener("input", () => {

    searchCards(input.value);

});

let timeout;

input.addEventListener("input", () => {

    clearTimeout(timeout);

    timeout = setTimeout(() => {

        searchCards(input.value);

    }, 400);

});