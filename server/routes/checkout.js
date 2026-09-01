const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const stripe = require("../utils/stripe");

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5500";
const COMMISSION_RATE = Number(process.env.COMMISSION_RATE) || 0.08;

// Tem de ser exatamente igual à função em orders.js e no product.js do frontend
function estimateWeight(quantity) {
    return 15 + quantity * 2;
}

function calcShipping(totalWeightGrams) {
    if (totalWeightGrams <= 20) return 1.15;
    if (totalWeightGrams <= 50) return 1.50;
    if (totalWeightGrams <= 100) return 1.80;
    if (totalWeightGrams <= 500) return 3.00;
    return 5.55;
}

// POST /checkout/session — cria a sessão de pagamento por cartão (Stripe Checkout)
router.post("/session", requireAuth, async (req, res) => {
    const { listing_id, quantity } = req.body;

    if (!listing_id || !quantity) {
        return res.status(400).json({ error: "Indica a carta e a quantidade." });
    }

    try {
        const listingResult = await pool.query(
            `SELECT listings.*, users.stripe_account_id, users.stripe_onboarding_complete
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

        const basePrice = Number((listing.price * quantity).toFixed(2));
        const totalWeight = estimateWeight(quantity);
        const shippingCost = calcShipping(totalWeight);
        const platformFee = Number((basePrice * COMMISSION_RATE).toFixed(2));
        const totalPrice = Number((basePrice + shippingCost + platformFee).toFixed(2));
        const sellerPayout = basePrice; // o vendedor recebe só o preço que pediu

        // A Stripe trabalha em cêntimos, sempre números inteiros.
        const totalCents = Math.round(totalPrice * 100);
        const feeCents = Math.round((totalPrice - sellerPayout) * 100); // tudo o que NÃO é o preço da carta fica para o site

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
            payment_intent_data: {
                application_fee_amount: feeCents,
                transfer_data: { destination: listing.stripe_account_id },
            },
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