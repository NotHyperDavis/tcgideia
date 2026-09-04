const express = require("express");
const axios = require("axios");

const router = express.Router();

const TCGDEX_BASE = "https://api.tcgdex.net/v2/en";
const YGOPRODECK_BASE = "https://db.ygoprodeck.com/api/v7/cardinfo.php";
const SCRYFALL_BASE = "https://api.scryfall.com/cards/search";
const APITCG_BASE = "https://api.apitcg.com/api/products";

// Todas as pesquisas devolvem sempre o mesmo formato: [{ id, name, image }, ...]
// — o frontend não precisa de saber qual API está por trás de cada jogo.

async function searchPokemon(q) {
    const response = await axios.get(`${TCGDEX_BASE}/cards`, {
        params: q ? { name: q } : {},
    });

    // A TCGdex devolve a imagem sem sufixo de qualidade/extensão — é preciso acrescentar.
    return response.data.map(card => ({
        id: card.id,
        name: card.name,
        image: card.image ? `${card.image}/low.webp` : null,
    }));
}

async function searchYugioh(q) {
    if (!q) return [];

    try {
        const response = await axios.get(YGOPRODECK_BASE, {
            params: { fname: q },
        });

        return response.data.data.map(card => ({
            id: String(card.id),
            name: card.name,
            image: card.card_images?.[0]?.image_url ?? null,
        }));
    } catch (error) {
        // A YGOPRODeck devolve 400 quando não há resultados nenhuns — tratamos como lista vazia.
        if (error.response?.status === 400) return [];
        throw error;
    }
}

async function searchMagic(q) {
    if (!q) return [];

    try {
        const response = await axios.get(SCRYFALL_BASE, {
            params: { q },
            headers: {
                // A Scryfall exige um User-Agent identificável.
                "User-Agent": "TCGMarketPortugal/1.0",
                "Accept": "application/json",
            },
        });

        return response.data.data.map(card => ({
            id: card.id,
            name: card.name,
            image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null,
        }));
    } catch (error) {
        // A Scryfall devolve 404 quando não há resultados nenhuns — tratamos como lista vazia.
        if (error.response?.status === 404) return [];
        throw error;
    }
}

async function searchOnePiece(q) {
    if (!q) return [];

    try {
        const response = await axios.get(APITCG_BASE, {
            params: { tcg: "one-piece", name: q },
            headers: { "x-api-key": process.env.APITCG_API_KEY },
        });

        return response.data.data
            // A API devolve também produtos selados (DON!!, boosters, etc.) — só nos
            // interessam mesmo as cartas.
            .filter(card => card.type === "card")
            .map(card => ({
                id: String(card._id),
                name: card.name,
                image: card.images?.[0]?.large ?? card.images?.[0]?.medium ?? null,
            }));
    } catch (error) {
        if (error.response?.status === 404) return [];
        throw error;
    }
}

// GET /cards?q=charizard&game=pokemon
router.get("/", async (req, res) => {
    const { q, game } = req.query;

    try {
        let results;

        switch (game) {
            case "yugioh":
                results = await searchYugioh(q);
                break;
            case "magic":
                results = await searchMagic(q);
                break;
            case "onepiece":
                results = await searchOnePiece(q);
                break;
            case "pokemon":
            default:
                results = await searchPokemon(q);
                break;
        }

        res.json(results);

    } catch (error) {
        console.log(error.response?.data);
        console.log(error.response?.status);
        console.log(error.message);

        res.status(500).json({ error: "Erro ao obter cartas." });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const response = await axios.get(`${TCGDEX_BASE}/cards/${req.params.id}`);
        res.json(response.data);
    } catch (error) {
        console.log(error.response?.data);
        console.log(error.response?.status);
        console.log(error.message);
        res.status(500).json({ error: "Carta não encontrada." });
    }
});

module.exports = router;