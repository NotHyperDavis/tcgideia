const express = require("express");
const axios = require("axios");

const router = express.Router();

const TCGDEX_BASE = "https://api.tcgdex.net/v2/en";

// GET /cards            -> lista cartas
// GET /cards?q=charizard -> pesquisa cartas pelo nome
// Usa a TCGdex (open-source, sem API key, sem limite de pedidos publicado).
router.get("/", async (req, res) => {
    const { q } = req.query;

    try {
        const response = await axios.get(`${TCGDEX_BASE}/cards`, {
            params: q ? { name: q } : {},
        });

        // A TCGdex devolve um array direto: [{ id, localId, name, image }, ...]
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

        const response = await axios.get(`${TCGDEX_BASE}/cards/${req.params.id}`);

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