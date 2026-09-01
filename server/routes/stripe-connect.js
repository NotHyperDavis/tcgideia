const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const stripe = require("../utils/stripe");

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5500";

// POST /stripe-connect/onboard — cria (se ainda não existir) a conta Stripe Connect
// do vendedor e devolve o link de onboarding hospedado pela própria Stripe.
router.post("/onboard", requireAuth, async (req, res) => {
    try {
        const userResult = await pool.query("SELECT stripe_account_id, email FROM users WHERE id = $1", [req.user.id]);
        let { stripe_account_id, email } = userResult.rows[0];

        // Só cria a conta Stripe uma vez; se já existir, reaproveita.
        if (!stripe_account_id) {
            const account = await stripe.accounts.create({
                controller: {
                    stripe_dashboard: { type: "express" },
                    fees: { payer: "application" },
                    losses: { payments: "application" },
                },
                email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
            });

            stripe_account_id = account.id;

            await pool.query("UPDATE users SET stripe_account_id = $1 WHERE id = $2", [stripe_account_id, req.user.id]);
        }

        // O link de onboarding só é válido por pouco tempo, por isso gera-se sempre um novo.
        const accountLink = await stripe.accountLinks.create({
            account: stripe_account_id,
            refresh_url: `${FRONTEND_URL}/HTML/stripe-onboarding.html?refresh=true`,
            return_url: `${FRONTEND_URL}/HTML/stripe-onboarding.html?return=true`,
            type: "account_onboarding",
        });

        res.json({ url: accountLink.url });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao iniciar a ligação com a Stripe." });
    }
});

// GET /stripe-connect/status — verifica se o vendedor já pode receber pagamentos
router.get("/status", requireAuth, async (req, res) => {
    try {
        const userResult = await pool.query("SELECT stripe_account_id FROM users WHERE id = $1", [req.user.id]);
        const { stripe_account_id } = userResult.rows[0];

        if (!stripe_account_id) {
            return res.json({ connected: false, charges_enabled: false, payouts_enabled: false });
        }

        const account = await stripe.accounts.retrieve(stripe_account_id);

        // Atualiza o nosso registo local para refletir o estado mais recente.
        await pool.query(
            "UPDATE users SET stripe_onboarding_complete = $1 WHERE id = $2",
            [account.charges_enabled && account.payouts_enabled, req.user.id]
        );

        res.json({
            connected: true,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao verificar o estado da conta Stripe." });
    }
});

module.exports = router;