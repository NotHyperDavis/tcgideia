const jwt = require("jsonwebtoken");

// Confirma que o pedido tem um token válido (Bearer no cabeçalho Authorization),
// e disponibiliza os dados do utilizador em req.user para as rotas seguintes usarem.
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Não autenticado." });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Token inválido ou expirado." });
    }
}

module.exports = requireAuth;