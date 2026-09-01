const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const stripe = require("../utils/stripe");

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5500";
const COMMISSION_RATE_INDIVIDUAL = Number(process.env.COMMISSION_RATE_INDIVIDUAL) || 0.08;
const COMMISSION_RATE_STORE = Number(process.env.COMMISSION_RATE_STORE) || 0.05;

function commissionRateFor(accountType) {
    return accountType === "store" ? COMMISSION_RATE_STORE : COMMISSION_RATE_INDIVIDUAL;
}
const COMMISSION_CAP = Number(process.env.COMMISSION_CAP) || 100; // nunca mais que isto por carta

// Tem de ser exatamente igual à função em orders.js e no product.js do frontend
function estimateWeight(quantity) {
    return 15 + quantity * 2;
}

// Correio Azul da CTT (tarifário 2026) — serviço recomendado para bens ao estrangeiro.
function calcShipping(totalWeightGrams, country = "PT") {
    if (country === "ES") {
        if (totalWeightGrams <= 100) return 2.10;
        if (totalWeightGrams <= 500) return 3.90;
        return 7.80;
    }

    if (totalWeightGrams <= 20) return 1.15;
    if (totalWeightGrams <= 50) return 1.50;
    if (totalWeightGrams <= 100) return 1.80;
    if (totalWeightGrams <= 500) return 3.00;
    return 5.55;
}

// POST /checkout/session — cria a sessão de pagamento por cartão (Stripe Checkout)
//
// IMPORTANTE: o dinheiro do comprador fica retido na TUA conta Stripe (não vai logo
// para o vendedor). Só quando o comprador confirmar que recebeu a carta é que o
// repasse ao vendedor é feito (ver PATCH /orders/:id em orders.js). Por isso, ao
// contrário de uma "destination charge", aqui NÃO usamos transfer_data/application_fee_amount
// na criação da sessão — isso faria o dinheiro sair logo no momento do pagamento.
router.post("/session", requireAuth, async (req, res) => {
    const { listing_id, quantity } = req.body;

    if (!listing_id || !quantity) {
        return res.status(400).json({ error: "Indica a carta e a quantidade." });
    }

    try {
        const listingResult = await pool.query(
            `SELECT listings.*, users.stripe_account_id, users.stripe_onboarding_complete, users.account_type AS seller_account_type
             FROM listings
             JOIN users ON users.id = listings.user_id
             WHERE listings.id = $1`,
            [listing_id]
        );

        const listing = listingResult.rows[0];

        if (!listing || listing.status !== "active") {
            return res.status(404).json({ error: "Este anúncio já não está disponível." });
        }

        if (listing.user_id === req.user.id) {
            return res.status(400).json({ error: "Não podes comprar o teu próprio anúncio." });
        }

        if (Number(quantity) > listing.quantity) {
            return res.status(400).json({ error: "Não há quantidade suficiente disponível." });
        }

        if (!listing.stripe_account_id || !listing.stripe_onboarding_complete) {
            return res.status(400).json({ error: "Este vendedor ainda não ativou os pagamentos por cartão. Sugere-lhe transferência bancária ou carteira." });
        }

        const buyerResult = await pool.query("SELECT country FROM users WHERE id = $1", [req.user.id]);
        const buyerCountry = buyerResult.rows[0]?.country || "PT";

        const basePrice = Number((listing.price * quantity).toFixed(2));
        const totalWeight = estimateWeight(quantity);
        const shippingCost = calcShipping(totalWeight, buyerCountry);

        // O comprador paga só o preço da carta + portes reais.
        const totalPrice = Number((basePrice + shippingCost).toFixed(2));
        // A comissão (com teto por carta) fica retida contigo; o resto vai para o
        // vendedor só depois da entrega ser confirmada (não é transferido agora).
        const platformFee = Math.min(Number((basePrice * commissionRateFor(listing.seller_account_type)).toFixed(2)), COMMISSION_CAP);
        const sellerPayout = Number((totalPrice - platformFee).toFixed(2));

        // A Stripe trabalha em cêntimos, sempre números inteiros.
        const totalCents = Math.round(totalPrice * 100);

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [{
                price_data: {
                    currency: "eur",
                    product_data: { name: `${listing.card_name} (x${quantity})` },
                    unit_amount: totalCents,
                },
                quantity: 1,
            }],
            // Sem payment_intent_data/transfer_data de propósito — o dinheiro fica
            // na tua conta Stripe até confirmares a entrega (ver nota acima).
            metadata: {
                listing_id: String(listing.id),
                buyer_id: String(req.user.id),
                seller_id: String(listing.user_id),
                quantity: String(quantity),
                unit_price: String(listing.price),
                shipping_cost: String(shippingCost),
                platform_fee: String(platformFee),
                total_price: String(totalPrice),
                seller_payout: String(sellerPayout),
            },
            success_url: `${FRONTEND_URL}/HTML/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${FRONTEND_URL}/HTML/product.html?id=${listing.id}`,
        });

        res.json({ url: session.url });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao iniciar o pagamento." });
    }
});

module.exports = router;