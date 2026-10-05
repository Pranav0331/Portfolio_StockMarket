-- =========================================================================
-- V9__create_algo_trading_schema.sql
-- AI Algo Trading: Strategies, Indicator configurations & Execution Logs
-- =========================================================================

DROP TABLE IF EXISTS algo_trade_logs;
DROP TABLE IF EXISTS algo_strategies;

-- 1. ALGO STRATEGIES TABLE
CREATE TABLE algo_strategies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    market VARCHAR(32) NOT NULL DEFAULT 'US', -- 'INDIAN', 'US', 'FOREX', 'CRYPTO'
    trading_mode VARCHAR(32) NOT NULL DEFAULT 'INTRADAY', -- 'SCALPING', 'INTRADAY'
    timeframe VARCHAR(16) NOT NULL DEFAULT '5min', -- '1min', '5min', '15min', '30min', '1h'
    direction VARCHAR(16) NOT NULL DEFAULT 'BOTH', -- 'LONG', 'SHORT', 'BOTH'
    status VARCHAR(20) NOT NULL DEFAULT 'STOPPED', -- 'RUNNING', 'PAUSED', 'STOPPED'

    -- Indicator Parameters & Filters
    ema_fast_period INT NOT NULL DEFAULT 9,
    ema_slow_period INT NOT NULL DEFAULT 21,
    rsi_period INT NOT NULL DEFAULT 14,
    rsi_overbought DECIMAL(10, 2) NOT NULL DEFAULT 70.00,
    rsi_oversold DECIMAL(10, 2) NOT NULL DEFAULT 30.00,
    macd_fast INT NOT NULL DEFAULT 12,
    macd_slow INT NOT NULL DEFAULT 26,
    macd_signal INT NOT NULL DEFAULT 9,
    bb_period INT NOT NULL DEFAULT 20,
    bb_std_dev DECIMAL(10, 2) NOT NULL DEFAULT 2.00,

    use_ema_cross BOOLEAN NOT NULL DEFAULT TRUE,
    use_rsi_filter BOOLEAN NOT NULL DEFAULT TRUE,
    use_macd_filter BOOLEAN NOT NULL DEFAULT TRUE,
    use_bb_filter BOOLEAN NOT NULL DEFAULT FALSE,

    -- Risk Management Parameters
    risk_per_trade_pct DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
    leverage INT NOT NULL DEFAULT 10,
    quantity DECIMAL(19, 4) NOT NULL DEFAULT 0.1000,
    stop_loss_pct DECIMAL(10, 2) NULL,
    take_profit_pct DECIMAL(10, 2) NULL,
    max_open_positions INT NOT NULL DEFAULT 1,
    daily_loss_limit DECIMAL(19, 4) NULL,

    -- Performance & State Tracking
    total_trades INT NOT NULL DEFAULT 0,
    winning_trades INT NOT NULL DEFAULT 0,
    losing_trades INT NOT NULL DEFAULT 0,
    total_pnl DECIMAL(19, 4) NOT NULL DEFAULT 0.0000,
    max_drawdown DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    last_run_at TIMESTAMP NULL,
    last_signal VARCHAR(20) NULL,
    last_signal_reasons TEXT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_algo_strategies_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_algo_strategies_user_id ON algo_strategies (user_id);
CREATE INDEX idx_algo_strategies_status ON algo_strategies (status);
CREATE INDEX idx_algo_strategies_user_status ON algo_strategies (user_id, status);

-- 2. ALGO TRADE LOGS / EXECUTIONS TABLE
CREATE TABLE algo_trade_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    strategy_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'BUY', 'SELL', 'WAIT', 'CLOSE'
    price DECIMAL(19, 4) NOT NULL,
    quantity DECIMAL(19, 4) NULL,
    algo_signal VARCHAR(20) NOT NULL, -- 'BUY', 'SELL', 'WAIT'
    confidence DECIMAL(5, 2) NOT NULL,
    trend VARCHAR(20) NOT NULL, -- 'BULLISH', 'BEARISH', 'NEUTRAL'
    reasons TEXT NULL,
    pnl DECIMAL(19, 4) NULL,
    order_id BIGINT NULL,
    position_id BIGINT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'EXECUTED', -- 'EXECUTED', 'SKIPPED', 'EVALUATED'
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_algo_logs_strategy FOREIGN KEY (strategy_id) REFERENCES algo_strategies(id) ON DELETE CASCADE,
    CONSTRAINT fk_algo_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_algo_logs_strategy_id ON algo_trade_logs (strategy_id);
CREATE INDEX idx_algo_logs_user_id ON algo_trade_logs (user_id);
CREATE INDEX idx_algo_logs_created_at ON algo_trade_logs (created_at);
