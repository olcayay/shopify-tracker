ALTER TABLE account_competitor_apps ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill existing rows: assign sort_order based on creation order within each (account, tracked_app) group
UPDATE account_competitor_apps
SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY account_id, tracked_app_slug ORDER BY created_at) AS rn
  FROM account_competitor_apps
) sub
WHERE account_competitor_apps.id = sub.id;
