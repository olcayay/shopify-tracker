-- Visibility scores: optimize DISTINCT ON (account_id, tracked_app_id, app_id) ORDER BY computed_at DESC
-- Used by competitors endpoint to fetch latest visibility score per app
-- Existing idx_app_visibility_unique_id has ASC ordering; DESC needed for DISTINCT ON + ORDER BY DESC
CREATE INDEX IF NOT EXISTS idx_app_visibility_scores_latest
ON app_visibility_scores (account_id, tracked_app_id, app_id, computed_at DESC);

-- Category snapshots: optimize DISTINCT ON (category_id) ORDER BY scraped_at DESC
-- Used by starred-categories endpoint. Existing idx_category_snapshots_cat_id_date has ASC ordering.
CREATE INDEX IF NOT EXISTS idx_category_snapshots_latest
ON category_snapshots (category_id, scraped_at DESC);
