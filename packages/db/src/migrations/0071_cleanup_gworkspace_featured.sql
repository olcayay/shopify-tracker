-- Cleanup: Remove curated/editorial sections from categories table.
-- These are not real taxonomy categories — they are featured app lists
-- (popular-apps, top-rated, recommended, etc.) and will be tracked
-- via featured_app_sightings instead.

-- Delete associated data first (foreign key dependencies)
DELETE FROM app_category_rankings
WHERE category_slug IN (
  'apps-to-discover', 'business-essentials', 'featured-partner-apps',
  'google-apps', 'popular-apps', 'recommended', 'top-rated', 'work-from-everywhere'
) AND category_slug IN (
  SELECT slug FROM categories WHERE platform = 'google_workspace'
);

DELETE FROM category_snapshots
WHERE category_id IN (
  SELECT id FROM categories
  WHERE platform = 'google_workspace'
  AND slug IN (
    'apps-to-discover', 'business-essentials', 'featured-partner-apps',
    'google-apps', 'popular-apps', 'recommended', 'top-rated', 'work-from-everywhere'
  )
);

DELETE FROM category_parents
WHERE category_id IN (
  SELECT id FROM categories
  WHERE platform = 'google_workspace'
  AND slug IN (
    'apps-to-discover', 'business-essentials', 'featured-partner-apps',
    'google-apps', 'popular-apps', 'recommended', 'top-rated', 'work-from-everywhere'
  )
) OR parent_category_id IN (
  SELECT id FROM categories
  WHERE platform = 'google_workspace'
  AND slug IN (
    'apps-to-discover', 'business-essentials', 'featured-partner-apps',
    'google-apps', 'popular-apps', 'recommended', 'top-rated', 'work-from-everywhere'
  )
);

-- Delete the curated categories themselves
DELETE FROM categories
WHERE platform = 'google_workspace'
AND slug IN (
  'apps-to-discover', 'business-essentials', 'featured-partner-apps',
  'google-apps', 'popular-apps', 'recommended', 'top-rated', 'work-from-everywhere'
);

-- Fix corrupted category titles (strip appended tooltip text)
UPDATE categories
SET title = REGEXP_REPLACE(title, 'info\s*More details about user reviews$', '', 'i')
WHERE platform = 'google_workspace'
AND title LIKE '%More details about user reviews';
