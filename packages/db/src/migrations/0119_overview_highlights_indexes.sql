-- Add standalone indexes for tracked_app_id JOINs used by overview highlights and account stats
CREATE INDEX IF NOT EXISTS idx_account_tracked_keywords_app
  ON account_tracked_keywords (tracked_app_id);

CREATE INDEX IF NOT EXISTS idx_account_competitor_apps_tracked
  ON account_competitor_apps (tracked_app_id);
