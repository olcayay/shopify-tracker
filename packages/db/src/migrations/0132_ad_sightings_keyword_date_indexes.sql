-- Composite indexes for keyword-first ad sightings queries (PLA-972)
-- The /api/keywords endpoint queries keyword_ad_sightings with:
--   WHERE keyword_id IN (...) AND seen_date >= date
--   GROUP BY keyword_id
-- Existing indexes are (app_id, seen_date) and (app_id, keyword_id, seen_date)
-- but there's no (keyword_id, seen_date) index for keyword-first lookups.

-- breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kw_ad_sightings_keyword_date
  ON keyword_ad_sightings (keyword_id, seen_date);

-- breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cat_ad_sightings_keyword_date
  ON category_ad_sightings (keyword_id, seen_date);
