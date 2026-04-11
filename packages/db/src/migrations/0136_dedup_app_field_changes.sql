-- PLA-1001: Add dismissal/deletion reason to app_field_changes
-- Allows admin to flag problematic changes with a reason (duplicate, false-positive, etc.)
-- instead of deleting them. Admin can review and filter by reason in the App Updates page.

ALTER TABLE app_field_changes ADD COLUMN IF NOT EXISTS dismiss_reason VARCHAR(50);

-- Mark existing duplicates: for each (app_id, field, old_value, new_value) group with count > 1,
-- keep the first (lowest id) unmarked and flag all others as 'duplicate'.
UPDATE app_field_changes SET dismiss_reason = 'duplicate'
WHERE dismiss_reason IS NULL
AND id NOT IN (
  SELECT min(id)
  FROM app_field_changes
  GROUP BY app_id, field, md5(coalesce(old_value, '')), md5(coalesce(new_value, ''))
)
AND id IN (
  SELECT unnest(array_agg(id)) FROM (
    SELECT array_agg(id) as id, app_id, field,
           md5(coalesce(old_value, '')) as oh, md5(coalesce(new_value, '')) as nh
    FROM app_field_changes
    GROUP BY app_id, field, md5(coalesce(old_value, '')), md5(coalesce(new_value, ''))
    HAVING count(*) > 1
  ) t
);

CREATE INDEX IF NOT EXISTS idx_app_field_changes_dismiss_reason ON app_field_changes(dismiss_reason);
