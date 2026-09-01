const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// O domínio real do teu frontend. Em desenvolvimento, o Live Server costuma ser algo
// como http://127.0.0.1:5500 — ajusta no .env se for diferente.
const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5500";

// O Resend, em modo grátis/de testes, só deixa enviar a partir de "onboarding@resend.dev"
// até verificares o teu próprio domínio. Troca aqui quando tiveres o domínio verificado.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "TCG Ideia <onboarding@resend.dev>";

async function sendVerificationEmail(to, token) {
    const link = `${FRONTEND_URL}/HTML/verify-email.html?token=${token}`;

    await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: "Confirma o teu email — TCG Ideia",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>Bem-vindo ao TCG Ideia!</h2>
                <p>Confirma o teu email para ativares a tua conta:</p>
                <p><a href="${link}" style="display:inline-block; background:#2563EB; color:white; padding:12px 24px; border-radius:8px; text-decoration:none;">Confirmar email</a></p>
                <p style="color:#888; font-size:13px;">Se não criaste uma conta no TCG Ideia, podes ignorar este email.</p>
            </div>
        `,
    });
}

async function sendPasswordResetEmail(to, token) {
    const link = `${FRONTEND_URL}/HTML/reset-password.html?token=${token}`;

    await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: "Repor password — TCG Ideia",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>Pediste para repor a tua password</h2>
                <p>Clica no botão abaixo para escolheres uma password nova. Este link expira em 1 hora.</p>
                <p><a href="${link}" style="display:inline-block; background:#2563EB; color:white; padding:12px 24px; border-radius:8px; text-decoration:none;">Repor password</a></p>
                <p style="color:#888; font-size:13px;">Se não pediste isto, podes ignorar este email — a tua password não muda.</p>
            </div>
        `,
    });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };