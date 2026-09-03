const pool = require("../db");

// Aplica-se DEPOIS do requireAuth. Vai sempre à base de dados confirmar o estado
// atual (não confia no JWT, que pode ter sido emitido antes da confirmação/suspensão).
async function requireVerifiedEmail(req, res, next) {
    try {
        const result = await pool.query("SELECT email_verified, is_suspended FROM users WHERE id = $1", [req.user.id]);
        const user = result.rows[0];

        if (user?.is_suspended) {
            return res.status(403).json({
                error: "A tua conta está suspensa por incumprimentos repetidos de prazos.",
                code: "ACCOUNT_SUSPENDED",
            });
        }

        if (!user?.email_verified) {
            return res.status(403).json({
                error: "Confirma o teu email antes de continuares.",
                code: "EMAIL_NOT_VERIFIED",
            });
        }

        next();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao verificar o estado da tua conta." });
    }
}

module.exports = requireVerifiedEmail;