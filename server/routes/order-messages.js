const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const requireVerifiedEmail = require("../middleware/requireVerifiedEmail");
const { notify } = require("../utils/notifications");

// mergeParams para conseguir ler :orderId, que vem do caminho onde este router é montado
const router = express.Router({ mergeParams: true });

// Confirma que quem pede é o comprador ou o vendedor dessa encomenda
async function getOrderIfAllowed(orderId, userId) {
    const result = await pool.query("SELECT * FROM orders WHERE id = $1", [orderId]);
    const order = result.rows[0];

    if (!order) return { error: 404 };
    if (order.buyer_id !== userId && order.seller_id !== userId) return { error: 403 };

    return { order };
}

// GET /orders/:orderId/messages — histórico do chat dessa encomenda
router.get("/", requireAuth, async (req, res) => {
    const { orderId } = req.params;

    const { order, error } = await getOrderIfAllowed(orderId, req.user.id);

    if (error === 404) return res.status(404).json({ error: "Encomenda não encontrada." });
    if (error === 403) return res.status(403).json({ error: "Não tens acesso a esta conversa." });

    try {
        const result = await pool.query(
            `SELECT order_messages.*, users.name AS sender_name
             FROM order_messages
             JOIN users ON users.id = order_messages.sender_id
             WHERE order_id = $1
             ORDER BY created_at ASC`,
            [orderId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao obter mensagens." });
    }
});

// POST /orders/:orderId/messages — enviar uma mensagem nessa encomenda
router.post("/", requireAuth, requireVerifiedEmail, async (req, res) => {
    const { orderId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
        return res.status(400).json({ error: "A mensagem não pode estar vazia." });
    }

    const { error, order } = await getOrderIfAllowed(orderId, req.user.id);

    if (error === 404) return res.status(404).json({ error: "Encomenda não encontrada." });
    if (error === 403) return res.status(403).json({ error: "Não tens acesso a esta conversa." });

    try {
        const result = await pool.query(
            `INSERT INTO order_messages (order_id, sender_id, message)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [orderId, req.user.id, message.trim()]
        );

        const recipientId = order.buyer_id === req.user.id ? order.seller_id : order.buyer_id;
        await notify(recipientId, "message", "Nova mensagem sobre uma encomenda.", "encomendas.html");

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao enviar mensagem." });
    }
});

module.exports = router;