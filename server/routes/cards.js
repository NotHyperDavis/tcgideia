const express = require("express");
const axios = require("axios");

const router = express.Router();

// GET /cards            -> lista cartas em destaque
// GET /cards?q=charizard -> pesquisa cartas pelo nome
// Tudo passa por aqui para nunca expormos a API key no frontend.
router.get("/", async (req, res) => {
    const { q } = req.query;

    const query = q ? `name:"${q}*"` : "";

    try {
        const response = await axios.get("https://api.pokemontcg.io/v2/cards", {
            headers: { "X-Api-Key": process.env.POKEMONTCG_API_KEY },
            params: {
                pageSize: 24,
                ...(query ? { q: query } : {}),
            },
        });

        res.json(response.data);
    } catch (error) {

        console.log(error.response?.data);
        console.log(error.response?.status);
        console.log(error.message);

        res.status(500).json({
            error: "Erro ao obter cartas."
        });

    }
});

router.get("/:id", async (req, res) => {

    try {

        const response = await axios.get(
            `https://api.pokemontcg.io/v2/cards/${req.params.id}`,
            { headers: { "X-Api-Key": process.env.POKEMONTCG_API_KEY } }
        );

        res.json(response.data);

    } catch (error) {

        console.log(error.response?.data);
        console.log(error.response?.status);
        console.log(error.message);

        res.status(500).json({
            error: "Carta não encontrada."
        });

    }

});

module.exports = router;