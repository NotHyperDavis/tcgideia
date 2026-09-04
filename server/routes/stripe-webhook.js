const express = require("express");
const pool = require("../db");
const stripe = require("../utils/stripe");
const { notify } = require("../utils/notifications");
const findOrCreateConversation = require("../utils/findOrCreateConversation");

const router = express.Router();

// IMPORTANTE: esta rota tem de receber o corpo em "raw" (não JSON), para a Stripe
// conseguir confirmar a assinatura. Isso é tratado no server.js, antes do express.json().
router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
    const signature = req.headers["stripe-signature"];

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
        console.error("Assinatura do webhook inválida:", error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        // Depósito na carteira (Cartão/MB WAY) — não é uma compra de carta.
        if (session.metadata.type === "wallet_deposit") {
            const { user_id, amount } = session.metadata;

            const client = await pool.connect();

            try {
                await client.query("BEGIN");

                const existing = await client.query("SELECT id FROM deposits WHERE stripe_session_id = $1", [session.id]);
                if (existing.rows.length > 0) {
                    await client.query("ROLLBACK");
                    return res.json({ received: true });
                }

                await client.query(
                    `INSERT INTO deposits (user_id, amount, status, method, stripe_session_id, confirmed_at)
                     VALUES ($1, $2, 'confirmed', 'stripe', $3, NOW())`,
                    [user_id, amount, session.id]
                );

                await client.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [amount, user_id]);

                await client.query("COMMIT");

                await notify(user_id, "order_update", `O teu depósito de ${Number(amount).toFixed(2)} € foi confirmado.`, "carteira.html");

            } catch (error) {
                await client.query("ROLLBACK");
                console.error("Erro ao processar depósito Stripe:", error);
            } finally {
                client.release();
            }

            return res.json({ received: true });
        }

        const { listing_id, buyer_id, seller_id, quantity, unit_price, shipping_cost, platform_fee, total_price, seller_payout,
                shipping_name, shipping_address_line, shipping_postal_code, shipping_city, shipping_country } = session.metadata;

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Idempotência: se este session_id já criou uma encomenda, não faz nada outra vez
            // (a Stripe pode reenviar o mesmo evento mais que uma vez).
            const existing = await client.query("SELECT id FROM orders WHERE stripe_session_id = $1", [session.id]);
            if (existing.rows.length > 0) {
                await client.query("ROLLBACK");
                return res.json({ received: true });
            }

            const listingResult = await client.query("SELECT * FROM listings WHERE id = $1 FOR UPDATE", [listing_id]);
            const listing = listingResult.rows[0];

            const conversationId = await findOrCreateConversation(client, Number(buyer_id), Number(seller_id), Number(listing_id));

            const orderResult = await client.query(
                `INSERT INTO orders (listing_id, buyer_id, seller_id, quantity, unit_price, total_price, payment_method, payment_status, platform_fee, seller_payout, shipping_cost, stripe_session_id, stripe_payment_intent_id,
                                     shipping_name, shipping_address_line, shipping_postal_code, shipping_city, shipping_country, conversation_id)
                 VALUES ($1, $2, $3, $4, $5, $6, 'stripe', 'paid', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                 RETURNING *`,
                [listing_id, buyer_id, seller_id, quantity, unit_price, total_price, platform_fee, seller_payout, shipping_cost, session.id, session.payment_intent,
                 shipping_name, shipping_address_line, shipping_postal_code, shipping_city, shipping_country, conversationId]
            );

            const remaining = listing.quantity - Number(quantity);

            await client.query(
                `UPDATE listings SET quantity = $1, status = $2, updated_at = NOW() WHERE id = $3`,
                [remaining, remaining <= 0 ? "sold" : "active", listing.id]
            );

            await client.query("COMMIT");

            await notify(seller_id, "order_update", "Vendeste uma carta (pagamento por cartão)! Tira já uma foto da carta e manda-a ao comprador pela conversa, antes de ires aos CTT.", "encomendas.html");
            await notify(buyer_id, "order_update", "O teu pagamento foi confirmado.", "encomendas.html");

        } catch (error) {
            await client.query("ROLLBACK");
            console.error("Erro ao processar checkout.session.completed:", error);
        } finally {
            client.release();
        }
    }

    res.json({ received: true });
});

module.exports = router;