-- Phase 1 Step 4: Add platform to apps, categories, tracked_keywords, scrape_runs.
-- Default 'shopify' for all existing data.

ALTER TABLE apps ADD COLUMN IF NOT EXISTS platform varchar(20) NOT NULL DEFAULT 'shopify';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS platform varchar(20) NOT NULL DEFAULT 'shopify';
ALTER TABLE tracked_keywords ADD COLUMN IF NOT EXISTS platform varchar(20) NOT NULL DEFAULT 'shopify';
ALTER TABLE scrape_runs ADD COLUMN IF NOT EXISTS platform varchar(20);
ALTER TABLE app_power_scores ADD COLUMN IF NOT EXISTS platform varchar(20) NOT NULL DEFAULT 'shopify';
ALTER TABLE research_projects ADD COLUMN IF NOT EXISTS platform varchar(20) NOT NULL DEFAULT 'shopify';

-- Backfill scrape_runs platform for existing data
UPDATE scrape_runs SET platform = 'shopify' WHERE platform IS NULL;

-- Add composite unique constraints (platform, slug)
-- First drop the old single-column unique constraints
ALTER TABLE apps DROP CONSTRAINT IF EXISTS apps_slug_unique;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_unique;

-- Now the keyword unique constraint
ALTER TABLE tracked_keywords DROP CONSTRAINT IF EXISTS tracked_keywords_keyword_unique;

-- Create composite uniques
CREATE UNIQUE INDEX IF NOT EXISTS idx_apps_platform_slug ON apps (platform, slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_platform_slug ON categories (platform, slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracked_keywords_platform_keyword ON tracked_keywords (platform, keyword);

-- Keep the slug unique index on tracked_keywords for URL routing
-- (slug is derived from keyword, always globally unique)

-- Add platform-aware scrape_runs index
CREATE INDEX IF NOT EXISTS idx_scrape_runs_platform_type_started ON scrape_runs (platform, scraper_type, started_at);
