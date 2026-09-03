const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const cardsRoutes = require("./routes/cards");
const authRoutes = require("./routes/auth");
const listingsRoutes = require("./routes/listings");
const ordersRoutes = require("./routes/orders");
const orderMessagesRoutes = require("./routes/order-messages");
const conversationsRoutes = require("./routes/conversations");
const usersRoutes = require("./routes/users");
const notificationsRoutes = require("./routes/notifications");
const pool = require("./db");
const reviewsRoutes = require("./routes/reviews");
const walletRoutes = require("./routes/wallet");
const cartRoutes = require("./routes/cart");
const { generalLimiter, authLimiter } = require("./middleware/ratelimit");
const uploadRoutes = require("./routes/upload");
const stripeConnectRoutes = require("./routes/stripe-connect");
const checkoutRoutes = require("./routes/checkout");
const stripeWebhookRoutes = require("./routes/stripe-webhook");

const app = express();

// Quando acedes através de um túnel (Cloudflare, ngrok) ou de um hosting a sério,
// os pedidos chegam através de um proxy, que acrescenta o cabeçalho X-Forwarded-For
// com o IP real de quem fez o pedido. Sem isto, o express-rate-limit recusa-se a
// confiar nesse cabeçalho e rejeita os pedidos.
app.set("trust proxy", 1);

// Em desenvolvimento (sem ALLOWED_ORIGIN definido no .env) aceita qualquer origem.
// Em produção, define ALLOWED_ORIGIN no .env com o domínio real do teu frontend
// (ex: ALLOWED_ORIGIN=https://tcgideia.pt) para só esse site poder chamar a API.
const allowedOrigin = process.env.ALLOWED_ORIGIN;

app.use(cors(
    allowedOrigin ? { origin: allowedOrigin } : {}
));

// IMPORTANTE: o webhook da Stripe tem de vir ANTES do express.json(), porque
// precisa do corpo do pedido em bruto (raw) para confirmar a assinatura.
// Se isto vier depois do express.json(), a verificação da assinatura falha sempre.
app.use("/stripe/webhook", stripeWebhookRoutes);

app.use(express.json());

// Limite geral em toda a API
app.use(generalLimiter);

app.use("/cards", cardsRoutes);
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
app.use("/auth", authRoutes);
app.use("/listings", listingsRoutes);
app.use("/orders", ordersRoutes);
app.use("/orders/:orderId/messages", orderMessagesRoutes);
app.use("/conversations", conversationsRoutes);
app.use("/users", usersRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/reviews", reviewsRoutes);
app.use("/wallet", walletRoutes);
app.use("/cart", cartRoutes);
app.use("/upload", uploadRoutes);
app.use("/stripe-connect", stripeConnectRoutes);
app.use("/checkout", checkoutRoutes);

app.get("/", (req, res) => {
    res.redirect("/HTML/main.html");
});

// Serve o próprio site (HTML/CSS/JS) — assim só precisas de expor esta porta
// para os teus amigos acederem, em vez de precisares de duas (Live Server + backend).
app.use(express.static(path.join(__dirname, "..")));

app.get("/api-status", (req, res) => {
    res.send("🚀 API do TCGMarketPortugal está online!");
});

app.get("/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({ ok: true, time: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

const checkOverdueShipments = require("./utils/checkOverdueShipments");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor a correr em http://localhost:${PORT}`);

    // Verifica logo ao arrancar, e depois de hora a hora.
    checkOverdueShipments();
    setInterval(checkOverdueShipments, 60 * 60 * 1000);
});