const rateLimit = require("express-rate-limit");

// Limite geral: protege toda a API de spam/abuso.
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados pedidos. Tenta outra vez daqui a uns minutos." },
});

// Limite apertado só para login/registo: impede força bruta de passwords.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas tentativas. Espera uns minutos antes de tentares outra vez." },
});

module.exports = { generalLimiter, authLimiter };