const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// 1. ROTA ESPECÍFICA (GET /users/me) - Agora com todas as estatísticas!
router.get("/me", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        const userResult = await pool.query(
            `SELECT id, name, email, country, created_at FROM users WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "Utilizador não encontrado." });
        }

        const ratingResult = await pool.query(
            `SELECT ROUND(AVG(rating)::numeric, 2) AS average, COUNT(*) AS count 
             FROM reviews WHERE reviewed_user_id = $1`,
            [userId]
        );

        const listingsResult = await pool.query(
            `SELECT * FROM listings WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC`,
            [userId]
        );

        const salesResult = await pool.query(
            `SELECT COUNT(*) AS count FROM orders WHERE seller_id = $1 AND status = 'completed'`,
            [userId]
        );

        const purchasesResult = await pool.query(
            `SELECT COUNT(*) AS count FROM orders WHERE buyer_id = $1 AND status = 'completed'`,
            [userId]
        );

        const user = userResult.rows[0];

        res.json({
            ...user,
            stats: {
                active_listings: listingsResult.rows.length,
                sales: Number(salesResult.rows[0].count),
                purchases: Number(purchasesResult.rows[0].count),
                rating: ratingResult.rows[0].count > 0 
                        ? Number(ratingResult.rows[0].average) 
                        : null,
                review_count: Number(ratingResult.rows[0].count)
            },
            active_listings: listingsResult.rows
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter o teu perfil." });
    }
});

// PATCH /users/me — editar o meu nome e/ou país (usado para os portes internacionais)
router.patch("/me", requireAuth, async (req, res) => {
    const { name, country } = req.body;

    if (country && !["PT", "ES"].includes(country)) {
        return res.status(400).json({ error: "País inválido." });
    }

    try {
        const result = await pool.query(
            `UPDATE users
             SET name = COALESCE($1, name),
                 country = COALESCE($2, country)
             WHERE id = $3
             RETURNING id, name, email, country, created_at`,
            [name || null, country || null, req.user.id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar o teu perfil." });
    }
});

// 2. ROTA DINÂMICA (GET /users/:id) - Perfil público
router.get("/:id", async (req, res) => {
    try {
        const userId = req.params.id;

        const userResult = await pool.query(
            `SELECT id, name, created_at FROM users WHERE id = $1`,
            [userId]
        );
        
        const ratingResult = await pool.query(
            `SELECT ROUND(AVG(rating)::numeric, 2) AS average, COUNT(*) AS count 
             FROM reviews WHERE reviewed_user_id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "Utilizador não encontrado." });
        }

        const listingsResult = await pool.query(
            `SELECT * FROM listings WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC`,
            [userId]
        );

        const salesResult = await pool.query(
            `SELECT COUNT(*) AS count FROM orders WHERE seller_id = $1 AND status = 'completed'`,
            [userId]
        );

        const purchasesResult = await pool.query(
            `SELECT COUNT(*) AS count FROM orders WHERE buyer_id = $1 AND status = 'completed'`,
            [userId]
        );

        const user = userResult.rows[0];

        res.json({
            ...user,
            stats: {
                active_listings: listingsResult.rows.length,
                sales: Number(salesResult.rows[0].count),
                purchases: Number(purchasesResult.rows[0].count),
                rating: ratingResult.rows[0].count > 0
                        ? Number(ratingResult.rows[0].average)
                        : null,
                review_count: Number(ratingResult.rows[0].count)
            },
            active_listings: listingsResult.rows
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter perfil." });
    }
});

module.exports = router;