-- PLA-1066: forensic pointer from a stall-retry's new scrape_runs row back to
-- the original run that stalled. Optional column; older rows are NULL.
ALTER TABLE "scrape_runs"
  ADD COLUMN IF NOT EXISTS "parent_run_id" UUID
  REFERENCES "scrape_runs"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_scrape_runs_parent_run_id"
  ON "scrape_runs" ("parent_run_id")
  WHERE "parent_run_id" IS NOT NULL;
