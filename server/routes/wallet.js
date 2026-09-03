const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const { notify } = require("../utils/notifications");
const stripe = require("../utils/stripe");
const isAdmin = require("../utils/isAdmin");

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5500";


// GET /wallet — o meu saldo + histórico de depósitos/levantamentos
router.get("/", requireAuth, async (req, res) => {
    try {
        const userResult = await pool.query("SELECT balance FROM users WHERE id = $1", [req.user.id]);

        const depositsResult = await pool.query(
            "SELECT * FROM deposits WHERE user_id = $1 ORDER BY created_at DESC",
            [req.user.id]
        );

        const withdrawalsResult = await pool.query(
            "SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC",
            [req.user.id]
        );

        res.json({
            balance: userResult.rows[0].balance,
            deposits: depositsResult.rows,
            withdrawals: withdrawalsResult.rows,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter a carteira." });
    }
});

// POST /wallet/deposit/checkout — depósito instantâneo por cartão ou MB WAY (Stripe).
// Ao contrário de /deposit (transferência bancária), este não fica "pendente":
// assim que a Stripe confirmar o pagamento, o saldo é creditado sozinho (ver o webhook).
router.post("/deposit/checkout", requireAuth, async (req, res) => {
    const { amount } = req.body;

    if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ error: "Indica um valor válido." });
    }

    try {
        const amountCents = Math.round(Number(amount) * 100);

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card", "mb_way"],
            line_items: [{
                price_data: {
                    currency: "eur",
                    product_data: { name: "Depósito na carteira TCGMarketPortugal" },
                    unit_amount: amountCents,
                },
                quantity: 1,
            }],
            metadata: {
                type: "wallet_deposit",
                user_id: String(req.user.id),
                amount: String(amount),
            },
            success_url: `${FRONTEND_URL}/HTML/carteira.html?deposit=success`,
            cancel_url: `${FRONTEND_URL}/HTML/carteira.html?deposit=cancelled`,
        });

        res.json({ url: session.url });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao iniciar o depósito." });
    }
});

// POST /wallet/deposit — pedir para depositar (diz que já transferiu para o IBAN do site)
router.post("/deposit", requireAuth, async (req, res) => {
    const { amount } = req.body;

    if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ error: "Indica um valor válido." });
    }

    try {
        const result = await pool.query(
            `INSERT INTO deposits (user_id, amount) VALUES ($1, $2) RETURNING *`,
            [req.user.id, amount]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao criar pedido de depósito." });
    }
});

// POST /wallet/withdraw — pedir para levantar (o valor fica logo reservado, saindo do saldo)
router.post("/withdraw", requireAuth, async (req, res) => {
    const { amount, iban } = req.body;

    if (!amount || Number(amount) <= 0 || !iban) {
        return res.status(400).json({ error: "Indica o valor e o IBAN para onde enviar o dinheiro." });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const userResult = await client.query("SELECT balance FROM users WHERE id = $1 FOR UPDATE", [req.user.id]);
        const balance = Number(userResult.rows[0].balance);

        if (Number(amount) > balance) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Não tens saldo suficiente." });
        }

        await client.query("UPDATE users SET balance = balance - $1 WHERE id = $2", [amount, req.user.id]);

        const result = await client.query(
            `INSERT INTO withdrawals (user_id, amount, iban) VALUES ($1, $2, $3) RETURNING *`,
            [req.user.id, amount, iban]
        );

        await client.query("COMMIT");

        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ error: "Erro ao criar pedido de levantamento." });
    } finally {
        client.release();
    }
});

// GET /wallet/admin/pending — tudo o que o admin tem por confirmar
router.get("/admin/pending", requireAuth, async (req, res) => {
    if (!isAdmin(req.user)) {
        return res.status(403).json({ error: "Acesso restrito ao administrador do site." });
    }

    try {
        const depositsResult = await pool.query(
            `SELECT deposits.*, users.name AS user_name, users.email AS user_email
             FROM deposits JOIN users ON users.id = deposits.user_id
             WHERE deposits.status = 'pending'
             ORDER BY deposits.created_at ASC`
        );

        const withdrawalsResult = await pool.query(
            `SELECT withdrawals.*, users.name AS user_name, users.email AS user_email
             FROM withdrawals JOIN users ON users.id = withdrawals.user_id
             WHERE withdrawals.status = 'pending'
             ORDER BY withdrawals.created_at ASC`
        );

        res.json({
            deposits: depositsResult.rows,
            withdrawals: withdrawalsResult.rows,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter pedidos pendentes." });
    }
});

// PATCH /wallet/admin/deposits/:id — confirmar ou rejeitar um depósito
router.patch("/admin/deposits/:id", requireAuth, async (req, res) => {
    if (!isAdmin(req.user)) {
        return res.status(403).json({ error: "Acesso restrito ao administrador do site." });
    }

    const { status } = req.body; // 'confirmed' ou 'rejected'

    if (!["confirmed", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Estado inválido." });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const depositResult = await client.query("SELECT * FROM deposits WHERE id = $1 FOR UPDATE", [req.params.id]);
        const deposit = depositResult.rows[0];

        if (!deposit || deposit.status !== "pending") {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Pedido não encontrado ou já resolvido." });
        }

        if (status === "confirmed") {
            await client.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [deposit.amount, deposit.user_id]);
        }

        await client.query(
            "UPDATE deposits SET status = $1, confirmed_at = NOW() WHERE id = $2",
            [status, req.params.id]
        );

        await client.query("COMMIT");

        await notify(
            deposit.user_id,
            "order_update",
            status === "confirmed"
                ? `O teu depósito de ${Number(deposit.amount).toFixed(2)} € foi confirmado.`
                : `O teu depósito de ${Number(deposit.amount).toFixed(2)} € foi rejeitado.`,
            "carteira.html"
        );

        res.json({ ok: true });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar depósito." });
    } finally {
        client.release();
    }
});

// PATCH /wallet/admin/withdrawals/:id — confirmar (dinheiro já enviado) ou rejeitar (devolve o saldo)
router.patch("/admin/withdrawals/:id", requireAuth, async (req, res) => {
    if (!isAdmin(req.user)) {
        return res.status(403).json({ error: "Acesso restrito ao administrador do site." });
    }

    const { status } = req.body; // 'completed' ou 'rejected'

    if (!["completed", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Estado inválido." });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const withdrawalResult = await client.query("SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE", [req.params.id]);
        const withdrawal = withdrawalResult.rows[0];

        if (!withdrawal || withdrawal.status !== "pending") {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Pedido não encontrado ou já resolvido." });
        }

        if (status === "rejected") {
            // devolve o dinheiro que tinha ficado reservado
            await client.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [withdrawal.amount, withdrawal.user_id]);
        }

        await client.query(
            "UPDATE withdrawals SET status = $1, resolved_at = NOW() WHERE id = $2",
            [status, req.params.id]
        );

        await client.query("COMMIT");

        await notify(
            withdrawal.user_id,
            "order_update",
            status === "completed"
                ? `O teu levantamento de ${Number(withdrawal.amount).toFixed(2)} € foi enviado.`
                : `O teu levantamento de ${Number(withdrawal.amount).toFixed(2)} € foi rejeitado e o saldo foi devolvido.`,
            "carteira.html"
        );

        res.json({ ok: true });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar levantamento." });
    } finally {
        client.release();
    }
});

module.exports = router;