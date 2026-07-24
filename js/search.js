async function searchCard() {

    const search = document.getElementById("searchCard").value;

    const response = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=name:${search}`
    );

    const data = await response.json();

    console.log(data);

    const results = document.getElementById("results");

    results.innerHTML = "";

    data.data.forEach(card => {

        results.innerHTML += `

            <div class="card">

                <img src="${card.images.small}">

                <h3>${card.name}</h3>

                <p>${card.set.name}</p>

                <p>${card.rarity}</p>

            </div>

        `;

    });

}