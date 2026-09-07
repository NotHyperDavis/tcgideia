const axios = require("axios");

// Verifica se um código postal existe mesmo (Portugal ou Espanha), usando a
// API da zipcodestack.com. Devolve { valid: true, city: "..." } ou { valid: false }.
//
// IMPORTANTE: o formato exato da resposta desta API não foi testado ao vivo
// ao escrever isto — se der erro, confirma a resposta real (ex: com Postman)
// e ajusta o campo "results" abaixo se o nome vier diferente.
async function verifyPostalCode(postalCode, country) {
    try {
        const response = await axios.get("https://api.zipcodestack.com/v1/search", {
            params: { codes: postalCode, country: country.toLowerCase() },
            headers: { apikey: process.env.ZIPCODESTACK_API_KEY },
            timeout: 5000,
        });

        const results = response.data?.results?.[postalCode];

        if (!Array.isArray(results) || results.length === 0) {
            return { valid: false };
        }

        return {
            valid: true,
            city: results[0].city || results[0].locality || null,
        };

    } catch (error) {
        console.error("Erro ao verificar código postal:", error.message);
        return { valid: null };
    }
}

module.exports = verifyPostalCode;