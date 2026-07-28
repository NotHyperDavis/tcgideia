const container = document.getElementById("marketCards");

async function loadCards(){

    const response = await fetch(
        "http://localhost:3000/cards"
    );

    const data = await response.json();

    container.innerHTML = "";

    data.data.forEach(card=>{

        container.innerHTML += `

        <a href="product.html?id=${card.id}" class="card">

        <img src="${card.images.small}">

        <h3>${card.name}</h3>

        <p>${card.set.name}</p>

        <span>${card.rarity ?? "Sem raridade"}</span>

        </a>
    `;

    });

}

loadCards();