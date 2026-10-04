-- Add P&L and average buy price tracking columns to transactions table
ALTER TABLE transactions ADD COLUMN pnl DECIMAL(19, 4) NULL;
ALTER TABLE transactions ADD COLUMN pnl_percent DECIMAL(19, 4) NULL;
ALTER TABLE transactions ADD COLUMN avg_buy_price DECIMAL(19, 4) NULL;
