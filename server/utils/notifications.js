const pool = require("../db");

// Cria uma notificação para um utilizador. Usa-se a partir de qualquer rota sempre que algo relevante acontece (mensagem nova, encomenda atualizada, etc.)
async function notify(userId, type, content, link) {
    try {
        await pool.query(
            `INSERT INTO notifications (user_id, type, content, link)
             VALUES ($1, $2, $3, $4)`,
            [userId, type, content, link || null]
        );
    } catch (error) {
        // Uma notificação falhada não deve impedir a ação principal (enviar mensagem, etc.)
        console.error("Erro ao criar notificação:", error);
    }
}

module.exports = { notify };