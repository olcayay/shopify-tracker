-- Widen VARCHAR(500) columns to TEXT to prevent "value too long" errors
-- These columns can receive arbitrarily long content from scraped pages

-- apps table
ALTER TABLE "apps" ALTER COLUMN "name" TYPE text;
ALTER TABLE "apps" ALTER COLUMN "app_card_subtitle" TYPE text;
ALTER TABLE "apps" ALTER COLUMN "icon_url" TYPE text;

-- app_snapshots table
ALTER TABLE "app_snapshots" ALTER COLUMN "app_introduction" TYPE text;
ALTER TABLE "app_snapshots" ALTER COLUMN "seo_title" TYPE text;
ALTER TABLE "app_snapshots" ALTER COLUMN "pricing" TYPE text;
ALTER TABLE "app_snapshots" ALTER COLUMN "demo_store_url" TYPE text;
