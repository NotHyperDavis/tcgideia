const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const requireVerifiedEmail = require("../middleware/requireVerifiedEmail");
const { notify } = require("../utils/notifications");
const stripe = require("../utils/stripe");
const isAdmin = require("../utils/isAdmin");

const router = express.Router();

// A Cardmarket cobra mais % a vendedores privados do que a lojas/profissionais
// (incentiva a profissionalização). Fazemos o mesmo aqui.
const COMMISSION_RATE_INDIVIDUAL = Number(process.env.COMMISSION_RATE_INDIVIDUAL) || 0.08;
const COMMISSION_RATE_STORE = Number(process.env.COMMISSION_RATE_STORE) || 0.05;
const COMMISSION_CAP = Number(process.env.COMMISSION_CAP) || 100; // nunca mais que isto por carta

function commissionRateFor(accountType) {
    return accountType === "store" ? COMMISSION_RATE_STORE : COMMISSION_RATE_INDIVIDUAL;
}

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

// Comprometer-se a comprar (equivalente ao "commit to buy" do Cardmarket)
router.post("/", requireAuth, requireVerifiedEmail, async (req, res) => {
    const { listing_id, quantity, payment_method, shipping } = req.body;

    if (!listing_id || !quantity || !payment_method) {
        return res.status(400).json({ error: "Indica a carta, a quantidade e o método de pagamento." });
    }

    // A morada é obrigatória — sem ela o vendedor não sabe para onde enviar.
    if (!shipping || !shipping.name || !shipping.address_line || !shipping.postal_code || !shipping.city) {
        return res.status(400).json({ error: "Preenche a morada de envio completa (nome, morada, código postal e localidade)." });
    }

    if (!["bank_transfer", "stripe", "instant", "wallet"].includes(payment_method)) {
        return res.status(400).json({ error: "Método de pagamento inválido." });
    }

    if (!["bank_transfer", "wallet"].includes(payment_method)) {
        return res.status(400).json({ error: "Esse método de pagamento ainda não está disponível. Usa transferência bancária ou a carteira por agora." });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const listingResult = await client.query(
            "SELECT * FROM listings WHERE id = $1 FOR UPDATE",
            [listing_id]
        );

        const listing = listingResult.rows[0];

        if (!listing || listing.status !== "active") {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Este anúncio já não está disponível." });
        }

        if (listing.user_id === req.user.id) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Não podes comprar o teu próprio anúncio." });
        }

        if (Number(quantity) > listing.quantity) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Não há quantidade suficiente disponível." });
        }

        const buyerCountryResult = await client.query("SELECT country FROM users WHERE id = $1", [req.user.id]);
        const buyerCountry = buyerCountryResult.rows[0]?.country || "PT";

        const sellerAccountResult = await client.query("SELECT account_type FROM users WHERE id = $1", [listing.user_id]);
        const sellerAccountType = sellerAccountResult.rows[0]?.account_type || "individual";

        const basePrice = Number((listing.price * quantity).toFixed(2));
        const totalWeight = estimateWeight(quantity);
        const shippingCost = calcShipping(totalWeight, buyerCountry);

        // O comprador paga só o preço da carta + portes reais.
        const totalPrice = Number((basePrice + shippingCost).toFixed(2));
        // A comissão (com teto por carta) fica retida para o site; o resto só é
        // repassado ao vendedor quando o comprador confirmar a receção (ver PATCH abaixo).
        const platformFee = Math.min(Number((basePrice * commissionRateFor(sellerAccountType)).toFixed(2)), COMMISSION_CAP);
        const sellerPayout = Number((totalPrice - platformFee).toFixed(2));

        const orderResult = await client.query(
            `INSERT INTO orders (listing_id, buyer_id, seller_id, quantity, unit_price, total_price, payment_method, payment_status, platform_fee, seller_payout, shipping_cost,
                                 shipping_name, shipping_address_line, shipping_postal_code, shipping_city, shipping_country)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             RETURNING *`,
            [
                listing.id, req.user.id, listing.user_id, quantity, listing.price, totalPrice, payment_method,
                payment_method === "wallet" ? "paid" : "pending",
                platformFee, sellerPayout, shippingCost,
                shipping.name, shipping.address_line, shipping.postal_code, shipping.city, buyerCountry
            ]
        );

        if (payment_method === "wallet") {
            const buyerResult = await client.query("SELECT balance FROM users WHERE id = $1 FOR UPDATE", [req.user.id]);
            const buyerBalance = Number(buyerResult.rows[0].balance);

            if (totalPrice > buyerBalance) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: `Saldo insuficiente. Precisas de ${totalPrice.toFixed(2)} € e tens ${buyerBalance.toFixed(2)} €.` });
            }

            // Só se debita o comprador agora. O vendedor NÃO é creditado aqui —
            // só recebe quando o comprador confirmar a receção da carta.
            await client.query("UPDATE users SET balance = balance - $1 WHERE id = $2", [totalPrice, req.user.id]);
        }

        const remaining = listing.quantity - quantity;

        await client.query(
            `UPDATE listings SET quantity = $1, status = $2, updated_at = NOW() WHERE id = $3`,
            [remaining, remaining === 0 ? "sold" : "active", listing.id]
        );

        await client.query("COMMIT");

        if (payment_method === "wallet") {
            await notify(listing.user_id, "order_update", "Vendeste uma carta! O pagamento já está confirmado, podes enviar.", "encomendas.html");
        }

        res.status(201).json(orderResult.rows[0]);

    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ error: "Erro ao criar encomenda." });
    } finally {
        client.release();
    }
});

