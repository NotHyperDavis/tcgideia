const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const isAdmin = require("../utils/isAdmin");
const { notify } = require("../utils/notifications");

const router = express.Router();

const VALID_REASONS = ["nao_chegou", "diferente_do_anuncio", "vendedor_nao_responde", "outro"];

// POST /disputes — abrir uma reclamação sobre uma encomenda (comprador ou vendedor)
router.post("/", requireAuth, async (req, res) => {
    const { order_id, reason, description } = req.body;

    if (!order_id || !reason) {
        return res.status(400).json({ error: "Indica a encomenda e o motivo." });
    }

    if (!VALID_REASONS.includes(reason)) {
        return res.status(400).json({ error: "Motivo inválido." });
    }

    try {
        const orderResult = await pool.query("SELECT * FROM orders WHERE id = $1", [order_id]);
        const order = orderResult.rows[0];

        if (!order) {
            return res.status(404).json({ error: "Encomenda não encontrada." });
        }

        if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) {
            return res.status(403).json({ error: "Não tens acesso a esta encomenda." });
        }

        const existing = await pool.query(
            "SELECT id FROM disputes WHERE order_id = $1 AND status != 'resolved'",
            [order_id]
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: "Já existe uma reclamação em aberto para esta encomenda." });
        }

        const result = await pool.query(
            `INSERT INTO disputes (order_id, opened_by, reason, description)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [order_id, req.user.id, reason, description || null]
        );

        // Avisa a outra parte e o admin (usa o email do .env como "utilizador" de referência
        // só para notificação por agora — o painel de admin já mostra todas as reclamações).
        const otherUserId = order.buyer_id === req.user.id ? order.seller_id : order.buyer_id;
        await notify(otherUserId, "order_update", "Foi aberta uma reclamação sobre uma encomenda tua.", "encomendas.html");

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao abrir a reclamação." });
    }
});

// GET /disputes/mine — as minhas reclamações (abertas por mim, ou sobre encomendas minhas)
router.get("/mine", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT disputes.*, orders.listing_id, listings.card_name
             FROM disputes
             JOIN orders ON orders.id = disputes.order_id
             JOIN listings ON listings.id = orders.listing_id
             WHERE orders.buyer_id = $1 OR orders.seller_id = $1
             ORDER BY disputes.created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter reclamações." });
    }
});

// GET /disputes/admin — todas as reclamações (só admin)
router.get("/admin", requireAuth, async (req, res) => {
    if (!isAdmin(req.user)) {
        return res.status(403).json({ error: "Acesso restrito ao administrador do site." });
    }

    try {
        const result = await pool.query(
            `SELECT disputes.*, orders.listing_id, orders.total_price, orders.status AS order_status,
                    listings.card_name,
                    opener.name AS opened_by_name, opener.email AS opened_by_email,
                    buyer.name AS buyer_name, seller.name AS seller_name
             FROM disputes
             JOIN orders ON orders.id = disputes.order_id
             JOIN listings ON listings.id = orders.listing_id
             JOIN users opener ON opener.id = disputes.opened_by
             JOIN users buyer ON buyer.id = orders.buyer_id
             JOIN users seller ON seller.id = orders.seller_id
             ORDER BY
                CASE disputes.status WHEN 'open' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END,
                disputes.created_at DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter reclamações." });
    }
});

// PATCH /disputes/:id — atualizar estado/notas (só admin)
router.patch("/:id", requireAuth, async (req, res) => {
    if (!isAdmin(req.user)) {
        return res.status(403).json({ error: "Acesso restrito ao administrador do site." });
    }

    const { status, admin_notes } = req.body;

    if (status && !["open", "in_review", "resolved"].includes(status)) {
        return res.status(400).json({ error: "Estado inválido." });
    }

    try {
        const result = await pool.query(
            `UPDATE disputes SET
                status = COALESCE($1, status),
                admin_notes = COALESCE($2, admin_notes),
                updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [status, admin_notes, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Reclamação não encontrada." });
        }

        const dispute = result.rows[0];
        const orderResult = await pool.query("SELECT buyer_id, seller_id FROM orders WHERE id = $1", [dispute.order_id]);
        const order = orderResult.rows[0];

        if (status === "resolved" && order) {
            await notify(order.buyer_id, "order_update", "A tua reclamação foi marcada como resolvida.", "encomendas.html");
            await notify(order.seller_id, "order_update", "Uma reclamação sobre uma encomenda tua foi marcada como resolvida.", "encomendas.html");
        }

        res.json(dispute);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar a reclamação." });
    }
});

module.exports = router;