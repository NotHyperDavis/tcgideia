const express = require("express");
const cors = require("cors");
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

const app = express();

app.use(cors());
app.use(express.json());

app.use("/cards", cardsRoutes);
app.use("/auth", authRoutes);
app.use("/listings", listingsRoutes);
app.use("/orders", ordersRoutes);
app.use("/orders/:orderId/messages", orderMessagesRoutes);
app.use("/conversations", conversationsRoutes);
app.use("/users", usersRoutes);
app.use("/notifications", notificationsRoutes);

app.get("/", (req, res) => {
    res.send("🚀 API do TCG Ideia está online!");
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor a correr em http://localhost:${PORT}`);
});