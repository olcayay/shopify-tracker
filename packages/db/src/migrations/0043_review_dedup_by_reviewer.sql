-- Fix: Edited reviews were being saved as new records because the unique index
-- included reviewDate, which changes when a review is edited on Shopify.
-- Shopify allows only one review per user per app, so (app_slug, reviewer_name)
-- is the correct dedup key.

-- Step 1: Remove duplicate reviews, keeping the one with the latest review_date
DELETE FROM reviews
WHERE id NOT IN (
  SELECT DISTINCT ON (app_slug, reviewer_name)
    id
  FROM reviews
  ORDER BY app_slug, reviewer_name, review_date DESC, id DESC
);

-- Step 2: Drop the old unique index
DROP INDEX IF EXISTS idx_reviews_dedup;

-- Step 3: Create the new unique index on (app_slug, reviewer_name)
CREATE UNIQUE INDEX idx_reviews_dedup ON reviews (app_slug, reviewer_name);
