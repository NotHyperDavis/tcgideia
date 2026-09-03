const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../db");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/email");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// Registo
router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "Preenche todos os campos." });
    }

    try {
        const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: "Já existe uma conta com este email." });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const verification_token = crypto.randomBytes(32).toString("hex");

        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash, verification_token)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, email`,
            [name, email, password_hash, verification_token]
        );

        try {
            await sendVerificationEmail(email, verification_token);
        } catch (emailError) {
            // Não bloqueia o registo se o email falhar a enviar — só regista o erro.
            console.error("Erro ao enviar email de verificação:", emailError);
        }

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao criar conta." });
    }
});

// Login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: "Credenciais inválidas." });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: "Credenciais inválidas." });
        }

        if (user.is_suspended) {
            return res.status(403).json({ error: "A tua conta foi suspensa por incumprimentos repetidos de prazos (envio ou pagamento). Contacta o suporte se achares que isto é um engano." });
        }

        const token = jwt.sign(
            { id: user.id, name: user.name, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email, email_verified: user.email_verified }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao fazer login." });
    }
});

// Confirmar email a partir do link enviado no registo
router.post("/verify-email", async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ error: "Token em falta." });
    }

    try {
        const result = await pool.query(
            "UPDATE users SET email_verified = true, verification_token = NULL WHERE verification_token = $1 RETURNING id, name",
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Link inválido ou já usado." });
        }

        res.json({ ok: true, name: result.rows[0].name });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao confirmar email." });
    }
});

// Pedir reposição de password
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Indica o teu email." });
    }

    try {
        const result = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

        // Por segurança, respondemos sempre "sucesso" mesmo que o email não exista —
        // assim ninguém consegue usar isto para descobrir que emails têm conta cá.
        if (result.rows.length === 0) {
            return res.json({ ok: true });
        }

        const reset_token = crypto.randomBytes(32).toString("hex");
        const reset_token_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        await pool.query(
            "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
            [reset_token, reset_token_expires, result.rows[0].id]
        );

        await sendPasswordResetEmail(email, reset_token);

        res.json({ ok: true });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao processar o pedido." });
    }
});

// Repor password a partir do token do email
router.post("/reset-password", async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return res.status(400).json({ error: "Faltam dados." });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: "A password tem de ter pelo menos 6 caracteres." });
    }

    try {
        const result = await pool.query(
            "SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()",
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Link inválido ou expirado. Pede uma nova reposição." });
        }

        const password_hash = await bcrypt.hash(password, 10);

        await pool.query(
            "UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
            [password_hash, result.rows[0].id]
        );

        res.json({ ok: true });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao repor a password." });
    }
});

// Reenviar o email de confirmação (para quem se registou mas ainda não confirmou)
router.post("/resend-verification", requireAuth, async (req, res) => {
    try {
        const userResult = await pool.query("SELECT email, email_verified FROM users WHERE id = $1", [req.user.id]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ error: "Utilizador não encontrado." });
        }

        if (user.email_verified) {
            return res.json({ ok: true, already_verified: true });
        }

        const verification_token = crypto.randomBytes(32).toString("hex");
        await pool.query("UPDATE users SET verification_token = $1 WHERE id = $2", [verification_token, req.user.id]);

        await sendVerificationEmail(user.email, verification_token);

        res.json({ ok: true });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao reenviar o email." });
    }
});

module.exports = router;