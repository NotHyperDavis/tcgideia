// Ficheiro central da URL do backend. É o ÚNICO sítio que precisas de mudar
// quando publicares o site fora do localhost — troca o valor de PRODUCTION_API_URL
// pelo domínio real do teu backend (ex: "https://api.tcgideia.pt").
//
// Detecta automaticamente se estás a testar em local ou já em produção.

const PRODUCTION_API_URL = "https://api.tcgideia.pt"; // <-- troca isto quando tiveres o backend publicado

const API_BASE = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3000"
    : PRODUCTION_API_URL;