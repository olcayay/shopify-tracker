-- Phase 1 Step 5: Add badges JSONB to apps, platform_data JSONB to app_snapshots.

ALTER TABLE apps ADD COLUMN IF NOT EXISTS badges jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE app_snapshots ADD COLUMN IF NOT EXISTS platform_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill badges from is_built_for_shopify
UPDATE apps SET badges = '["built_for_shopify"]'::jsonb WHERE is_built_for_shopify = true;
UPDATE apps SET badges = '[]'::jsonb WHERE is_built_for_shopify = false;
