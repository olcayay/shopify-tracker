-- Add rating, review count, and pricing hint columns to apps table
-- These are populated from category/keyword/feature listing pages
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "average_rating" decimal(3, 2);
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "rating_count" integer;
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "pricing_hint" text;
