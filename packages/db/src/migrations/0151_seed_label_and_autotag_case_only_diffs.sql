-- PLA-1092: auto-tag case-only diffs on `name` and `seoTitle` fields.
--
-- Same pattern as migration 0149 (false-empty-after). The scraper guard in
-- app-details-scraper.ts now prevents new false-positive rows; this migration
-- seeds the system label, installs the post-insert trigger, and backfills
-- any historical rows that match the predicate.

-- 1. Seed the system label.
INSERT INTO app_update_labels (name, color)
VALUES ('case-only-diff', '#9ca3af')
ON CONFLICT (name) DO NOTHING;

-- 2. Trigger function: tag any new app_field_changes row whose `name` or
--    `seoTitle` field differs only by letter case. `IS DISTINCT FROM` handles
--    the null-safe equality; the LOWER() comparison catches the false positive.
CREATE OR REPLACE FUNCTION tag_case_only_app_update() RETURNS TRIGGER AS $$
DECLARE
  lbl_id INTEGER;
BEGIN
  IF NEW.field IN ('name', 'seoTitle')
     AND NEW.old_value IS NOT NULL
     AND NEW.new_value IS NOT NULL
     AND NEW.old_value IS DISTINCT FROM NEW.new_value
     AND LOWER(NEW.old_value) = LOWER(NEW.new_value) THEN
    SELECT id INTO lbl_id FROM app_update_labels WHERE name = 'case-only-diff';
    IF lbl_id IS NOT NULL THEN
      INSERT INTO app_update_label_assignments (change_id, label_id)
      VALUES (NEW.id, lbl_id)
      ON CONFLICT (change_id, label_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tag_case_only ON app_field_changes;
CREATE TRIGGER trg_tag_case_only
  AFTER INSERT ON app_field_changes
  FOR EACH ROW
  EXECUTE FUNCTION tag_case_only_app_update();

-- 3. Backfill: tag every existing case-only row.
INSERT INTO app_update_label_assignments (change_id, label_id)
SELECT afc.id, l.id
FROM app_field_changes afc
CROSS JOIN app_update_labels l
WHERE l.name = 'case-only-diff'
  AND afc.field IN ('name', 'seoTitle')
  AND afc.old_value IS NOT NULL
  AND afc.new_value IS NOT NULL
  AND afc.old_value IS DISTINCT FROM afc.new_value
  AND LOWER(afc.old_value) = LOWER(afc.new_value)
ON CONFLICT (change_id, label_id) DO NOTHING;
