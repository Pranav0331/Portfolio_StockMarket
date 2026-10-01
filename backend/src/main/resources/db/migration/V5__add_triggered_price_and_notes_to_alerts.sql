-- =========================================================================
-- V5__add_triggered_price_and_notes_to_alerts.sql
-- Add triggered_price and notes columns to alerts table
-- =========================================================================

ALTER TABLE alerts ADD COLUMN triggered_price DECIMAL(19, 4) NULL;
ALTER TABLE alerts ADD COLUMN notes VARCHAR(255) NULL;
