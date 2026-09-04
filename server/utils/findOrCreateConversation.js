const pool = require("../db");

// Usa-se sempre que uma encomenda é criada, para ligar automaticamente essa
// encomenda à conversa entre comprador e vendedor (criando-a se ainda não existir).
async function findOrCreateConversation(client, userId1, userId2, listingId) {
    const userA = Math.min(userId1, userId2);
    const userB = Math.max(userId1, userId2);

    const runner = client || pool;

    const existing = await runner.query(
        "SELECT id FROM conversations WHERE user_a_id = $1 AND user_b_id = $2",
        [userA, userB]
    );

    if (existing.rows.length > 0) {
        return existing.rows[0].id;
    }

    const created = await runner.query(
        `INSERT INTO conversations (user_a_id, user_b_id, listing_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [userA, userB, listingId || null]
    );

    return created.rows[0].id;
}

module.exports = findOrCreateConversation;