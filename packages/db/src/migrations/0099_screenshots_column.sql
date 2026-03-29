-- Add screenshots column to app_snapshots for normalized screenshot URLs
ALTER TABLE app_snapshots ADD COLUMN IF NOT EXISTS screenshots JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: extract screenshots from platformData where available
UPDATE app_snapshots
SET screenshots = COALESCE(platform_data->'screenshots', '[]'::jsonb)
WHERE platform_data->'screenshots' IS NOT NULL
  AND jsonb_typeof(platform_data->'screenshots') = 'array'
  AND jsonb_array_length(platform_data->'screenshots') > 0
  AND screenshots = '[]'::jsonb;
