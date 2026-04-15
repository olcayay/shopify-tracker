-- PLA-1096: speed up GET /api/apps/:slug competitor lookup
-- Query filters account_competitor_apps by (accountId, competitorAppId) but
-- existing indexes only cover (accountId, trackedAppId, competitorAppId) unique
-- and (trackedAppId). Add a composite index optimized for the lookup direction.
CREATE INDEX IF NOT EXISTS "idx_account_competitor_apps_account_competitor"
  ON "account_competitor_apps" ("account_id", "competitor_app_id");
