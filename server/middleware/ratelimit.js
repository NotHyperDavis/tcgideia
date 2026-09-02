const rateLimit = require("express-rate-limit");

// Quando se acede através do túnel do Cloudflare (ou, no futuro, de um hosting
// a sério atrás da Cloudflare), o Cloudflare garante sempre este cabeçalho com o
// IP real de quem fez o pedido — independentemente de quantos "saltos" internos
// existam. Sem isto, todos os pedidos que passam pelo túnel podem ser tratados
// como vindos do mesmo IP, e um grupo de pessoas a testar ao mesmo tempo
// partilha, sem querer, o mesmo limite.
function getClientIp(req) {
    return req.headers["cf-connecting-ip"] || req.ip;
}

// Limite geral: protege toda a API de spam/abuso.
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_GENERAL_MAX) || 500,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientIp,
    message: { error: "Demasiados pedidos. Tenta outra vez daqui a uns minutos." },
});

// Limite de login/registo: impede força bruta de passwords, mas por IP real de
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 50,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientIp,
    message: { error: "Demasiadas tentativas. Espera uns minutos antes de tentares outra vez." },
});

module.exports = { generalLimiter, authLimiter };