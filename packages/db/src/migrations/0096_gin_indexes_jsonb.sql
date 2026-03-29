-- GIN indexes for JSONB containment operators (@>)
-- These indexes dramatically speed up queries using @> on JSONB columns
-- Note: Removed CONCURRENTLY because Drizzle runs migrations inside transactions

CREATE INDEX IF NOT EXISTS idx_app_snapshots_integrations_gin
  ON app_snapshots USING GIN (integrations);

CREATE INDEX IF NOT EXISTS idx_app_snapshots_platform_data_gin
  ON app_snapshots USING GIN (platform_data);
