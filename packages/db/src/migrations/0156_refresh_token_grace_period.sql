-- PLA-1112: Add grace period columns for refresh token rotation race condition.
-- When a token is rotated, the old hash is preserved for 30 seconds so that
-- concurrent requests using the old token still get the new pair back.

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS previous_token_hash VARCHAR(255);
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMP;
