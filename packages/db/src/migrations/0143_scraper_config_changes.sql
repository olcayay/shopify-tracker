-- PLA-1043: Audit log for every scraper_configs mutation.
-- Populated by API endpoints on PATCH/POST reset; used by admin UI History tab
-- and run-history Config snapshot dialog. No foreign key to scraper_configs —
-- keep audit rows even if the config row is later deleted.
CREATE TABLE IF NOT EXISTS scraper_config_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  scraper_type TEXT NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  changed_by TEXT,
  previous_overrides JSONB,
  new_overrides JSONB,
  previous_enabled BOOLEAN,
  new_enabled BOOLEAN,
  reason TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_scraper_config_changes_lookup
  ON scraper_config_changes (platform, scraper_type, changed_at DESC);
