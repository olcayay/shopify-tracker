-- GIN indexes for JSONB containment operators (@>)
-- These indexes dramatically speed up queries using @> on JSONB columns

-- breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_snapshots_integrations_gin
  ON app_snapshots USING GIN (integrations);

-- breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_snapshots_platform_data_gin
  ON app_snapshots USING GIN (platform_data);
