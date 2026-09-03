const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const isAdmin = require("../utils/isAdmin");

const router = express.Router();

// 1. ROTA ESPECÍFICA (GET /users/me) - Agora com todas as estatísticas!
router.get("/me", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        const userResult = await pool.query(
            `SELECT id, name, email, country, account_type, created_at,
                    address_name, address_line, address_postal_code, address_city,
                    late_shipment_strikes, late_payment_strikes, is_suspended
             FROM users WHERE id = $1`,
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
// O tipo de conta (Particular/Loja) NÃO se edita aqui de propósito — só um admin
// pode mudar isso (ver rota /admin/account-type mais abaixo), para ninguém se
// autodeclarar "Loja" só para pagar menos comissão.
router.patch("/me", requireAuth, async (req, res) => {
    const { name, country, address_name, address_line, address_postal_code, address_city } = req.body;

    if (country && !["PT", "ES"].includes(country)) {
        return res.status(400).json({ error: "País inválido." });
    }

    try {
        const result = await pool.query(
            `UPDATE users
             SET name = COALESCE($1, name),
                 country = COALESCE($2, country),
                 address_name = COALESCE($3, address_name),
                 address_line = COALESCE($4, address_line),
                 address_postal_code = COALESCE($5, address_postal_code),
                 address_city = COALESCE($6, address_city)
             WHERE id = $7
             RETURNING id, name, email, country, account_type, created_at,
                       address_name, address_line, address_postal_code, address_city`,
            [
                name || null, country || null,
                address_name || null, address_line || null,
                address_postal_code || null, address_city || null,
                req.user.id
            ]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar o teu perfil." });
    }
});

// PATCH /users/admin/account-type — só o admin pode mudar o tipo de conta
// (Particular/Loja) de qualquer utilizador, identificado pelo email.
router.patch("/admin/account-type", requireAuth, async (req, res) => {
    if (!isAdmin(req.user)) {
        return res.status(403).json({ error: "Acesso restrito ao administrador do site." });
    }

    const { email, account_type } = req.body;

    if (!email || !account_type) {
        return res.status(400).json({ error: "Indica o email e o tipo de conta." });
    }

    if (!["individual", "store"].includes(account_type)) {
        return res.status(400).json({ error: "Tipo de conta inválido." });
    }

    try {
        const result = await pool.query(
            `UPDATE users SET account_type = $1 WHERE email = $2
             RETURNING id, name, email, account_type`,
            [account_type, email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Não existe nenhum utilizador com esse email." });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar o tipo de conta." });
    }
});

// 2. ROTA DINÂMICA (GET /users/:id) - Perfil público
router.get("/:id", async (req, res) => {
    try {
        const userId = req.params.id;

        const userResult = await pool.query(
            `SELECT id, name, account_type, created_at, late_shipment_strikes, late_payment_strikes, is_suspended FROM users WHERE id = $1`,
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