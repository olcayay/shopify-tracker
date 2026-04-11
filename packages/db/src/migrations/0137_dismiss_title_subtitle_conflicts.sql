-- Mark false appCardSubtitle changes where the old_value matches the app's current title.
-- These are artifacts of the extractDescription() fallback picking up the app name
-- instead of the real subtitle. Soft-dismiss with reason, don't delete.
UPDATE app_field_changes afc
SET dismiss_reason = 'title-subtitle-conflict'
WHERE afc.field = 'appCardSubtitle'
  AND afc.dismiss_reason IS NULL
  AND EXISTS (
    SELECT 1 FROM apps a
    WHERE a.id = afc.app_id
      AND lower(trim(a.name)) = lower(trim(afc.old_value))
  );
