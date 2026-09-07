const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const requireVerifiedEmail = require("../middleware/requireVerifiedEmail");
const stripe = require("../utils/stripe");

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5500";
const COMMISSION_RATE_INDIVIDUAL = Number(process.env.COMMISSION_RATE_INDIVIDUAL) || 0.08;
const COMMISSION_RATE_STORE = Number(process.env.COMMISSION_RATE_STORE) || 0.05;

function commissionRateFor(accountType) {
    return accountType === "store" ? COMMISSION_RATE_STORE : COMMISSION_RATE_INDIVIDUAL;
}
const COMMISSION_CAP = Number(process.env.COMMISSION_CAP) || 100; // nunca mais que isto por carta

// Tarifário CTT 2026, categoria "Pacote postal" (bens e documentos).
const CTT_RATES = {
    normal: {
        PT: [[20, 1.58], [50, 1.58], [100, 1.58], [500, 2.34], [2000, 5.55]],
        ES: [[20, 2.65], [50, 2.65], [100, 2.65], [250, 4.25], [500, 7.05], [1000, 10.85], [2000, 18.47]],
    },
    azul: {
        PT: [[20, 2.10], [50, 2.10], [100, 2.10], [500, 3.90], [2000, 7.80]],
        ES: [[20, 5.80], [50, 5.80], [100, 5.80], [250, 7.55], [500, 9.80], [1000, 13.20], [2000, 21.20]],
    },
    registado: {
        PT: [[20, 4.60], [50, 4.60], [100, 4.60], [500, 5.40], [2000, 8.93]],
        ES: [[20, 7.30], [50, 7.30], [100, 7.30], [250, 8.60], [500, 11.10], [1000, 15.55], [2000, 23.35]],
    },
};

function calcShipping(totalWeightGrams, country = "PT", service = "azul") {
    const table = CTT_RATES[service] || CTT_RATES.azul;
    const bands = table[country === "ES" ? "ES" : "PT"];

    for (const [maxWeight, price] of bands) {
        if (totalWeightGrams <= maxWeight) return price;
    }

    return bands[bands.length - 1][1];
}

// POST /checkout/session — cria a sessão de pagamento por cartão (Stripe Checkout)
//
// IMPORTANTE: o dinheiro do comprador fica retido na TUA conta Stripe (não vai logo
// para o vendedor). Só quando o comprador confirmar que recebeu a carta é que o
// repasse ao vendedor é feito (ver PATCH /orders/:id em orders.js). Por isso, ao
// contrário de uma "destination charge", aqui NÃO usamos transfer_data/application_fee_amount
// na criação da sessão — isso faria o dinheiro sair logo no momento do pagamento.
router.post("/session", requireAuth, requireVerifiedEmail, async (req, res) => {
    const { listing_id, quantity, shipping } = req.body;

    if (!listing_id || !quantity) {
        return res.status(400).json({ error: "Indica a carta e a quantidade." });
    }

    if (!shipping || !shipping.name || !shipping.address_line || !shipping.postal_code || !shipping.city) {
        return res.status(400).json({ error: "Preenche a morada de envio completa (nome, morada, código postal e localidade)." });
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
        const totalWeight = 10 + (listing.weight_grams || 5) * quantity;
        const shippingCost = calcShipping(totalWeight, buyerCountry, listing.shipping_service);

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
            payment_method_types: ["card", "mb_way", "bizum"],
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
                shipping_name: shipping.name,
                shipping_address_line: shipping.address_line,
                shipping_postal_code: shipping.postal_code,
                shipping_city: shipping.city,
                shipping_country: buyerCountry,
                shipping_service: listing.shipping_service || "azul",
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