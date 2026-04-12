-- PLA-1040: Scraper Management — per-(platform, scraper_type) JSONB config overrides.
-- Empty overrides object = "use all code defaults" (no behavior change on first deploy).
-- See files/SCRAPING-DEPTH.md §11 and apps/scraper/src/config-schema.ts for registry.
CREATE TABLE IF NOT EXISTS scraper_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  scraper_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by TEXT
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS scraper_configs_platform_type_uq ON scraper_configs (platform, scraper_type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_scraper_configs_platform ON scraper_configs (platform);
--> statement-breakpoint
-- Seed: every (platform, scraper_type) pair with empty overrides.
-- Idempotent via ON CONFLICT; safe to re-run.
INSERT INTO scraper_configs (platform, scraper_type, enabled, overrides)
SELECT platform, scraper_type, true, '{}'::jsonb
FROM (VALUES
  ('shopify'), ('wix'), ('wordpress'), ('atlassian'), ('zoom'), ('salesforce'),
  ('hubspot'), ('google_workspace'), ('zendesk'), ('canva'), ('zoho'), ('woocommerce')
) AS p(platform)
CROSS JOIN (VALUES
  ('app_details'), ('category'), ('keyword_search'), ('keyword_suggestions'), ('reviews')
) AS t(scraper_type)
ON CONFLICT (platform, scraper_type) DO NOTHING;
