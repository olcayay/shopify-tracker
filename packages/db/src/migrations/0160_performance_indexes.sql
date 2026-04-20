-- 0160: Performance audit — add missing FK indexes, GIN index, and composite indexes
-- All indexes use IF NOT EXISTS for idempotency.
-- CONCURRENTLY requires -- breakpoint before each statement (Drizzle requirement).

-- Foreign key indexes on large tables (scrape_run_id references)
-- app_snapshots(scrape_run_id) already covered by idx_app_snapshots_scrape_run_id (migration 0094)
-- category_snapshots(scrape_run_id) already covered by idx_category_snapshots_scrape_run_id (migration 0094)

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_app_keyword_rankings_scrape_run
  ON app_keyword_rankings(scrape_run_id);

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_app_category_rankings_scrape_run
  ON app_category_rankings(scrape_run_id);

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_app_field_changes_scrape_run
  ON app_field_changes(scrape_run_id);

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_reviews_first_seen_run
  ON reviews(first_seen_run_id);

-- Foreign key indexes on sightings tables (first_seen_run_id, last_seen_run_id)

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_similar_sightings_first_run
  ON similar_app_sightings(first_seen_run_id);

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_similar_sightings_last_run
  ON similar_app_sightings(last_seen_run_id);

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_featured_sightings_first_run
  ON featured_app_sightings(first_seen_run_id);

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_featured_sightings_last_run
  ON featured_app_sightings(last_seen_run_id);

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_keyword_ad_sightings_first_run
  ON keyword_ad_sightings(first_seen_run_id);

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_keyword_ad_sightings_last_run
  ON keyword_ad_sightings(last_seen_run_id);

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_category_ad_sightings_first_run
  ON category_ad_sightings(first_seen_run_id);

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_category_ad_sightings_last_run
  ON category_ad_sightings(last_seen_run_id);

-- GIN index for JSONB expansion queries on categories
-- breakpoint
CREATE INDEX IF NOT EXISTS idx_app_snapshots_categories_gin
  ON app_snapshots USING GIN(categories);

-- Composite indexes for common query patterns

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_app_field_changes_detected
  ON app_field_changes(detected_at DESC);

-- app_review_metrics(app_id, computed_at DESC) already covered by idx_arm_app_date (migration 0115)
