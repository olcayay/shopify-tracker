-- Add delisted_at column to track apps that have been removed from a marketplace.
-- See PLA-1035: observation-phase tracking; apps are NOT auto-skipped.
ALTER TABLE apps ADD COLUMN IF NOT EXISTS delisted_at TIMESTAMP NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_apps_delisted_at ON apps (delisted_at) WHERE delisted_at IS NOT NULL;
