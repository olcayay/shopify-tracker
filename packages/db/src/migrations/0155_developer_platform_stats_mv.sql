-- PLA-1103: speed up GET /api/developers sort=apps
-- Pre-aggregate per-(developer, platform) stats into a materialized view so the
-- hot path (sort-by-apps, platform filter) becomes an index lookup instead of
-- re-joining platform_developers × apps × latest app_snapshots on every request.
--
-- Shape is intentionally (global_developer_id, platform). Values are stored as
-- re-aggregable primitives (sums + counts, not pre-computed averages) so that
-- callers filtering by a platform subset can derive correct weighted averages
-- across any subset — not just the full set.
--
-- Refreshed by the scraper's post-scrape hooks (REFRESH MATERIALIZED VIEW
-- CONCURRENTLY), which requires the unique index below.

CREATE MATERIALIZED VIEW IF NOT EXISTS "developer_platform_stats" AS
WITH dev_apps AS (
  SELECT
    pd.global_developer_id,
    a.id AS app_id,
    a.platform,
    a.average_rating,
    a.rating_count,
    a.launched_date
  FROM apps a
  JOIN LATERAL (
    SELECT s.developer->>'name' AS dev_name
    FROM app_snapshots s
    WHERE s.app_id = a.id
    ORDER BY s.scraped_at DESC
    LIMIT 1
  ) ls ON ls.dev_name IS NOT NULL
  JOIN platform_developers pd
    ON pd.platform = a.platform AND pd.name = ls.dev_name
),
dedup AS (
  SELECT DISTINCT ON (global_developer_id, platform, app_id)
    global_developer_id, platform, app_id, average_rating, rating_count, launched_date
  FROM dev_apps
)
SELECT
  global_developer_id,
  platform,
  COUNT(DISTINCT app_id)::int AS app_count,
  -- Re-aggregable primitives. Use sum/count so downstream callers can compute
  -- weighted averages over arbitrary platform subsets.
  COALESCE(SUM(rating_count), 0)::bigint AS sum_rating_count,
  COUNT(rating_count)::int AS count_rating_count,
  COALESCE(SUM(average_rating) FILTER (WHERE rating_count IS NOT NULL AND rating_count > 0), 0)::numeric(14,4) AS sum_avg_rating,
  COUNT(*) FILTER (WHERE rating_count IS NOT NULL AND rating_count > 0)::int AS count_avg_rating,
  MIN(launched_date) AS first_launch_date,
  MAX(launched_date) AS last_launch_date
FROM dedup
GROUP BY global_developer_id, platform;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY (no read-side locking
-- during refresh). Doubles as a natural PK for joins from /api/developers.
CREATE UNIQUE INDEX IF NOT EXISTS "developer_platform_stats_pk"
  ON "developer_platform_stats" ("global_developer_id", "platform");

-- Sort-by-apps (platform-filtered) lookup index.
CREATE INDEX IF NOT EXISTS "idx_developer_platform_stats_platform_app_count"
  ON "developer_platform_stats" ("platform", "app_count" DESC);
