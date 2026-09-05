-- =========================================================
-- TCGMarketPortugal — esquema completo da base de dados
-- =========================================================
-- Este ficheiro cria TODAS as tabelas da aplicação, do zero.
-- Numa base de dados nova, basta correr este único ficheiro
-- para teres o sistema completamente funcional.
--
-- Gerado a partir de um pg_dump --schema-only da base de
-- dados real, em produção, a 5 de setembro de 2026.
--
-- NOTA: o schema "neon_auth" que aparece num dump completo
-- do Neon NÃO está aqui — é criado automaticamente pela
-- própria plataforma Neon (não é código nosso) e não precisa
-- de ser recriado manualmente.
-- =========================================================


-- ---------------------------------------------------------
-- USERS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    balance NUMERIC(10,2) NOT NULL DEFAULT 0,

    email_verified BOOLEAN NOT NULL DEFAULT false,
    verification_token TEXT,
    reset_token TEXT,
    reset_token_expires TIMESTAMP,

    stripe_account_id TEXT,
    stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT false,

    country VARCHAR(2) NOT NULL DEFAULT 'PT',
    account_type VARCHAR(20) NOT NULL DEFAULT 'individual'
        CHECK (account_type IN ('individual', 'store')),

    address_name VARCHAR(150),
    address_line TEXT,
    address_postal_code VARCHAR(20),
    address_city VARCHAR(100),

    late_shipment_strikes INTEGER NOT NULL DEFAULT 0,
    late_payment_strikes INTEGER NOT NULL DEFAULT 0,
    is_suspended BOOLEAN NOT NULL DEFAULT false,

    terms_accepted_at TIMESTAMP
);


-- ---------------------------------------------------------
-- LISTINGS (anúncios)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS listings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    card_id VARCHAR(50) NOT NULL,
    card_name VARCHAR(200) NOT NULL,
    card_image VARCHAR(500),
    set_name VARCHAR(150),
    game VARCHAR(20) NOT NULL DEFAULT 'pokemon',

    price NUMERIC(10,2) NOT NULL CHECK (price > 0),
    condition VARCHAR(20) NOT NULL
        CHECK (condition IN ('mint', 'near_mint', 'excellent', 'good', 'played', 'poor')),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    weight_grams INTEGER NOT NULL DEFAULT 5,

    language VARCHAR(5) NOT NULL DEFAULT 'EN',
    variant VARCHAR(20) NOT NULL DEFAULT 'normal',
    is_foil BOOLEAN NOT NULL DEFAULT false,

    description TEXT,
    real_photo_url TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'sold', 'removed')),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_user ON listings (user_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings (status);
CREATE INDEX IF NOT EXISTS idx_listings_card ON listings (card_id);


-- ---------------------------------------------------------
-- CONVERSATIONS + MENSAGENS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_a_id, user_b_id)
);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    image_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation ON conversation_messages (conversation_id);


-- ---------------------------------------------------------
-- ORDERS (encomendas)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,

    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id INTEGER REFERENCES conversations(id),

    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0,

    platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    seller_payout NUMERIC(10,2) NOT NULL DEFAULT 0,
    payout_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (payout_status IN ('pending', 'paid_out')),

    payment_method VARCHAR(20) NOT NULL
        CHECK (payment_method IN ('bank_transfer', 'stripe', 'instant', 'wallet')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
    status VARCHAR(20) NOT NULL DEFAULT 'committed'
        CHECK (status IN ('committed', 'shipped', 'completed', 'cancelled')),

    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,

    shipping_name VARCHAR(150),
    shipping_address_line TEXT,
    shipping_postal_code VARCHAR(20),
    shipping_city VARCHAR(100),
    shipping_country VARCHAR(2),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders (seller_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders (stripe_session_id) WHERE stripe_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_messages (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_messages_order ON order_messages (order_id);


-- ---------------------------------------------------------
-- REVIEWS (avaliações)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewed_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (order_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_user ON reviews (reviewed_user_id);


-- ---------------------------------------------------------
-- DISPUTES (reclamações)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS disputes (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    opened_by INTEGER NOT NULL REFERENCES users(id),
    reason VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_review', 'resolved')),
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);


-- ---------------------------------------------------------
-- CARRINHO
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    listing_id INTEGER,
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, listing_id)
);


-- ---------------------------------------------------------
-- CARTEIRA: depósitos, levantamentos, movimentos
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS deposits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    method VARCHAR(20) NOT NULL DEFAULT 'bank_transfer',
    status VARCHAR(50) DEFAULT 'pending',
    stripe_session_id TEXT,
    confirmed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deposits_stripe_session ON deposits (stripe_session_id) WHERE stripe_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS withdrawals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    iban VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL
        CHECK (type IN ('deposit', 'withdrawal', 'purchase', 'sale')),
    amount NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'rejected')),
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions (user_id);


-- ---------------------------------------------------------
-- NOTIFICAÇÕES
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    content TEXT NOT NULL,
    link VARCHAR(200),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read);


-- ---------------------------------------------------------
-- LISTA DE DESEJOS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS wishlist_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL,
    card_name TEXT NOT NULL,
    card_image TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, card_id)
);