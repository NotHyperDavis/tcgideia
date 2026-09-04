const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const requireVerifiedEmail = require("../middleware/requireVerifiedEmail");
const { notify } = require("../utils/notifications");

const router = express.Router();

// POST /conversations — encontra a conversa com outro utilizador, ou cria uma nova
router.post("/", requireAuth, requireVerifiedEmail, async (req, res) => {
    const { other_user_id, listing_id } = req.body;

    if (!other_user_id) {
        return res.status(400).json({ error: "Indica com quem queres falar." });
    }

    if (Number(other_user_id) === req.user.id) {
        return res.status(400).json({ error: "Não podes iniciar uma conversa contigo próprio." });
    }

    // guarda sempre o id menor em user_a_id, para nunca duplicar a mesma conversa trocada
    const userA = Math.min(req.user.id, Number(other_user_id));
    const userB = Math.max(req.user.id, Number(other_user_id));

    try {
        const existing = await pool.query(
            "SELECT * FROM conversations WHERE user_a_id = $1 AND user_b_id = $2",
            [userA, userB]
        );

        if (existing.rows.length > 0) {
            return res.json(existing.rows[0]);
        }

        const result = await pool.query(
            `INSERT INTO conversations (user_a_id, user_b_id, listing_id)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [userA, userB, listing_id || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao iniciar conversa." });
    }
});

// GET /conversations — lista as conversas do utilizador autenticado (caixa de entrada)
router.get("/", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT conversations.*,
                    other.id AS other_user_id, other.name AS other_user_name,
                    listings.card_name,
                    (SELECT message FROM conversation_messages
                     WHERE conversation_id = conversations.id
                     ORDER BY created_at DESC LIMIT 1) AS last_message,
                    (SELECT created_at FROM conversation_messages
                     WHERE conversation_id = conversations.id
                     ORDER BY created_at DESC LIMIT 1) AS last_message_at
             FROM conversations
             JOIN users other ON other.id = CASE
                 WHEN conversations.user_a_id = $1 THEN conversations.user_b_id
                 ELSE conversations.user_a_id
             END
             LEFT JOIN listings ON listings.id = conversations.listing_id
             WHERE conversations.user_a_id = $1 OR conversations.user_b_id = $1
             ORDER BY last_message_at DESC NULLS LAST, conversations.created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter conversas." });
    }
});

// Confirma que o utilizador pertence a esta conversa
async function getConversationIfAllowed(conversationId, userId) {
    const result = await pool.query("SELECT * FROM conversations WHERE id = $1", [conversationId]);
    const conversation = result.rows[0];

    if (!conversation) return { error: 404 };
    if (conversation.user_a_id !== userId && conversation.user_b_id !== userId) return { error: 403 };

    return { conversation };
}

// GET /conversations/:id/messages
router.get("/:id/messages", requireAuth, async (req, res) => {
    const { error } = await getConversationIfAllowed(req.params.id, req.user.id);

    if (error === 404) return res.status(404).json({ error: "Conversa não encontrada." });
    if (error === 403) return res.status(403).json({ error: "Não tens acesso a esta conversa." });

    try {
        const result = await pool.query(
            `SELECT conversation_messages.*, users.name AS sender_name
             FROM conversation_messages
             JOIN users ON users.id = conversation_messages.sender_id
             WHERE conversation_id = $1
             ORDER BY created_at ASC`,
            [req.params.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter mensagens." });
    }
});

// POST /conversations/:id/messages
router.post("/:id/messages", requireAuth, requireVerifiedEmail, async (req, res) => {
    const { message, image_url } = req.body;

    if (!message?.trim() && !image_url) {
        return res.status(400).json({ error: "A mensagem não pode estar vazia." });
    }

    const { error, conversation } = await getConversationIfAllowed(req.params.id, req.user.id);

    if (error === 404) return res.status(404).json({ error: "Conversa não encontrada." });
    if (error === 403) return res.status(403).json({ error: "Não tens acesso a esta conversa." });

    try {
        const result = await pool.query(
            `INSERT INTO conversation_messages (conversation_id, sender_id, message, image_url)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [req.params.id, req.user.id, message?.trim() || null, image_url || null]
        );

        const recipientId = conversation.user_a_id === req.user.id ? conversation.user_b_id : conversation.user_a_id;
        await notify(recipientId, "message", "Tens uma mensagem nova.", `mensagens.html?conversation=${req.params.id}`);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao enviar mensagem." });
    }
});

module.exports = router;