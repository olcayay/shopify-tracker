-- Prevent duplicate category rankings for the same app+category on the same day
-- This fixes the TOCTOU race condition (R-40) where concurrent jobs could both
-- insert a ranking for the same app+category when checking "already recorded today"

-- Step 1: Remove existing duplicates, keeping the row with the lowest id
DELETE FROM "app_category_rankings"
WHERE id NOT IN (
  SELECT MIN(id)
  FROM "app_category_rankings"
  GROUP BY "app_id", "category_slug", DATE("scraped_at")
);

-- Step 2: Now safe to create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_cat_rank_daily_unique"
  ON "app_category_rankings" ("app_id", "category_slug", (DATE("scraped_at")));
