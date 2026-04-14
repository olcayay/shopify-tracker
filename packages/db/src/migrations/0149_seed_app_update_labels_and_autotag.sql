-- PLA-1072 Part B: auto-tag false-positive app_field_changes rows.
--
-- Part A (commit bc1dd9f7) stopped the scraper from creating new "before→empty"
-- drift rows on the card-refresh path. Part B closes the loop: every row with
-- an empty new_value — past or future — is tagged with the `false-empty-after`
-- system label so system-admin can filter and bulk-dismiss them.
--
-- The trigger is the single source of truth: it fires for every insert path
-- (card-pass, detail-pass, future reconcilers) without requiring application
-- code changes.

-- 1. Seed the system label (idempotent).
INSERT INTO app_update_labels (name, color)
VALUES ('false-empty-after', '#9ca3af')
ON CONFLICT (name) DO NOTHING;

-- 2. Trigger function: tag any newly-inserted app_field_changes row whose
--    new_value is null / empty-string / empty-json-array.
CREATE OR REPLACE FUNCTION tag_false_empty_app_update() RETURNS TRIGGER AS $$
DECLARE
  lbl_id INTEGER;
BEGIN
  IF NEW.new_value IS NULL OR NEW.new_value = '' OR NEW.new_value = '[]' THEN
    SELECT id INTO lbl_id FROM app_update_labels WHERE name = 'false-empty-after';
    IF lbl_id IS NOT NULL THEN
      INSERT INTO app_update_label_assignments (change_id, label_id)
      VALUES (NEW.id, lbl_id)
      ON CONFLICT (change_id, label_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tag_false_empty ON app_field_changes;
CREATE TRIGGER trg_tag_false_empty
  AFTER INSERT ON app_field_changes
  FOR EACH ROW
  EXECUTE FUNCTION tag_false_empty_app_update();

-- 3. Backfill: tag every existing false-empty row.
--    Idempotent via the ON CONFLICT on the (change_id, label_id) unique index.
INSERT INTO app_update_label_assignments (change_id, label_id)
SELECT afc.id, l.id
FROM app_field_changes afc
CROSS JOIN app_update_labels l
WHERE l.name = 'false-empty-after'
  AND (afc.new_value IS NULL OR afc.new_value = '' OR afc.new_value = '[]')
ON CONFLICT (change_id, label_id) DO NOTHING;