// Encomendas que eu fiz (como comprador)
router.get("/mine", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT orders.*, listings.card_name, listings.card_image,
                    users.name AS seller_name, users.email AS seller_email
             FROM orders
             JOIN listings ON listings.id = orders.listing_id
             JOIN users ON users.id = orders.seller_id
             WHERE orders.buyer_id = $1
             ORDER BY orders.created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter as tuas encomendas." });
    }
});

// Encomendas que recebi (como vendedor)
router.get("/selling", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT orders.*, listings.card_name, listings.card_image,
                    users.name AS buyer_name, users.email AS buyer_email
             FROM orders
             JOIN listings ON listings.id = orders.listing_id
             JOIN users ON users.id = orders.buyer_id
             WHERE orders.seller_id = $1
             ORDER BY orders.created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter as encomendas recebidas." });
    }
});

// Todas as encomendas pagas mas ainda por repassar ao vendedor (só para ti, o admin)
// Só é relevante para transferência bancária agora — carteira e Stripe repassam sozinhos.
router.get("/admin/payouts", requireAuth, async (req, res) => {
    if (!isAdmin(req.user)) {
        return res.status(403).json({ error: "Acesso restrito ao administrador do site." });
    }

    try {
        const result = await pool.query(
            `SELECT orders.*, listings.card_name,
                    buyer.name AS buyer_name, buyer.email AS buyer_email,
                    seller.name AS seller_name, seller.email AS seller_email
             FROM orders
             JOIN listings ON listings.id = orders.listing_id
             JOIN users buyer ON buyer.id = orders.buyer_id
             JOIN users seller ON seller.id = orders.seller_id
             ORDER BY orders.created_at DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter encomendas." });
    }
});

// Atualizar o estado de uma encomenda.
//
// Regra nova: o vendedor só recebe o dinheiro (carteira ou Stripe) quando o
// COMPRADOR confirma que recebeu a carta (status="completed"). Nesse momento,
// o sistema faz o repasse automaticamente:
//   - carteira: credita o saldo do vendedor
//   - stripe: cria uma transferência para a conta Stripe do vendedor
//   - transferência bancária: continua a ser o admin a repassar à mão,
//     mas só pode fazê-lo depois da entrega confirmada.
router.patch("/:id", requireAuth, async (req, res) => {
    const { payment_status, status, payout_status } = req.body;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const existing = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [req.params.id]);

        if (existing.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Encomenda não encontrada." });
        }

        const order = existing.rows[0];
        const isSeller = order.seller_id === req.user.id;
        const isBuyer = order.buyer_id === req.user.id;
        const admin = isAdmin(req.user);

        if (!isSeller && !isBuyer && !admin) {
            await client.query("ROLLBACK");
            return res.status(403).json({ error: "Não tens acesso a esta encomenda." });
        }

        if (payment_status && !admin) {
            await client.query("ROLLBACK");
            return res.status(403).json({ error: "Só o administrador do site pode confirmar pagamentos." });
        }

        if (status === "shipped") {
            if (!isSeller) {
                await client.query("ROLLBACK");
                return res.status(403).json({ error: "Só o vendedor pode marcar como enviado." });
            }
            if (order.payment_status !== "paid") {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Ainda não podes enviar: o pagamento não está confirmado." });
            }

            const photoCheck = await client.query(
                `SELECT id FROM order_messages WHERE order_id = $1 AND sender_id = $2 AND image_url IS NOT NULL LIMIT 1`,
                [order.id, req.user.id]
            );
            if (photoCheck.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Antes de enviares, manda uma foto da carta ao comprador pela conversa da encomenda." });
            }
        }

        if (status === "completed" && !isBuyer && !admin) {
            await client.query("ROLLBACK");
            return res.status(403).json({ error: "Só o comprador pode confirmar a receção." });
        }

        if (status === "cancelled" && order.status !== "committed") {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Já não é possível cancelar esta encomenda." });
        }

        if (status === "cancelled") {
            const hoursSinceCommitted = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60);
            if (hoursSinceCommitted > 24) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Já não é possível cancelar — passaram mais de 24 horas desde o compromisso de compra." });
            }
        }

        // Repasse manual (só para transferência bancária, e só o admin) — agora exige
        // que a entrega já tenha sido confirmada.
        if (payout_status) {
            if (!admin) {
                await client.query("ROLLBACK");
                return res.status(403).json({ error: "Só o administrador do site pode confirmar repasses." });
            }
            if (order.payment_method !== "bank_transfer") {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Este método de pagamento repassa automaticamente — não precisas de o fazer à mão." });
            }
            if (order.status !== "completed" && status !== "completed") {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Só podes repassar depois de o comprador confirmar a receção." });
            }
        }

        // Repasse automático: acontece uma única vez, exatamente quando a entrega
        // passa a "completed" pela primeira vez, para carteira e Stripe.
        const isFirstTimeCompleted = status === "completed" && order.status !== "completed";
        let autoPayoutStatus = null;

        if (isFirstTimeCompleted && order.payout_status === "pending") {
            if (order.payment_method === "wallet") {
                await client.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [order.seller_payout, order.seller_id]);
                autoPayoutStatus = "paid_out";
            }

            if (order.payment_method === "stripe") {
                if (!order.stripe_payment_intent_id) {
                    await client.query("ROLLBACK");
                    return res.status(500).json({ error: "Encomenda sem referência de pagamento Stripe — contacta o suporte." });
                }

                const sellerResult = await client.query("SELECT stripe_account_id FROM users WHERE id = $1", [order.seller_id]);
                const sellerStripeAccountId = sellerResult.rows[0]?.stripe_account_id;

                if (!sellerStripeAccountId) {
                    await client.query("ROLLBACK");
                    return res.status(500).json({ error: "O vendedor já não tem conta Stripe ligada — contacta o suporte." });
                }

                // Vai buscar o charge associado ao pagamento, para a transferência
                // sair mesmo desse dinheiro (source_transaction).
                const paymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);

                await stripe.transfers.create({
                    amount: Math.round(Number(order.seller_payout) * 100),
                    currency: "eur",
                    destination: sellerStripeAccountId,
                    source_transaction: paymentIntent.latest_charge,
                });

                autoPayoutStatus = "paid_out";
            }
        }

        const result = await client.query(
            `UPDATE orders
             SET payment_status = COALESCE($1, payment_status),
                 status = COALESCE($2, status),
                 payout_status = COALESCE($3, COALESCE($4, payout_status)),
                 updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [payment_status, status, payout_status, autoPayoutStatus, req.params.id]
        );

        await client.query("COMMIT");

        const updated = result.rows[0];

        if (payment_status === "paid") {
            await notify(order.seller_id, "order_update", "O pagamento da tua venda foi confirmado — já podes enviar.", "encomendas.html");
            await notify(order.buyer_id, "order_update", "O teu pagamento foi confirmado.", "encomendas.html");
        }
        if (status === "shipped") {
            await notify(order.buyer_id, "order_update", "O vendedor enviou a tua encomenda.", "encomendas.html");
        }
        if (status === "completed") {
            await notify(order.seller_id, "order_update",
                autoPayoutStatus === "paid_out"
                    ? `O comprador confirmou a receção — já te repassámos ${Number(order.seller_payout).toFixed(2)} €.`
                    : "O comprador confirmou a receção da encomenda.",
                "encomendas.html");
        }
        if (status === "cancelled") {
            const otherUserId = req.user.id === order.buyer_id ? order.seller_id : order.buyer_id;
            await notify(otherUserId, "order_update", "Uma encomenda foi cancelada.", "encomendas.html");
        }
        if (payout_status === "paid_out") {
            await notify(order.seller_id, "order_update", "O site repassou-te o valor desta venda.", "encomendas.html");
        }

        res.json(updated);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar encomenda." });
    } finally {
        client.release();
    }
});

module.exports = router;