-- This must run outside a transaction (ALTER TYPE ... ADD VALUE cannot run inside a transaction block)
-- Run manually: psql -c "ALTER TYPE scraper_type ADD VALUE IF NOT EXISTS 'compute_similarity_scores';"
-- Then run migration 0035 for the table creation.
ALTER TYPE "scraper_type" ADD VALUE IF NOT EXISTS 'compute_similarity_scores';
