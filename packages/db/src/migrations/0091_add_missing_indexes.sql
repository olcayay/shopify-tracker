-- 0091: Add missing indexes on large tables for query performance
-- PLA-186 / Risk R-75

-- breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scrape_runs_completed_at ON scrape_runs(completed_at);

-- breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_snapshots_scraped_at ON app_snapshots(scraped_at);

-- breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_keyword_snapshots_scraped_at ON keyword_snapshots(scraped_at);

-- breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_app_id_created_at ON reviews(app_id, created_at);
