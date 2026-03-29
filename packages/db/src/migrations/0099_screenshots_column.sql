-- Add screenshots column to app_snapshots for normalized screenshot URLs
ALTER TABLE app_snapshots ADD COLUMN IF NOT EXISTS screenshots JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: extract screenshots from platformData where available
UPDATE app_snapshots
SET screenshots = platform_data->'screenshots'
WHERE platform_data->'screenshots' IS NOT NULL
  AND jsonb_typeof(platform_data->'screenshots') = 'array'
  AND screenshots = '[]'::jsonb;
