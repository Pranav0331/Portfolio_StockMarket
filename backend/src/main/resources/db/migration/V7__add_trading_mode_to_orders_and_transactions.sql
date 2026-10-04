-- Add trading_mode column to orders and transactions tables with default INTRADAY
ALTER TABLE orders ADD COLUMN trading_mode VARCHAR(32) NOT NULL DEFAULT 'INTRADAY';
ALTER TABLE transactions ADD COLUMN trading_mode VARCHAR(32) NOT NULL DEFAULT 'INTRADAY';
