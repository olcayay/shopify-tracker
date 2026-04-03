-- Performance optimization indexes for common query patterns
-- NOTE: CONCURRENTLY removed because Drizzle runs migrations inside transactions.
-- IF NOT EXISTS ensures idempotency.

CREATE INDEX IF NOT EXISTS "idx_app_keyword_rankings_app_scraped"
  ON "app_keyword_rankings" ("app_id", "scraped_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_app_category_rankings_app_scraped"
  ON "app_category_rankings" ("app_id", "scraped_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_account_tracked_apps_account"
  ON "account_tracked_apps" ("account_id");

CREATE INDEX IF NOT EXISTS "idx_account_tracked_keywords_account"
  ON "account_tracked_keywords" ("account_id");

CREATE INDEX IF NOT EXISTS "idx_account_competitor_apps_account"
  ON "account_competitor_apps" ("account_id");

CREATE INDEX IF NOT EXISTS "idx_app_field_changes_app_detected"
  ON "app_field_changes" ("app_id", "detected_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_featured_app_sightings_app_date"
  ON "featured_app_sightings" ("app_id", "seen_date" DESC);

CREATE INDEX IF NOT EXISTS "idx_tracked_keywords_platform_active"
  ON "tracked_keywords" ("platform", "is_active");
