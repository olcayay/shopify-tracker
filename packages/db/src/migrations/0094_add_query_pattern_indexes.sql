-- 0094: Add missing indexes for common query patterns
-- PLA-151: Many queries filter by non-leading columns of existing composite indexes
-- Note: Removed CONCURRENTLY because Drizzle runs migrations inside transactions

-- app_keyword_rankings: queries filter by keyword_id alone (deletes, research aggregations)
-- Existing index is (app_id, keyword_id, scraped_at) so keyword_id-only lookups do full scans
CREATE INDEX IF NOT EXISTS idx_app_kw_rank_keyword_id ON app_keyword_rankings("keyword_id");

-- Snapshot tables: admin routes query by scrape_run_id to show run details
CREATE INDEX IF NOT EXISTS idx_app_snapshots_scrape_run_id ON app_snapshots("scrape_run_id");
CREATE INDEX IF NOT EXISTS idx_keyword_snapshots_scrape_run_id ON keyword_snapshots("scrape_run_id");
CREATE INDEX IF NOT EXISTS idx_category_snapshots_scrape_run_id ON category_snapshots("scrape_run_id");

-- account_tracked_apps: queried by app_id alone (checking if app is tracked by any account)
-- Existing unique index is (account_id, app_id) so app_id-only lookups can't use it
CREATE INDEX IF NOT EXISTS idx_account_tracked_apps_app_id ON account_tracked_apps("app_id");

-- account_tracked_keywords: queried by keyword_id alone (cascade deletes, keyword usage checks)
-- Existing unique index is (account_id, tracked_app_id, keyword_id)
CREATE INDEX IF NOT EXISTS idx_account_tracked_keywords_keyword_id ON account_tracked_keywords("keyword_id");

-- account_competitor_apps: queried by competitor_app_id and tracked_app_id independently
-- Existing unique index is (account_id, tracked_app_id, competitor_app_id)
CREATE INDEX IF NOT EXISTS idx_account_competitor_apps_competitor_id ON account_competitor_apps("competitor_app_id");
CREATE INDEX IF NOT EXISTS idx_account_competitor_apps_tracked_id ON account_competitor_apps("tracked_app_id");

-- account_starred_categories: queried by category_id alone (cascade deletes)
-- Existing unique index is (account_id, category_id)
CREATE INDEX IF NOT EXISTS idx_account_starred_categories_cat_id ON account_starred_categories("category_id");

-- scrape_runs: DISTINCT ON (platform, scraper_type) ORDER BY completed_at DESC in admin dashboard
CREATE INDEX IF NOT EXISTS idx_scrape_runs_platform_type_completed ON scrape_runs("platform", "scraper_type", "completed_at" DESC);
