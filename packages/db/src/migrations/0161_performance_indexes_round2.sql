-- 0161: Performance audit round 2 — additional indexes
-- L3: accounts(package_id) — FK index for package lookups
-- L4: email_logs(status, created_at DESC) — composite for status-based queries
-- L7: reviews(rating) — for rating distribution queries
-- All use IF NOT EXISTS for idempotency.

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_accounts_package_id
  ON accounts(package_id);

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_email_logs_status_created
  ON email_logs(status, created_at DESC);

-- breakpoint
CREATE INDEX IF NOT EXISTS idx_reviews_rating
  ON reviews(rating);
