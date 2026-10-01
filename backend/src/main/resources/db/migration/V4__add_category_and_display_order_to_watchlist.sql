-- =========================================================================
-- V4__add_category_and_display_order_to_watchlist.sql
-- Add category and display order to watchlist table for categorization & reordering
-- =========================================================================

ALTER TABLE watchlist ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'STOCKS';
ALTER TABLE watchlist ADD COLUMN display_order INT NOT NULL DEFAULT 0;
