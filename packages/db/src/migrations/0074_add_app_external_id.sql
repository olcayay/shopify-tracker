-- Add external_id column to apps table for platform-specific identifiers
-- (e.g., Atlassian numeric addonId needed for human-readable URLs)
ALTER TABLE apps ADD COLUMN IF NOT EXISTS external_id varchar(100);
