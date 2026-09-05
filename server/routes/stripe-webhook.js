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

    if (event.type === "charge.dispute.created") {
        const charge = event.data.object;

        try {
            const orderResult = await pool.query(
                "SELECT * FROM orders WHERE stripe_payment_intent_id = $1",
                [charge.payment_intent]
            );
            const order = orderResult.rows[0];

            if (order) {
                // Regista automaticamente como reclamação, para apareceres logo
                // no painel de admin — uma contestação bancária é sempre algo
                // sério que precisa de atenção humana, nunca é resolvida sozinha.
                await pool.query(
                    `INSERT INTO disputes (order_id, opened_by, reason, description, status, admin_notes)
                     VALUES ($1, $2, 'outro', $3, 'open', $4)`,
                    [
                        order.id,
                        order.buyer_id,
                        "Contestação bancária (chargeback) aberta automaticamente pela Stripe.",
                        `Valor contestado: ${(charge.amount / 100).toFixed(2)} ${charge.currency.toUpperCase()}. Motivo dado pelo banco: ${charge.reason || "não especificado"}.`,
                    ]
                );

                await notify(order.seller_id, "order_update", "Atenção: uma venda tua foi contestada junto do banco do comprador. A nossa equipa vai analisar.", "encomendas.html");
            }

            console.error(`⚠️ Chargeback recebido para payment_intent ${charge.payment_intent} — encomenda ${order?.id ?? "não encontrada"}.`);

        } catch (error) {
            console.error("Erro ao processar charge.dispute.created:", error);
        }

        return res.json({ received: true });
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

            if (!listing || Number(quantity) > listing.quantity) {
                // Já não há stock suficiente — o comprador já pagou via Stripe,
                // por isso reembolsamos automaticamente em vez de o deixar sem
                // carta e sem dinheiro.
                await stripe.refunds.create({ payment_intent: session.payment_intent });
                await client.query("COMMIT");

                await notify(
                    Number(buyer_id), "order_update",
                    "Infelizmente essa carta esgotou mesmo antes do teu pagamento ser processado — já te reembolsámos automaticamente.",
                    "marketplace.html"
                );

                return res.json({ received: true });
            }

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