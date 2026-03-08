-- Platform visibility controls: allow system admin to hide platforms globally
-- and grant per-account overrides.

CREATE TABLE IF NOT EXISTS platform_visibility (
  platform varchar(20) PRIMARY KEY,
  is_visible boolean NOT NULL DEFAULT false,
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- Seed: shopify visible, salesforce and canva hidden
INSERT INTO platform_visibility (platform, is_visible) VALUES
  ('shopify', true),
  ('salesforce', false),
  ('canva', false)
ON CONFLICT (platform) DO NOTHING;

-- Add override column to account_platforms
ALTER TABLE account_platforms
  ADD COLUMN IF NOT EXISTS override_global_visibility boolean NOT NULL DEFAULT false;
