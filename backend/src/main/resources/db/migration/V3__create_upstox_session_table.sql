-- =========================================================================
-- V3__create_upstox_session_table.sql
-- Create Upstox OAuth session persistence table
-- =========================================================================

CREATE TABLE upstox_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_key VARCHAR(50) NOT NULL,
    access_token TEXT NOT NULL,
    extended_token TEXT NULL,
    user_name VARCHAR(255) NULL,
    user_id VARCHAR(100) NULL,
    email VARCHAR(255) NULL,
    user_type VARCHAR(50) NULL,
    broker VARCHAR(50) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    connected_at BIGINT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_upstox_session_key UNIQUE (session_key)
);

