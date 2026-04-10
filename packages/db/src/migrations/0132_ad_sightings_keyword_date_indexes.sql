-- Composite indexes for keyword-first ad sightings queries (PLA-972)
-- The /api/keywords endpoint queries keyword_ad_sightings with:
--   WHERE keyword_id IN (...) AND seen_date >= date
--   GROUP BY keyword_id
-- Existing indexes are (app_id, seen_date) and (app_id, keyword_id, seen_date)
-- but there's no (keyword_id, seen_date) index for keyword-first lookups.

CREATE INDEX IF NOT EXISTS idx_kw_ad_sightings_keyword_date
  ON keyword_ad_sightings (keyword_id, seen_date);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_cat_ad_sightings_category_date
  ON category_ad_sightings (category_id, seen_date);--> statement-breakpoint

-- Composite indexes for DISTINCT ON patterns on large tables
-- These cover the exact ORDER BY used in CTE queries: (partition_cols, sort_col DESC)

-- app_power_scores: 2.2M rows, DISTINCT ON (app_id, category_slug) ORDER BY computed_at DESC
CREATE INDEX IF NOT EXISTS idx_app_power_scores_app_cat_computed
  ON app_power_scores (app_id, category_slug, computed_at DESC);--> statement-breakpoint

-- app_keyword_rankings: 2.7M rows, DISTINCT ON (app_id, keyword_id) ORDER BY scraped_at DESC
CREATE INDEX IF NOT EXISTS idx_app_keyword_rankings_app_kw_scraped
  ON app_keyword_rankings (app_id, keyword_id, scraped_at DESC);--> statement-breakpoint

-- app_category_rankings: 2M rows, DISTINCT ON (app_id, category_slug) ORDER BY scraped_at DESC
CREATE INDEX IF NOT EXISTS idx_app_category_rankings_app_cat_scraped
  ON app_category_rankings (app_id, category_slug, scraped_at DESC);--> statement-breakpoint

-- keyword_snapshots: DISTINCT ON (keyword_id) ORDER BY scraped_at DESC
CREATE INDEX IF NOT EXISTS idx_keyword_snapshots_kw_scraped
  ON keyword_snapshots (keyword_id, scraped_at DESC);--> statement-breakpoint

-- app_snapshots: DISTINCT ON (app_id) ORDER BY scraped_at DESC
CREATE INDEX IF NOT EXISTS idx_app_snapshots_app_scraped
  ON app_snapshots (app_id, scraped_at DESC);
