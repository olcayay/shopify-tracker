-- PLA-773: Allow keywords without a tracked app (market research mode)
-- Make tracked_app_id nullable so keywords can be added for research without an app

ALTER TABLE account_tracked_keywords ALTER COLUMN tracked_app_id DROP NOT NULL;

-- Drop the old unique index and create a new one that handles NULLs properly.
-- PostgreSQL treats NULLs as distinct in unique indexes, so we need:
-- 1. A partial index for rows WITH tracked_app_id (same uniqueness as before)
-- 2. A partial index for rows WITHOUT tracked_app_id (unique keyword per account)
DROP INDEX IF EXISTS idx_account_tracked_keywords_unique;

CREATE UNIQUE INDEX idx_account_tracked_keywords_with_app
  ON account_tracked_keywords (account_id, tracked_app_id, keyword_id)
  WHERE tracked_app_id IS NOT NULL;

CREATE UNIQUE INDEX idx_account_tracked_keywords_no_app
  ON account_tracked_keywords (account_id, keyword_id)
  WHERE tracked_app_id IS NULL;
