-- Change tracked_keywords slug unique constraint from global to per-platform
-- This allows the same keyword slug (e.g., "survey") to exist on multiple platforms

ALTER TABLE "tracked_keywords" DROP CONSTRAINT IF EXISTS "tracked_keywords_slug_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tracked_keywords_platform_slug" ON "tracked_keywords" ("platform", "slug");
