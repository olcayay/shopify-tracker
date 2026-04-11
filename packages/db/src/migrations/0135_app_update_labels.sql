-- App update labels for system admin change classification
CREATE TABLE IF NOT EXISTS app_update_labels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Junction table: assign labels to app_field_changes
CREATE TABLE IF NOT EXISTS app_update_label_assignments (
  id SERIAL PRIMARY KEY,
  change_id INTEGER NOT NULL REFERENCES app_field_changes(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES app_update_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(change_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_app_update_label_assignments_change
  ON app_update_label_assignments(change_id);
CREATE INDEX IF NOT EXISTS idx_app_update_label_assignments_label
  ON app_update_label_assignments(label_id);
