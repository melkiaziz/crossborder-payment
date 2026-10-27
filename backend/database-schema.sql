-- ============================================
-- 🏦 CrossBorderPayment Database Schema
-- ============================================

-- Créer la base de données (si elle n'existe pas)
-- CREATE DATABASE crossborder_db;

-- Se connecter à la base de données
-- \c crossborder_db

-- ============================================
-- Table: banks
-- ============================================
CREATE TABLE IF NOT EXISTS banks (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    currency TEXT NOT NULL,
    tx_hash TEXT,
    balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_banks_wallet ON banks(wallet_address);
CREATE INDEX IF NOT EXISTS idx_banks_country ON banks(country);
CREATE INDEX IF NOT EXISTS idx_banks_currency ON banks(currency);

-- ============================================
-- Table: transactions
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    from_bank TEXT NOT NULL,
    to_bank TEXT NOT NULL,
    original_amount TEXT NOT NULL,
    converted_amount TEXT NOT NULL,
    fee TEXT NOT NULL,
    tx_hash TEXT,
    block_number INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_bank);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_bank);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);

-- ============================================
-- Table: pending_transfers (optionnel)
-- ============================================
CREATE TABLE IF NOT EXISTS pending_transfers (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER NOT NULL,
    from_bank TEXT NOT NULL,
    to_bank TEXT NOT NULL,
    amount TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: blacklist_history (optionnel - pour audit)
-- ============================================
CREATE TABLE IF NOT EXISTS blacklist_history (
    id SERIAL PRIMARY KEY,
    bank_address TEXT NOT NULL,
    action TEXT NOT NULL, -- 'added' ou 'removed'
    performed_by TEXT,
    tx_hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: employees (authentification employés banques)
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    employee_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    bank_wallet_address TEXT NOT NULL REFERENCES banks(wallet_address),
    verification_token TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    reset_token TEXT,
    reset_token_expiry TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_bank ON employees(bank_wallet_address);

-- ============================================
-- Table: rate_history (taux Forex historiques)
-- ============================================
CREATE TABLE IF NOT EXISTS rate_history (
    id SERIAL PRIMARY KEY,
    currency TEXT NOT NULL,
    rate NUMERIC NOT NULL,
    source TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_history_currency ON rate_history(currency);
CREATE INDEX IF NOT EXISTS idx_rate_history_created_at ON rate_history(created_at DESC);

-- ============================================
-- Table: rate_alerts (alertes de seuil)
-- ============================================
CREATE TABLE IF NOT EXISTS rate_alerts (
    id SERIAL PRIMARY KEY,
    currency TEXT NOT NULL,
    threshold NUMERIC NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('above', 'below')),
    email TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_alerts_currency ON rate_alerts(currency);

-- ============================================
-- Table: rate_alert_history
-- ============================================
CREATE TABLE IF NOT EXISTS rate_alert_history (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES rate_alerts(id),
    current_rate NUMERIC NOT NULL,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL
);

-- ============================================
-- Vues utiles pour les rapports
-- ============================================

-- Vue : Volume de transactions par banque
CREATE OR REPLACE VIEW bank_transaction_volume AS
SELECT 
    from_bank as bank_address,
    COUNT(*) as total_sent,
    SUM(CAST(converted_amount AS NUMERIC)) as total_volume_sent
FROM transactions
GROUP BY from_bank;

-- Vue : Statistiques par devise
CREATE OR REPLACE VIEW currency_stats AS
SELECT 
    b.currency,
    COUNT(DISTINCT b.wallet_address) as bank_count,
    COUNT(t.id) as transaction_count,
    SUM(CAST(t.converted_amount AS NUMERIC)) as total_volume
FROM banks b
LEFT JOIN transactions t ON b.wallet_address = t.from_bank OR b.wallet_address = t.to_bank
GROUP BY b.currency;

-- Vue : Dernières transactions avec noms des banques
CREATE OR REPLACE VIEW latest_transactions_detailed AS
SELECT 
    t.id,
    t.tx_hash,
    b1.name as from_bank_name,
    b1.country as from_country,
    b2.name as to_bank_name,
    b2.country as to_country,
    t.original_amount,
    t.converted_amount,
    t.fee,
    t.created_at
FROM transactions t
LEFT JOIN banks b1 ON t.from_bank = b1.wallet_address
LEFT JOIN banks b2 ON t.to_bank = b2.wallet_address
ORDER BY t.created_at DESC
LIMIT 100;

-- ============================================
-- Données de test (optionnel)
-- ============================================

-- INSERT INTO banks (wallet_address, name, country, currency) VALUES
-- ('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 'Banque Centrale Test', 'Tunisia', 'TND'),
-- ('0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 'Banque de France Test', 'France', 'EUR'),
-- ('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'Federal Reserve Test', 'USA', 'USD');

-- ============================================
-- Permissions (optionnel - si vous utilisez des utilisateurs spécifiques)
-- ============================================

-- GRANT ALL PRIVILEGES ON DATABASE crossborder_db TO your_user;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;

-- ============================================
-- Vérification
-- ============================================

-- Lister toutes les tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Compter les enregistrements
-- SELECT 'banks' as table_name, COUNT(*) as count FROM banks
-- UNION ALL
-- SELECT 'transactions', COUNT(*) FROM transactions;
