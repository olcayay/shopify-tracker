-- PLA-1081 follow-up: progress-aware staleness for scrape_runs.
-- Adds a `last_progress_at` column auto-maintained by a BEFORE UPDATE trigger
-- so cleanupStaleRuns can distinguish a genuinely stuck run from a long but
-- advancing one. See apps/scraper/src/jobs/cleanup-stale-runs.ts.
ALTER TABLE scrape_runs
  ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMPTZ DEFAULT now();

-- Seed existing rows so the new check has a sensible anchor: use started_at
-- when available, otherwise created_at. Only touch rows that are still null.
UPDATE scrape_runs
SET last_progress_at = COALESCE(started_at, created_at)
WHERE last_progress_at IS NULL;

-- Index on (status, last_progress_at) — cleanup's main filter.
CREATE INDEX IF NOT EXISTS idx_scrape_runs_status_last_progress
  ON scrape_runs(status, last_progress_at);

-- Auto-bump last_progress_at when metadata mutates on a running row. Uses
-- IS DISTINCT FROM so identical rewrites are no-ops; stays cheap.
CREATE OR REPLACE FUNCTION scrape_runs_touch_last_progress()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'running' AND NEW.metadata IS DISTINCT FROM OLD.metadata THEN
    NEW.last_progress_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_scrape_runs_touch_last_progress ON scrape_runs;

CREATE TRIGGER tr_scrape_runs_touch_last_progress
BEFORE UPDATE ON scrape_runs
FOR EACH ROW EXECUTE FUNCTION scrape_runs_touch_last_progress();
