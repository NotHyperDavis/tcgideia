const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// GET /notifications — as 30 mais recentes, mais recentes primeiro
router.get("/", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 30`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter notificações." });
    }
});

// GET /notifications/unread-count — para o número no sino
router.get("/unread-count", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
            [req.user.id]
        );

        res.json({ count: result.rows[0].count });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter contagem." });
    }
});

// PATCH /notifications/read-all — marca tudo como lido (ex: ao abrir o sino)
router.patch("/read-all", requireAuth, async (req, res) => {
    try {
        await pool.query(
            `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
            [req.user.id]
        );

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao marcar notificações como lidas." });
    }
});

module.exports = router;