const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

const VALID_CONDITIONS = ["mint", "near_mint", "excellent", "good", "played", "poor"];

// GET /listings — lista todos os anúncios ativos (usado na página do marketplace)
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT listings.*, users.name AS seller_name
             FROM listings
             JOIN users ON users.id = listings.user_id
             WHERE listings.status = 'active'
             ORDER BY listings.created_at DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter anúncios." });
    }
});

// GET /listings/mine — anúncios do utilizador autenticado (para o perfil)
router.get("/mine", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM listings WHERE user_id = $1 ORDER BY created_at DESC",
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter os teus anúncios." });
    }
});

// GET /listings/:id — detalhe de um anúncio (usado na página do produto)
router.get("/:id", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT listings.*, users.name AS seller_name, users.email AS seller_email
             FROM listings
             JOIN users ON users.id = listings.user_id
             WHERE listings.id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Anúncio não encontrado." });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter o anúncio." });
    }
});

// POST /listings — cria um anúncio novo (exige login)
router.post("/", requireAuth, async (req, res) => {
    const { card_id, card_name, card_image, price, condition, quantity, description, real_photo_url } = req.body;

    if (!card_id || !card_name || !price || !condition) {
        return res.status(400).json({ error: "Faltam campos obrigatórios (carta, preço, condição)." });
    }

    if (!VALID_CONDITIONS.includes(condition)) {
        return res.status(400).json({ error: "Condição inválida." });
    }

    if (Number(price) <= 0) {
        return res.status(400).json({ error: "O preço tem de ser maior que zero." });
    }

    try {
        const result = await pool.query(
            `INSERT INTO listings (user_id, card_id, card_name, card_image, price, condition, quantity, description, real_photo_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [req.user.id, card_id, card_name, card_image || null, price, condition, quantity || 1, description || null, real_photo_url || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao criar o anúncio." });
    }
});

// PATCH /listings/:id — edita um anúncio (só o dono pode editar)
router.patch("/:id", requireAuth, async (req, res) => {
    const { price, condition, quantity, description, status } = req.body;

    try {
        const existing = await pool.query("SELECT * FROM listings WHERE id = $1", [req.params.id]);

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: "Anúncio não encontrado." });
        }

        if (existing.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: "Não podes editar um anúncio que não é teu." });
        }

        const result = await pool.query(
            `UPDATE listings SET
                price = COALESCE($1, price),
                condition = COALESCE($2, condition),
                quantity = COALESCE($3, quantity),
                description = COALESCE($4, description),
                status = COALESCE($5, status),
                updated_at = NOW()
             WHERE id = $6
             RETURNING *`,
            [price, condition, quantity, description, status, req.params.id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar o anúncio." });
    }
});

// DELETE /listings/:id — remove um anúncio (só o dono pode remover)
router.delete("/:id", requireAuth, async (req, res) => {
    try {
        const existing = await pool.query("SELECT * FROM listings WHERE id = $1", [req.params.id]);

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: "Anúncio não encontrado." });
        }

        if (existing.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: "Não podes remover um anúncio que não é teu." });
        }

        await pool.query("DELETE FROM listings WHERE id = $1", [req.params.id]);

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao remover o anúncio." });
    }
});

module.exports = router;