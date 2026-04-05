-- Performance indexes for scraper queries (PLA-754)
-- These queries run during post-scrape event detection and were causing statement timeouts.

-- app_keyword_rankings: batch lookup by app_id + scrape_run_id
CREATE INDEX IF NOT EXISTS idx_akr_app_run
  ON app_keyword_rankings (app_id, scrape_run_id);

-- app_category_rankings: batch lookup by app_id + scrape_run_id
CREATE INDEX IF NOT EXISTS idx_acr_app_run
  ON app_category_rankings (app_id, scrape_run_id);

-- app_review_metrics: lookup by app_id ordered by computed_at (for latest/previous)
CREATE INDEX IF NOT EXISTS idx_arm_app_date
  ON app_review_metrics (app_id, computed_at DESC);

-- scrape_runs: lookup by job_id + scraper_type (for BullMQ job ID → UUID resolution)
CREATE INDEX IF NOT EXISTS idx_scrape_runs_job_type
  ON scrape_runs (job_id, scraper_type);
