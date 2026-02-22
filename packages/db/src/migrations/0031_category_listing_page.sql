-- Add is_listing_page flag to categories table
ALTER TABLE categories ADD COLUMN is_listing_page boolean NOT NULL DEFAULT true;

-- Root categories (level 0) are always hub pages
UPDATE categories SET is_listing_page = false WHERE category_level = 0;

-- Categories that never had a non-null app_count in any snapshot are hub pages
UPDATE categories SET is_listing_page = false
WHERE category_level > 0
AND slug NOT IN (
  SELECT DISTINCT category_slug FROM category_snapshots WHERE app_count IS NOT NULL
);
