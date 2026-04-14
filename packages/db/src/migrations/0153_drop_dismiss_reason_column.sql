-- PLA-1094 Part 2: drop the legacy app_field_changes.dismiss_reason column.
--
-- Migration 0152 backfilled every dismiss_reason value into the labels system
-- (via `is_dismissal = TRUE` labels). After this point no code reads or writes
-- dismiss_reason — the column and its index are dead weight.

DROP INDEX IF EXISTS idx_app_field_changes_dismiss_reason;

ALTER TABLE app_field_changes
  DROP COLUMN IF EXISTS dismiss_reason;
