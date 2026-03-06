-- Phase 1 Step 6: Account platforms table + max_platforms limit.

-- Add max_platforms to packages and accounts
ALTER TABLE packages ADD COLUMN IF NOT EXISTS max_platforms integer NOT NULL DEFAULT 1;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS max_platforms integer NOT NULL DEFAULT 1;

-- Set package defaults
UPDATE packages SET max_platforms = 1 WHERE slug = 'free';
UPDATE packages SET max_platforms = 3 WHERE slug IN ('starter', 'pro');
UPDATE packages SET max_platforms = 3 WHERE slug = 'enterprise';

-- Create account_platforms junction table
CREATE TABLE IF NOT EXISTS account_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform varchar(20) NOT NULL,
  enabled_at timestamp NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, platform)
);

-- Seed: all existing accounts get Shopify access
INSERT INTO account_platforms (account_id, platform)
SELECT id, 'shopify' FROM accounts
ON CONFLICT (account_id, platform) DO NOTHING;
