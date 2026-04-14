-- PLA-1094: Unify `app_field_changes.dismiss_reason` into the labels system.
--
-- The old `dismiss_reason` column and the new `app_update_labels` table were
-- doing the same job (categorize / hide false-positive changes). Part 1 of 2:
-- extend the labels table with `is_dismissal`, seed the existing dismiss
-- reasons as system labels, and backfill every row that has a dismiss_reason
-- with the matching label assignment.
--
-- Part 2 (migration 0153) drops the `dismiss_reason` column after the backfill
-- is verified. Keeping it in a separate file so the two phases can be reviewed
-- and, if needed, rolled back independently.

-- 1. Add is_dismissal flag to labels.
ALTER TABLE app_update_labels
  ADD COLUMN IF NOT EXISTS is_dismissal BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Mark the two existing auto-labels as dismissal (they already functioned
--    as dismissal signals — the scraper skips / ignores matching rows).
UPDATE app_update_labels
  SET is_dismissal = TRUE
  WHERE name IN ('false-empty-after', 'case-only-diff');

-- 3. Seed the five dismiss_reason values as system labels. Colors come from
--    the destructive palette (red-ish) so the UI can render them distinctly
--    from regular labels.
INSERT INTO app_update_labels (name, color, is_dismissal) VALUES
  ('duplicate',                '#dc2626', TRUE),
  ('false-positive',           '#b91c1c', TRUE),
  ('scraper-error',            '#991b1b', TRUE),
  ('irrelevant',               '#7f1d1d', TRUE),
  ('title-subtitle-conflict',  '#ef4444', TRUE)
ON CONFLICT (name) DO UPDATE
  SET is_dismissal = EXCLUDED.is_dismissal,
      color = EXCLUDED.color;

-- 4. Backfill: for each row with a dismiss_reason, insert the matching label
--    assignment. Idempotent via the (change_id, label_id) unique index.
INSERT INTO app_update_label_assignments (change_id, label_id)
SELECT afc.id, l.id
FROM app_field_changes afc
JOIN app_update_labels l ON l.name = afc.dismiss_reason
WHERE afc.dismiss_reason IS NOT NULL
ON CONFLICT (change_id, label_id) DO NOTHING;

-- 5. Index for the hot read path: "does this change have any dismissal
--    label?". Existing idx_app_update_label_assignments_change covers
--    change_id, but we need to filter on is_dismissal too. Use a partial
--    index on assignments joined with is_dismissal labels via a covering
--    index on (label_id, change_id) for dismissal labels only.
CREATE INDEX IF NOT EXISTS idx_app_update_labels_is_dismissal
  ON app_update_labels(id)
  WHERE is_dismissal = TRUE;
