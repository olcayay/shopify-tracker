-- Add 'admin' role to account_role enum (PLA-956)
-- Note: ALTER TYPE ADD VALUE is idempotent with IF NOT EXISTS
ALTER TYPE account_role ADD VALUE IF NOT EXISTS 'admin' BEFORE 'editor';
