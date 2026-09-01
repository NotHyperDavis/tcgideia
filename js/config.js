// Ficheiro central da URL do backend.
//
// Regra: se a página estiver a ser servida pelo Live Server (porta 5500, só usado
// em desenvolvimento local), o backend está sempre noutra porta (3000) no mesmo PC.
// Em qualquer outro caso — o próprio backend a servir o site (localhost:3000),
// um túnel (ngrok/Cloudflare) apontado ao backend, ou uma publicação a sério —
// a API está sempre na MESMA origem da página, por isso não precisas de mudar
// nada aqui manualmente nunca mais.

const API_BASE = (window.location.port === "5500")
    ? "http://localhost:3000"
    : window.location.origin;