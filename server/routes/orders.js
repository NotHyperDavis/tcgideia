const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const { notify } = require("../utils/notifications_util");

const router = express.Router();

// A % que o site cobra a mais ao comprador (o vendedor recebe sempre o valor total do anúncio).
const COMMISSION_RATE = Number(process.env.COMMISSION_RATE) || 0.08;

// O site é gerido por ti — só a tua conta pode confirmar pagamentos e repasses.
function isAdmin(user) {
    return user.email === process.env.ADMIN_EMAIL;
}

// Portes calculados pelo peso total do envio (peso da carta x quantidade).
// Baseado nos preços aproximados dos CTT (com IVA). Ajusta se os preços mudarem.
function calcShipping(totalWeightGrams) {
    if (totalWeightGrams <= 20) return 1.15;
    if (totalWeightGrams <= 50) return 1.50;
    if (totalWeightGrams <= 100) return 1.80;
    if (totalWeightGrams <= 500) return 3.00;
    return 5.55; // até 2kg
}

// Comprometer-se a comprar (equivalente ao "commit to buy" do Cardmarket)
router.post("/", requireAuth, async (req, res) => {
    const { listing_id, quantity, payment_method } = req.body;

    if (!listing_id || !quantity || !payment_method) {
        return res.status(400).json({ error: "Indica a carta, a quantidade e o método de pagamento." });
    }

    if (!["bank_transfer", "stripe", "instant"].includes(payment_method)) {
        return res.status(400).json({ error: "Método de pagamento inválido." });
    }

    if (payment_method !== "bank_transfer") {
        return res.status(400).json({ error: "Esse método de pagamento ainda não está disponível. Usa transferência bancária por agora." });
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

        const basePrice = Number((listing.price * quantity).toFixed(2));
        const totalWeight = listing.weight_grams * quantity;
        const shippingCost = calcShipping(totalWeight);
        const platformFee = Number((basePrice * COMMISSION_RATE).toFixed(2));

        // O comprador paga o preço da carta + portes + a taxa do site.
        const totalPrice = Number((basePrice + shippingCost + platformFee).toFixed(2));
        // O vendedor recebe o preço total que pediu, mais os portes (nada é descontado a ele).
        const sellerPayout = Number((basePrice + shippingCost).toFixed(2));

        const orderResult = await client.query(
            `INSERT INTO orders (listing_id, buyer_id, seller_id, quantity, unit_price, total_price, payment_method, platform_fee, seller_payout, shipping_cost)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [listing.id, req.user.id, listing.user_id, quantity, listing.price, totalPrice, payment_method, platformFee, sellerPayout, shippingCost]
        );

        const remaining = listing.quantity - quantity;

        await client.query(
            `UPDATE listings SET quantity = $1, status = $2, updated_at = NOW() WHERE id = $3`,
            [remaining, remaining === 0 ? "sold" : "active", listing.id]
        );

        await client.query("COMMIT");

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
// Cada campo só pode ser mudado por quem faz sentido:
// - payment_status  -> só o admin (é ele que recebe o dinheiro do comprador)
// - status=shipped  -> só o vendedor, e só depois do pagamento confirmado
// - status=completed -> só o comprador (confirma que recebeu a carta)
// - status=cancelled -> comprador ou vendedor, só enquanto ainda "committed"
// - payout_status   -> só o admin (é ele que repassa o dinheiro ao vendedor)
router.patch("/:id", requireAuth, async (req, res) => {
    const { payment_status, status, payout_status } = req.body;

    try {
        const existing = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: "Encomenda não encontrada." });
        }

        const order = existing.rows[0];
        const isSeller = order.seller_id === req.user.id;
        const isBuyer = order.buyer_id === req.user.id;
        const admin = isAdmin(req.user);

        if (!isSeller && !isBuyer && !admin) {
            return res.status(403).json({ error: "Não tens acesso a esta encomenda." });
        }

        if ((payment_status || payout_status) && !admin) {
            return res.status(403).json({ error: "Só o administrador do site pode confirmar pagamentos e repasses." });
        }

        if (status === "shipped") {
            if (!isSeller) {
                return res.status(403).json({ error: "Só o vendedor pode marcar como enviado." });
            }
            if (order.payment_status !== "paid") {
                return res.status(400).json({ error: "Ainda não podes enviar: o pagamento não está confirmado." });
            }
        }

        if (status === "completed" && !isBuyer && !admin) {
            return res.status(403).json({ error: "Só o comprador pode confirmar a receção." });
        }

        if (status === "cancelled" && order.status !== "committed") {
            return res.status(400).json({ error: "Já não é possível cancelar esta encomenda." });
        }

        const result = await pool.query(
            `UPDATE orders
             SET payment_status = COALESCE($1, payment_status),
                 status = COALESCE($2, status),
                 payout_status = COALESCE($3, payout_status),
                 updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [payment_status, status, payout_status, req.params.id]
        );

        const updated = result.rows[0];

        if (payment_status === "paid") {
            await notify(order.seller_id, "order_update", "O pagamento da tua venda foi confirmado — já podes enviar.", "encomendas.html");
            await notify(order.buyer_id, "order_update", "O teu pagamento foi confirmado.", "encomendas.html");
        }
        if (status === "shipped") {
            await notify(order.buyer_id, "order_update", "O vendedor enviou a tua encomenda.", "encomendas.html");
        }
        if (status === "completed") {
            await notify(order.seller_id, "order_update", "O comprador confirmou a receção da encomenda.", "encomendas.html");
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
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar encomenda." });
    }
});

module.exports = router;