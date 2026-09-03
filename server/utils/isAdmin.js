// Suporta vários administradores: no .env, separa os emails por vírgula.
// Ex: ADMIN_EMAILS=david@exemplo.com,ana@exemplo.com,joao@exemplo.com
function isAdmin(user) {
    const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
        .split(",")
        .map(email => email.trim().toLowerCase())
        .filter(Boolean);

    return adminEmails.includes((user.email || "").toLowerCase());
}

module.exports = isAdmin;