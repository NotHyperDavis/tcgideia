const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// GET /wishlist — a minha lista, já com o melhor preço disponível agora (se houver)
router.get("/", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT wishlist_items.*,
                    best.id AS best_listing_id,
                    best.price AS best_price,
                    best.seller_name AS best_seller_name
             FROM wishlist_items
             LEFT JOIN LATERAL (
                 SELECT listings.id, listings.price, users.name AS seller_name
                 FROM listings
                 JOIN users ON users.id = listings.user_id
                 WHERE listings.card_id = wishlist_items.card_id AND listings.status = 'active'
                 ORDER BY listings.price ASC
                 LIMIT 1
             ) best ON true
             WHERE wishlist_items.user_id = $1
             ORDER BY wishlist_items.created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter a lista de desejos." });
    }
});

// POST /wishlist — adicionar uma carta (identificada pelo card_id da TCGdex)
router.post("/", requireAuth, async (req, res) => {
    const { card_id, card_name, card_image } = req.body;

    if (!card_id || !card_name) {
        return res.status(400).json({ error: "Indica a carta a adicionar." });
    }

    try {
        const result = await pool.query(
            `INSERT INTO wishlist_items (user_id, card_id, card_name, card_image)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, card_id) DO NOTHING
             RETURNING *`,
            [req.user.id, card_id, card_name, card_image || null]
        );

        if (result.rows.length === 0) {
            return res.status(200).json({ ok: true, already_saved: true });
        }

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao adicionar à lista de desejos." });
    }
});

// DELETE /wishlist/:id — remover uma carta da lista (só a própria)
router.delete("/:id", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            "DELETE FROM wishlist_items WHERE id = $1 AND user_id = $2 RETURNING id",
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Não encontrado." });
        }

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao remover da lista de desejos." });
    }
});

module.exports = router;