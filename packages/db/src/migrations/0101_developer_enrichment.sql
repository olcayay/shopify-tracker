-- Add enrichment columns to global_developers
ALTER TABLE global_developers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE global_developers ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE global_developers ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}';
ALTER TABLE global_developers ADD COLUMN IF NOT EXISTS total_apps INTEGER NOT NULL DEFAULT 0;
ALTER TABLE global_developers ADD COLUMN IF NOT EXISTS total_reviews INTEGER NOT NULL DEFAULT 0;
ALTER TABLE global_developers ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2);
ALTER TABLE global_developers ADD COLUMN IF NOT EXISTS platforms_active INTEGER NOT NULL DEFAULT 0;
ALTER TABLE global_developers ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP;
