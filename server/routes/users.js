const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// GET /users/me — os meus próprios dados (tem de vir antes de "/:id")
router.get("/me", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, name, email, created_at FROM users WHERE id = $1",
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Utilizador não encontrado." });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao obter os teus dados." });
    }
});

// PATCH /users/me — editar o meu nome
router.patch("/me", requireAuth, async (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: "O nome não pode estar vazio." });
    }

    try {
        const result = await pool.query(
            "UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, created_at",
            [name.trim(), req.user.id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar os teus dados." });
    }
});

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