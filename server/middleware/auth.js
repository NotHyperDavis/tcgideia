const jwt = require("jsonwebtoken");

// Usa isto em qualquer rota que exija login:
//   router.post("/", requireAuth, (req, res) => { ... req.user.id ... })
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization; // formato esperado: "Bearer <token>"

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Sessão em falta. Faz login." });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { id, name, email }
        next();
    } catch (error) {
        return res.status(401).json({ error: "Sessão inválida ou expirada. Faz login novamente." });
    }
}

module.exports = requireAuth;