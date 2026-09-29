-- =========================================================================
-- V2__add_auth_provider_to_users.sql
-- Add OAuth2 authentication provider fields to users table
-- =========================================================================

ALTER TABLE users ADD COLUMN provider VARCHAR(50) NOT NULL DEFAULT 'LOCAL';
ALTER TABLE users ADD COLUMN provider_id VARCHAR(255) NULL;
