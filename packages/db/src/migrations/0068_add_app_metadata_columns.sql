-- Add first-class metadata columns to apps table (platform-agnostic)
ALTER TABLE apps ADD COLUMN IF NOT EXISTS current_version varchar(50);
ALTER TABLE apps ADD COLUMN IF NOT EXISTS active_installs integer;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS last_updated_at timestamp;

-- Backfill existing WordPress apps from app_snapshots.platform_data JSONB
UPDATE apps
SET
  current_version = sub.version,
  active_installs = sub.active_installs,
  last_updated_at = sub.last_updated
FROM (
  SELECT DISTINCT ON (s.app_id)
    s.app_id,
    s.platform_data->>'version' AS version,
    (s.platform_data->>'activeInstalls')::integer AS active_installs,
    CASE
      WHEN s.platform_data->>'lastUpdated' IS NOT NULL
      THEN to_timestamp(
        regexp_replace(s.platform_data->>'lastUpdated', '\s+\w+$', ''),
        'YYYY-MM-DD HH12:MIam'
      )
      ELSE NULL
    END AS last_updated
  FROM app_snapshots s
  JOIN apps a ON a.id = s.app_id
  WHERE a.platform = 'wordpress'
    AND s.platform_data->>'version' IS NOT NULL
  ORDER BY s.app_id, s.scraped_at DESC
) sub
WHERE apps.id = sub.app_id;
