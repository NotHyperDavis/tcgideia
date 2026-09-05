const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const isAdmin = require("../utils/isAdmin");
const { notify } = require("../utils/notifications");
const stripe = require("../utils/stripe");

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

    const { status, admin_notes, issue_refund, refund_amount } = req.body;

    if (status && !["open", "in_review", "resolved"].includes(status)) {
        return res.status(400).json({ error: "Estado inválido." });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const disputeResult = await client.query("SELECT * FROM disputes WHERE id = $1", [req.params.id]);
        const existingDispute = disputeResult.rows[0];

        if (!existingDispute) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Reclamação não encontrada." });
        }

        const orderResult = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [existingDispute.order_id]);
        const order = orderResult.rows[0];

        let refundMessage = null;

        if (issue_refund) {
            if (order.payment_status !== "paid") {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Esta encomenda ainda não está paga — não há nada para reembolsar." });
            }

            if (order.status === "cancelled") {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Esta encomenda já está cancelada — o reembolso já deve ter sido tratado." });
            }

            const amountToRefund = refund_amount ? Number(refund_amount) : Number(order.total_price);

            if (!(amountToRefund > 0) || amountToRefund > Number(order.total_price)) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: `O valor a reembolsar tem de estar entre 0.01 € e ${Number(order.total_price).toFixed(2)} €.` });
            }

            const isPartial = amountToRefund < Number(order.total_price);

            if (order.payment_method === "wallet") {
                await client.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [amountToRefund, order.buyer_id]);
                refundMessage = `Reembolsámos-te ${amountToRefund.toFixed(2)} € automaticamente para a carteira.`;

            } else if (order.payment_method === "stripe") {
                if (!order.stripe_payment_intent_id) {
                    await client.query("ROLLBACK");
                    return res.status(500).json({ error: "Encomenda sem referência de pagamento Stripe — não é possível reembolsar automaticamente." });
                }
                await stripe.refunds.create({
                    payment_intent: order.stripe_payment_intent_id,
                    amount: Math.round(amountToRefund * 100),
                });
                refundMessage = `Reembolsámos-te ${amountToRefund.toFixed(2)} € automaticamente para o método de pagamento original.`;

            } else {
                // Transferência bancária: sem forma automática de devolver o dinheiro.
                refundMessage = `A nossa equipa vai tratar do reembolso de ${amountToRefund.toFixed(2)} € manualmente — entraremos em contacto.`;
            }

            // Só cancela a encomenda por completo se o reembolso for total.
            // Num reembolso parcial, a encomenda segue o seu curso normal, mas o
            // valor a repassar ao vendedor tem de descer no mesmo valor, senão o
            // vendedor recebia a mais do que devia quando a encomenda for concluída.
            if (!isPartial) {
                await client.query(
                    `UPDATE orders SET status = 'cancelled', payout_status = 'pending', updated_at = NOW() WHERE id = $1`,
                    [order.id]
                );
            } else {
                await client.query(
                    `UPDATE orders SET seller_payout = GREATEST(seller_payout - $1, 0), updated_at = NOW() WHERE id = $2`,
                    [amountToRefund, order.id]
                );
            }
        }

        const result = await client.query(
            `UPDATE disputes SET
                status = COALESCE($1, status),
                admin_notes = COALESCE($2, admin_notes),
                updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [status, admin_notes, req.params.id]
        );

        await client.query("COMMIT");

        const dispute = result.rows[0];

        if (status === "resolved" && order) {
            await notify(
                order.buyer_id, "order_update",
                refundMessage ? `A tua reclamação foi resolvida. ${refundMessage}` : "A tua reclamação foi marcada como resolvida.",
                "encomendas.html"
            );
            await notify(
                order.seller_id, "order_update",
                issue_refund ? "Uma reclamação foi resolvida com reembolso ao comprador — a encomenda foi cancelada." : "Uma reclamação sobre uma encomenda tua foi marcada como resolvida.",
                "encomendas.html"
            );
        }

        res.json(dispute);

    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar a reclamação." });
    } finally {
        client.release();
    }
});

module.exports = router;