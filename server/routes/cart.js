const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const requireVerifiedEmail = require("../middleware/requireVerifiedEmail");
const { notify } = require("../utils/notifications");

const router = express.Router();

const COMMISSION_RATE_INDIVIDUAL = Number(process.env.COMMISSION_RATE_INDIVIDUAL) || 0.08;
const COMMISSION_RATE_STORE = Number(process.env.COMMISSION_RATE_STORE) || 0.05;
const COMMISSION_CAP = Number(process.env.COMMISSION_CAP) || 100; // nunca mais que isto por carta

function commissionRateFor(accountType) {
    return accountType === "store" ? COMMISSION_RATE_STORE : COMMISSION_RATE_INDIVIDUAL;
}

// Tem de ser exatamente igual à função em orders.js e no product.js/carrinho.js do frontend
function estimateWeight(quantity) {
    return 15 + quantity * 2;
}

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

// POST /cart — adicionar (ou aumentar) um anúncio no carrinho
router.post("/", requireAuth, async (req, res) => {
    const { listing_id, quantity } = req.body;

    if (!listing_id) {
        return res.status(400).json({ error: "Indica o anúncio." });
    }

    try {
        const listingResult = await pool.query("SELECT * FROM listings WHERE id = $1", [listing_id]);
        const listing = listingResult.rows[0];

        if (!listing || listing.status !== "active") {
            return res.status(404).json({ error: "Este anúncio já não está disponível." });
        }

        if (listing.user_id === req.user.id) {
            return res.status(400).json({ error: "Não podes adicionar o teu próprio anúncio ao carrinho." });
        }

        const result = await pool.query(
            `INSERT INTO cart_items (user_id, listing_id, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, listing_id)
             DO UPDATE SET quantity = cart_items.quantity + $3
             RETURNING *`,
            [req.user.id, listing_id, quantity || 1]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao adicionar ao carrinho." });
    }
});

// GET /cart — ver o carrinho, já com o preço/portes calculados
router.get("/", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT cart_items.id AS cart_item_id, cart_items.quantity,
                    listings.id AS listing_id, listings.card_name, listings.card_image,
                    listings.price, listings.condition, listings.quantity AS available_quantity,
                    listings.user_id AS seller_id,
                    users.name AS seller_name, users.account_type AS seller_account_type
             FROM cart_items
             JOIN listings ON listings.id = cart_items.listing_id
             JOIN users ON users.id = listings.user_id
             WHERE cart_items.user_id = $1
             ORDER BY cart_items.created_at ASC`,
            [req.user.id]
        );

        const items = result.rows;

        const buyerCountryResult = await pool.query("SELECT country FROM users WHERE id = $1", [req.user.id]);
        const buyerCountry = buyerCountryResult.rows[0]?.country || "PT";

        // Agrupa por vendedor para calcular os portes (um envio por vendedor)
        const bySeller = {};
        for (const item of items) {
            if (!bySeller[item.seller_id]) bySeller[item.seller_id] = [];
            bySeller[item.seller_id].push(item);
        }

        let basePriceTotal = 0;
        let shippingTotal = 0;
        let platformFeeTotal = 0;

        for (const sellerId in bySeller) {
            const sellerItems = bySeller[sellerId];
            const weight = sellerItems.reduce((sum, i) => sum + i.quantity, 0);
            shippingTotal += calcShipping(estimateWeight(weight), buyerCountry);

            sellerItems.forEach(item => {
                const itemBase = item.price * item.quantity;
                basePriceTotal += itemBase;
                platformFeeTotal += Math.min(itemBase * commissionRateFor(item.seller_account_type), COMMISSION_CAP);
            });
        }

        // O comprador só paga preço das cartas + portes reais — a comissão não entra aqui.
        const total = Number((basePriceTotal + shippingTotal).toFixed(2));

        res.json({
            items,
            base_price: Number(basePriceTotal.toFixed(2)),
            shipping_cost: Number(shippingTotal.toFixed(2)),
            platform_fee: Number(platformFeeTotal.toFixed(2)), // informativo — sai do vendedor
            total,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter o carrinho." });
    }
});

// PATCH /cart/:listingId — mudar a quantidade de um item
router.patch("/:listingId", requireAuth, async (req, res) => {
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
        return res.status(400).json({ error: "Quantidade inválida." });
    }

    try {
        const result = await pool.query(
            `UPDATE cart_items SET quantity = $1
             WHERE user_id = $2 AND listing_id = $3
             RETURNING *`,
            [quantity, req.user.id, req.params.listingId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Esse item não está no teu carrinho." });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar item do carrinho." });
    }
});

// DELETE /cart/:listingId — remover um item do carrinho
router.delete("/:listingId", requireAuth, async (req, res) => {
    try {
        await pool.query(
            "DELETE FROM cart_items WHERE user_id = $1 AND listing_id = $2",
            [req.user.id, req.params.listingId]
        );

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao remover item do carrinho." });
    }
});

// POST /cart/checkout — comprar tudo o que está no carrinho de uma vez, pago pela carteira
router.post("/checkout", requireAuth, requireVerifiedEmail, async (req, res) => {
    const { shipping } = req.body;

    if (!shipping || !shipping.name || !shipping.address_line || !shipping.postal_code || !shipping.city) {
        return res.status(400).json({ error: "Preenche a morada de envio completa (nome, morada, código postal e localidade)." });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const cartResult = await client.query(
            `SELECT cart_items.quantity AS cart_quantity, listings.*, sellers.account_type AS seller_account_type
             FROM cart_items
             JOIN listings ON listings.id = cart_items.listing_id
             JOIN users sellers ON sellers.id = listings.user_id
             WHERE cart_items.user_id = $1
             FOR UPDATE OF listings`,
            [req.user.id]
        );

        const cartItems = cartResult.rows;

        if (cartItems.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "O teu carrinho está vazio." });
        }

        for (const item of cartItems) {
            if (item.status !== "active") {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: `"${item.card_name}" já não está disponível.` });
            }
            if (item.cart_quantity > item.quantity) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: `Não há quantidade suficiente de "${item.card_name}".` });
            }
        }

        const buyerCountryResult = await client.query("SELECT country FROM users WHERE id = $1", [req.user.id]);
        const buyerCountry = buyerCountryResult.rows[0]?.country || "PT";

        // Agrupa por vendedor para os portes (um envio por vendedor, atribuído ao primeiro item)
        const bySeller = {};
        for (const item of cartItems) {
            if (!bySeller[item.user_id]) bySeller[item.user_id] = [];
            bySeller[item.user_id].push(item);
        }

        let grandTotal = 0;
        const ordersToCreate = [];

        for (const sellerId in bySeller) {
            const sellerItems = bySeller[sellerId];
            const totalQuantity = sellerItems.reduce((sum, i) => sum + i.cart_quantity, 0);
            const shippingCost = calcShipping(estimateWeight(totalQuantity), buyerCountry);

            sellerItems.forEach((item, index) => {
                const basePrice = Number((item.price * item.cart_quantity).toFixed(2));
                const itemShipping = index === 0 ? shippingCost : 0;

                // O comprador paga só preço+portes reais — nada escondido.
                const totalPrice = Number((basePrice + itemShipping).toFixed(2));
                // A comissão (com teto por carta) fica retida; só é descontada quando
                // o repasse for feito ao vendedor, depois da entrega confirmada.
                const platformFee = Math.min(Number((basePrice * commissionRateFor(item.seller_account_type)).toFixed(2)), COMMISSION_CAP);
                const sellerPayout = Number((totalPrice - platformFee).toFixed(2));

                grandTotal += totalPrice;

                ordersToCreate.push({
                    listing: item,
                    seller_id: item.user_id,
                    quantity: item.cart_quantity,
                    unit_price: item.price,
                    total_price: totalPrice,
                    platform_fee: platformFee,
                    seller_payout: sellerPayout,
                    shipping_cost: itemShipping,
                });
            });
        }

        grandTotal = Number(grandTotal.toFixed(2));

        const buyerResult = await client.query("SELECT balance FROM users WHERE id = $1 FOR UPDATE", [req.user.id]);
        const buyerBalance = Number(buyerResult.rows[0].balance);
        const walletHasFunds = buyerBalance >= grandTotal;

        // Se não houver saldo, o compromisso é criado na mesma — fica "por pagar",
        // tal como a transferência bancária. Só debitamos se houver saldo já.
        if (walletHasFunds) {
            await client.query("UPDATE users SET balance = balance - $1 WHERE id = $2", [grandTotal, req.user.id]);
        }

        const createdOrders = [];

        for (const order of ordersToCreate) {
            const listing = order.listing;
            const remainingQty = listing.quantity - order.quantity;

            await client.query(
                `UPDATE listings SET quantity = $1, status = $2, updated_at = NOW() WHERE id = $3`,
                [remainingQty, remainingQty === 0 ? "sold" : "active", listing.id]
            );

            const orderResult = await client.query(
                `INSERT INTO orders (listing_id, buyer_id, seller_id, quantity, unit_price, total_price, payment_method, payment_status, platform_fee, seller_payout, shipping_cost,
                                     shipping_name, shipping_address_line, shipping_postal_code, shipping_city, shipping_country)
                 VALUES ($1, $2, $3, $4, $5, $6, 'wallet', $7, $8, $9, $10, $11, $12, $13, $14, $15)
                 RETURNING *`,
                [listing.id, req.user.id, order.seller_id, order.quantity, order.unit_price, order.total_price,
                 walletHasFunds ? "paid" : "pending",
                 order.platform_fee, order.seller_payout, order.shipping_cost,
                 shipping.name, shipping.address_line, shipping.postal_code, shipping.city, buyerCountry]
            );

            // O vendedor só é creditado quando o comprador confirmar a receção
            // (ver PATCH /orders/:id em orders.js) — aqui só se debita o comprador.

            createdOrders.push(orderResult.rows[0]);
        }

        await client.query("DELETE FROM cart_items WHERE user_id = $1", [req.user.id]);

        await client.query("COMMIT");

        for (const order of createdOrders) {
            if (walletHasFunds) {
                await notify(order.seller_id, "order_update", "Venda comprometida! O pagamento já está confirmado, podes enviar.", "encomendas.html");
            }
        }

        res.status(201).json({ orders: createdOrders, total: grandTotal });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ error: "Erro ao finalizar a compra." });
    } finally {
        client.release();
    }
});

module.exports = router;