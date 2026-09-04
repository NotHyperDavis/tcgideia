const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const requireVerifiedEmail = require("../middleware/requireVerifiedEmail");

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

// GET /listings/trend/:card_id — preço de referência de uma carta (para ajudar a
// definir preço ao vender, e mostrar ao comprador se um anúncio está caro/barato).
//
// Prioriza vendas reais e concluídas dos últimos 60 dias. Se não houver vendas
// suficientes (site ainda novo, ou carta pouco vendida), usa os anúncios ativos
// dessa carta como referência alternativa.
// GET /listings/deals — anúncios ativos claramente abaixo do preço de vendas reais
// recentes (pelo menos 3 vendas concluídas nos últimos 60 dias, e pelo menos 15%
// mais barato que essa média). Usado para "Melhores Ofertas" na homepage.
router.get("/deals", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT listings.*, users.name AS seller_name, sales.avg_price AS trend_price
            FROM listings
            JOIN users ON users.id = listings.user_id
            JOIN LATERAL (
                SELECT AVG(orders.unit_price) AS avg_price, COUNT(*) AS count
                FROM orders
                JOIN listings l2 ON l2.id = orders.listing_id
                WHERE l2.card_id = listings.card_id
                  AND orders.status = 'completed'
                  AND orders.created_at > NOW() - INTERVAL '60 days'
            ) sales ON true
            WHERE listings.status = 'active'
              AND sales.count >= 3
              AND listings.price <= sales.avg_price * 0.85
            ORDER BY (listings.price / sales.avg_price) ASC
            LIMIT 8
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter as melhores ofertas." });
    }
});

router.get("/trend/:card_id", async (req, res) => {
    try {
        const salesResult = await pool.query(
            `SELECT AVG(orders.unit_price) AS avg_price, MIN(orders.unit_price) AS min_price,
                    MAX(orders.unit_price) AS max_price, COUNT(*) AS count
             FROM orders
             JOIN listings ON listings.id = orders.listing_id
             WHERE listings.card_id = $1
               AND orders.status = 'completed'
               AND orders.created_at > NOW() - INTERVAL '60 days'`,
            [req.params.card_id]
        );

        const sales = salesResult.rows[0];

        if (Number(sales.count) >= 3) {
            return res.json({
                source: "sales",
                avg_price: Number(sales.avg_price),
                min_price: Number(sales.min_price),
                max_price: Number(sales.max_price),
                sample_size: Number(sales.count),
            });
        }

        // Sem vendas suficientes — usa os anúncios ativos dessa carta como referência.
        const listingsResult = await pool.query(
            `SELECT AVG(price) AS avg_price, MIN(price) AS min_price, MAX(price) AS max_price, COUNT(*) AS count
             FROM listings
             WHERE card_id = $1 AND status = 'active'`,
            [req.params.card_id]
        );

        const listings = listingsResult.rows[0];

        if (Number(listings.count) === 0) {
            return res.json({ source: "none" });
        }

        res.json({
            source: "active_listings",
            avg_price: Number(listings.avg_price),
            min_price: Number(listings.min_price),
            max_price: Number(listings.max_price),
            sample_size: Number(listings.count),
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter o preço de referência." });
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
const VALID_LANGUAGES = ["PT", "EN", "ES", "FR", "DE", "IT", "JP", "KO", "ZH"];
const VALID_GAMES = ["pokemon", "yugioh", "magic", "onepiece"];

router.post("/", requireAuth, requireVerifiedEmail, async (req, res) => {
    const { card_id, card_name, card_image, price, condition, quantity, description, real_photo_url, language, is_foil, game, set_name } = req.body;

    if (!card_id || !card_name || !price || !condition) {
        return res.status(400).json({ error: "Faltam campos obrigatórios (carta, preço, condição)." });
    }

    if (!VALID_CONDITIONS.includes(condition)) {
        return res.status(400).json({ error: "Condição inválida." });
    }

    if (language && !VALID_LANGUAGES.includes(language)) {
        return res.status(400).json({ error: "Idioma inválido." });
    }

    if (game && !VALID_GAMES.includes(game)) {
        return res.status(400).json({ error: "Jogo inválido." });
    }

    if (Number(price) <= 0) {
        return res.status(400).json({ error: "O preço tem de ser maior que zero." });
    }

    try {
        const result = await pool.query(
            `INSERT INTO listings (user_id, card_id, card_name, card_image, price, condition, quantity, description, real_photo_url, language, is_foil, game, set_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [req.user.id, card_id, card_name, card_image || null, price, condition, quantity || 1, description || null, real_photo_url || null, language || "EN", !!is_foil, game || "pokemon", set_name || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao criar o anúncio." });
    }
});

// PATCH /listings/:id — edita um anúncio (só o dono pode editar)
router.patch("/:id", requireAuth, async (req, res) => {
    const { price, condition, quantity, description, status, language, is_foil } = req.body;

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
                language = COALESCE($6, language),
                is_foil = COALESCE($7, is_foil),
                updated_at = NOW()
             WHERE id = $8
             RETURNING *`,
            [price, condition, quantity, description, status, language, is_foil, req.params.id]
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