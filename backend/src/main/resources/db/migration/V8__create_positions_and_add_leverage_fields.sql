-- =========================================================================
-- V8__create_positions_and_add_leverage_fields.sql
-- Exness-Style Paper Trading: Positions table, leverage, SL/TP & margin fields
-- =========================================================================

-- 1. POSITIONS TABLE (For leveraged & standard paper trading positions)
CREATE TABLE positions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    stock_id BIGINT NOT NULL,
    side VARCHAR(10) NOT NULL DEFAULT 'LONG', -- 'LONG' or 'SHORT'
    trading_mode VARCHAR(32) NOT NULL DEFAULT 'INTRADAY',
    quantity DECIMAL(19, 4) NOT NULL,
    entry_price DECIMAL(19, 4) NOT NULL,
    leverage INT NOT NULL DEFAULT 1,
    margin_used DECIMAL(19, 4) NOT NULL DEFAULT 0.0000,
    stop_loss DECIMAL(19, 4) NULL,
    take_profit DECIMAL(19, 4) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
    close_price DECIMAL(19, 4) NULL,
    close_time TIMESTAMP NULL,
    realized_pnl DECIMAL(19, 4) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_positions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_positions_stock FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE RESTRICT
);

CREATE INDEX idx_positions_user_id ON positions (user_id);
CREATE INDEX idx_positions_stock_id ON positions (stock_id);
CREATE INDEX idx_positions_status ON positions (status);
CREATE INDEX idx_positions_user_status ON positions (user_id, status);

-- 2. ADD COLUMNS TO ORDERS TABLE
ALTER TABLE orders ADD COLUMN position_side VARCHAR(10) NOT NULL DEFAULT 'LONG';
ALTER TABLE orders ADD COLUMN leverage INT NOT NULL DEFAULT 1;
ALTER TABLE orders ADD COLUMN margin_used DECIMAL(19, 4) NOT NULL DEFAULT 0.0000;
ALTER TABLE orders ADD COLUMN stop_loss DECIMAL(19, 4) NULL;
ALTER TABLE orders ADD COLUMN take_profit DECIMAL(19, 4) NULL;
ALTER TABLE orders ADD COLUMN position_id BIGINT NULL;
ALTER TABLE orders ADD COLUMN realized_pnl DECIMAL(19, 4) NULL;

-- 3. ADD COLUMNS TO TRANSACTIONS TABLE
ALTER TABLE transactions ADD COLUMN position_side VARCHAR(10) NULL;
ALTER TABLE transactions ADD COLUMN leverage INT NOT NULL DEFAULT 1;
ALTER TABLE transactions ADD COLUMN margin_used DECIMAL(19, 4) NOT NULL DEFAULT 0.0000;
ALTER TABLE transactions ADD COLUMN position_id BIGINT NULL;
