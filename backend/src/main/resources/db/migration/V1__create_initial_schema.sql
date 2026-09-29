-- =========================================================================
-- V1__create_initial_schema.sql
-- Initial Database Migration for Portfolio StockMarket Application
-- =========================================================================

-- 1. USERS TABLE
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'ROLE_USER',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_users_email UNIQUE (email)
);

-- 2. STOCKS TABLE
CREATE TABLE stocks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    exchange VARCHAR(50) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    current_price DECIMAL(19, 4) NULL,
    previous_close DECIMAL(19, 4) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_stocks_symbol UNIQUE (symbol)
);

-- 3. HOLDINGS TABLE
CREATE TABLE holdings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    stock_id BIGINT NOT NULL,
    quantity DECIMAL(19, 4) NOT NULL,
    average_buy_price DECIMAL(19, 4) NOT NULL,
    total_invested DECIMAL(19, 4) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_holdings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_holdings_stock FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE RESTRICT,
    CONSTRAINT uk_holdings_user_stock UNIQUE (user_id, stock_id)
);

CREATE INDEX idx_holdings_user_id ON holdings (user_id);
CREATE INDEX idx_holdings_stock_id ON holdings (stock_id);

-- 4. ORDERS TABLE
CREATE TABLE orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    stock_id BIGINT NOT NULL,
    order_type VARCHAR(20) NOT NULL,
    order_status VARCHAR(30) NOT NULL,
    quantity DECIMAL(19, 4) NOT NULL,
    price DECIMAL(19, 4) NOT NULL,
    executed_price DECIMAL(19, 4) NULL,
    executed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_stock FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE RESTRICT
);

CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_stock_id ON orders (stock_id);
CREATE INDEX idx_orders_status ON orders (order_status);

-- 5. TRANSACTIONS TABLE
CREATE TABLE transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    stock_id BIGINT NULL,
    order_id BIGINT NULL,
    transaction_type VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL,
    quantity DECIMAL(19, 4) NULL,
    price_per_unit DECIMAL(19, 4) NULL,
    total_amount DECIMAL(19, 4) NOT NULL,
    fees DECIMAL(19, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_transactions_stock FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE SET NULL,
    CONSTRAINT fk_transactions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX idx_transactions_user_id ON transactions (user_id);
CREATE INDEX idx_transactions_stock_id ON transactions (stock_id);
CREATE INDEX idx_transactions_order_id ON transactions (order_id);

-- 6. WATCHLIST TABLE
CREATE TABLE watchlist (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    stock_id BIGINT NOT NULL,
    notes VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_watchlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_watchlist_stock FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE,
    CONSTRAINT uk_watchlist_user_stock UNIQUE (user_id, stock_id)
);

CREATE INDEX idx_watchlist_user_id ON watchlist (user_id);
CREATE INDEX idx_watchlist_stock_id ON watchlist (stock_id);

-- 7. ALERTS TABLE
CREATE TABLE alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    stock_id BIGINT NOT NULL,
    target_price DECIMAL(19, 4) NOT NULL,
    condition_type VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL,
    triggered_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_alerts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_alerts_stock FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE
);

CREATE INDEX idx_alerts_user_id ON alerts (user_id);
CREATE INDEX idx_alerts_stock_id ON alerts (stock_id);
CREATE INDEX idx_alerts_status ON alerts (status);
