-- =========================================================================
-- V10__add_virtual_balance_to_users.sql
-- Add baseline virtual cash balance directly on users table for paper trading
-- =========================================================================

ALTER TABLE users ADD COLUMN virtual_balance DECIMAL(19, 4) NOT NULL DEFAULT 100000.0000;
