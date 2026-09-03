const pool = require("../db");
const stripe = require("./stripe");
const { notify } = require("./notifications");

const STRIKE_THRESHOLD = 3; // ao 3º incumprimento, a conta do vendedor é suspensa

// Corre periodicamente (ver server.js). Para cada encomenda paga há mais de 7 dias
// que o vendedor ainda não marcou como enviada: cancela, reembolsa o comprador
// (automaticamente para carteira/Stripe; para transferência bancária fica
// sinalizado para o admin tratar à mão, porque não há forma automática de devolver
// uma transferência bancária), e regista um incumprimento no vendedor.
async function checkOverdueShipments() {
    let overdueOrders;

    try {
        const result = await pool.query(
            `SELECT * FROM orders
             WHERE status = 'committed' AND payment_status = 'paid'
               AND created_at < NOW() - INTERVAL '7 days'`
        );
        overdueOrders = result.rows;
    } catch (error) {
        console.error("Erro ao procurar encomendas em atraso:", error);
        return;
    }

    for (const order of overdueOrders) {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            if (order.payment_method === "wallet") {
                await client.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [order.total_price, order.buyer_id]);
            } else if (order.payment_method === "stripe" && order.stripe_payment_intent_id) {
                await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id });
            }
            // transferência bancária: sem reembolso automático — o admin trata à mão

            await client.query(
                `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
                [order.id]
            );

            const strikeResult = await client.query(
                `UPDATE users SET late_shipment_strikes = late_shipment_strikes + 1 WHERE id = $1 RETURNING late_shipment_strikes`,
                [order.seller_id]
            );

            const strikes = strikeResult.rows[0].late_shipment_strikes;
            const suspended = strikes >= STRIKE_THRESHOLD;

            if (suspended) {
                await client.query("UPDATE users SET is_suspended = true WHERE id = $1", [order.seller_id]);
            }

            await client.query("COMMIT");

            await notify(
                order.buyer_id,
                "order_update",
                order.payment_method === "bank_transfer"
                    ? "O vendedor não enviou a tempo. Contacta o suporte para tratarmos do reembolso da tua transferência."
                    : "O vendedor não enviou a tempo — já te reembolsámos automaticamente.",
                "encomendas.html"
            );

            await notify(
                order.seller_id,
                "order_update",
                suspended
                    ? "A tua conta foi suspensa por incumprimentos repetidos de prazos de envio."
                    : `Não enviaste uma encomenda dentro do prazo de 7 dias (aviso ${strikes}/${STRIKE_THRESHOLD}).`,
                "encomendas.html"
            );

        } catch (error) {
            await client.query("ROLLBACK");
            console.error(`Erro ao processar a encomenda em atraso #${order.id}:`, error);
        } finally {
            client.release();
        }
    }
}

module.exports = checkOverdueShipments;