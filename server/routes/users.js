const express = require("express");
const pool = require("../db");

const router = express.Router();

// GET /users/:id — perfil público (não expõe email nem password_hash)
router.get("/:id", async (req, res) => {
    try {
        const userResult = await pool.query(
            "SELECT id, name, created_at FROM users WHERE id = $1",
            [req.params.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "Utilizador não encontrado." });
        }

        const listingsResult = await pool.query(
            "SELECT * FROM listings WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC",
            [req.params.id]
        );

        res.json({
            ...userResult.rows[0],
            active_listings: listingsResult.rows,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter perfil." });
    }
});

module.exports = router;