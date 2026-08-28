const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

/*
GET /users/:id
Perfil público de um utilizador
*/
router.get("/:id", async (req, res) => {
    try {
        const userResult = await pool.query(
            `SELECT id, name, created_at
             FROM users
             WHERE id = $1`,
            [req.params.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: "Utilizador não encontrado."
            });
        }

        const user = userResult.rows[0];

        // Anúncios ativos
        const listingsResult = await pool.query(
            `SELECT *
             FROM listings
             WHERE user_id = $1
             AND status = 'active'
             ORDER BY created_at DESC`,
            [req.params.id]
        );

        // Número de vendas concluídas
        const salesResult = await pool.query(
            `SELECT COUNT(*) AS count
             FROM orders
             WHERE seller_id = $1
             AND status = 'completed'`,
            [req.params.id]
        );

        // Número de compras concluídas
        const purchasesResult = await pool.query(
            `SELECT COUNT(*) AS count
             FROM orders
             WHERE buyer_id = $1
             AND status = 'completed'`,
            [req.params.id]
        );

        res.json({
            ...user,

            stats: {
                active_listings: Number(listingsResult.rows.length),
                sales: Number(salesResult.rows[0].count),
                purchases: Number(purchasesResult.rows[0].count)
            },

            active_listings: listingsResult.rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Erro ao obter perfil."
        });
    }
});


/*
PATCH /users/me
Edita o perfil do utilizador autenticado
*/
router.patch("/me", requireAuth, async (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({
            error: "O nome não pode estar vazio."
        });
    }

    try {
        const result = await pool.query(
            `UPDATE users
             SET name = $1
             WHERE id = $2
             RETURNING id, name, email, created_at`,
            [name.trim(), req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Utilizador não encontrado."
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Erro ao atualizar perfil."
        });
    }
});


module.exports = router;