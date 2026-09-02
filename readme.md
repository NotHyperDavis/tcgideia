# TCGMarketPortugal

Simplesmente uma ideia entre 3 amigos, que se tornou num marketplace a sério para comprar e vender cartas colecionáveis (Pokémon, com One Piece, Yu-Gi-Oh! e Magic a caminho).

## O que já faz

- **Marketplace** com pesquisa por nome, filtros de condição, e reputação do vendedor
- **Contas de utilizador** com verificação de email e recuperação de password
- **Anúncios** com foto real da carta (upload), além da imagem de referência
- **Carrinho** multi-vendedor, com portes calculados automaticamente por peso e país de destino
- **Três formas de pagar**: carteira interna, transferência bancária, ou cartão/MB WAY (Stripe)
- **Retenção de pagamento**: o vendedor só recebe depois de o comprador confirmar a receção
- **Comissão do site**: percentagem diferente para contas Particular vs. Loja, sempre com um teto máximo por carta
- **Mensagens** gerais entre utilizadores, e chat por encomenda
- **Avaliações** de vendedores, com distribuição por estrelas
- **Notificações** em tempo real (sino no menu)
- **Painel de admin**: confirmar pagamentos/repasses, e gerir tipo de conta dos vendedores
- Site adaptado para telemóvel

## Stack

- **Frontend**: HTML/CSS/JS puro (sem framework)
- **Backend**: Node.js + Express
- **Base de dados**: PostgreSQL (Neon)
- **Pagamentos**: Stripe (Connect + Checkout)
- **Emails**: Resend
- **Fotos**: Cloudinary
- **Cartas (dados/imagens)**: TCGdex

## Estrutura

```
HTML/       páginas do site
css/        estilos
js/         lógica do frontend
server/     backend Express
  routes/   uma rota por área (auth, listings, orders, wallet, ...)
  utils/    helpers (email, cloudinary, stripe, notificações)
  middleware/  autenticação e rate limiting
  migrations/  alterações à base de dados, por ordem
```

## Como correr localmente

1. Clona o repositório e entra na pasta `server/`
2. `npm install`
3. Cria um `.env` dentro de `server/` com:

```
PORT=3000
DB_USER=...
DB_PASSWORD=...
DB_HOST=...
DB_NAME=...
DB_PORT=5432
JWT_SECRET=...
ADMIN_EMAIL=...

COMMISSION_RATE_INDIVIDUAL=0.08
COMMISSION_RATE_STORE=0.05
COMMISSION_CAP=100

RESEND_API_KEY=...
RESEND_FROM_EMAIL=TCGMarketPortugal <onboarding@resend.dev>
FRONTEND_URL=http://127.0.0.1:5500

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Opcionais (já têm valores por omissão sensatos)
ALLOWED_ORIGIN=
RATE_LIMIT_GENERAL_MAX=500
RATE_LIMIT_AUTH_MAX=50
```

4. Corre as migrações em `server/migrations/` pela ordem dos números, no SQL Editor do Neon
5. `npm run dev`
6. Abre `http://localhost:3000` no browser (o próprio backend serve o site)

Para testar pagamentos por Stripe localmente, precisas também do [Stripe CLI](https://docs.stripe.com/stripe-cli) a correr `stripe listen --forward-to localhost:3000/stripe/webhook`.