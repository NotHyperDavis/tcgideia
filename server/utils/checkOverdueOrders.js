const pool = require("../db");
const stripe = require("./stripe");
const { notify } = require("./notifications");

const STRIKE_THRESHOLD = 3; // ao 3º incumprimento, a conta é suspensa

// Aplica um aviso a um utilizador, e suspende-o se atingir o limite.
// `column` é "late_shipment_strikes" ou "late_payment_strikes".
async function addStrike(client, userId, column) {
    const result = await client.query(
        `UPDATE users SET ${column} = ${column} + 1 WHERE id = $1 RETURNING ${column}`,
        [userId]
    );

    const strikes = result.rows[0][column];
    const suspended = strikes >= STRIKE_THRESHOLD;

    if (suspended) {
        await client.query("UPDATE users SET is_suspended = true WHERE id = $1", [userId]);
    }

    return { strikes, suspended };
}

// ---- Vendedores que não enviaram dentro de 7 dias após o pagamento confirmado ----
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
        console.error("Erro ao procurar encomendas em atraso (envio):", error);
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

            await client.query(`UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [order.id]);

            const { strikes, suspended } = await addStrike(client, order.seller_id, "late_shipment_strikes");

            await client.query("COMMIT");

            await notify(
                order.buyer_id, "order_update",
                order.payment_method === "bank_transfer"
                    ? "O vendedor não enviou a tempo. Contacta o suporte para tratarmos do reembolso da tua transferência."
                    : "O vendedor não enviou a tempo — já te reembolsámos automaticamente.",
                "encomendas.html"
            );

            await notify(
                order.seller_id, "order_update",
                suspended
                    ? "A tua conta foi suspensa por incumprimentos repetidos de prazos de envio."
                    : `Não enviaste uma encomenda dentro do prazo de 7 dias (aviso ${strikes}/${STRIKE_THRESHOLD}).`,
                "encomendas.html"
            );

        } catch (error) {
            await client.query("ROLLBACK");
            console.error(`Erro ao processar a encomenda em atraso (envio) #${order.id}:`, error);
        } finally {
            client.release();
        }
    }
}

// ---- Compradores que não pagaram (transferência bancária) dentro de 5 dias ----
async function checkOverduePayments() {
    let overdueOrders;

    try {
        const result = await pool.query(
            `SELECT * FROM orders
             WHERE status = 'committed' AND payment_status = 'pending' AND payment_method IN ('bank_transfer', 'wallet')
               AND created_at < NOW() - INTERVAL '5 days'`
        );
        overdueOrders = result.rows;
    } catch (error) {
        console.error("Erro ao procurar encomendas em atraso (pagamento):", error);
        return;
    }

    for (const order of overdueOrders) {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Devolve a quantidade ao anúncio, já que a encomenda nunca chegou a ser paga.
            await client.query(
                `UPDATE listings SET quantity = quantity + $1, status = 'active', updated_at = NOW() WHERE id = $2`,
                [order.quantity, order.listing_id]
            );

            await client.query(`UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [order.id]);

            const { strikes, suspended } = await addStrike(client, order.buyer_id, "late_payment_strikes");

            await client.query("COMMIT");

            await notify(
                order.buyer_id, "order_update",
                suspended
                    ? "A tua conta foi suspensa por incumprimentos repetidos de prazos de pagamento."
                    : `Não pagaste uma encomenda dentro do prazo de 5 dias, por isso foi cancelada (aviso ${strikes}/${STRIKE_THRESHOLD}).`,
                "encomendas.html"
            );

            await notify(order.seller_id, "order_update", "Uma encomenda foi cancelada — o comprador não pagou a tempo.", "encomendas.html");

        } catch (error) {
            await client.query("ROLLBACK");
            console.error(`Erro ao processar a encomenda em atraso (pagamento) #${order.id}:`, error);
        } finally {
            client.release();
        }
    }
}

async function checkOverdueOrders() {
    await checkOverdueShipments();
    await checkOverduePayments();
}

module.exports = checkOverdueOrders;