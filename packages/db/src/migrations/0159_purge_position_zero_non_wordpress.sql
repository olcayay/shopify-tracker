-- Purge position=0 placeholder rows from app_category_rankings for non-WordPress
-- platforms. These were incorrectly inserted by the app-details scraper for all
-- non-Shopify platforms, but should only exist for WordPress tags. See PLA-1129.
DELETE FROM app_category_rankings
WHERE position = 0
AND app_id IN (
  SELECT id FROM apps WHERE platform <> 'wordpress'
);
