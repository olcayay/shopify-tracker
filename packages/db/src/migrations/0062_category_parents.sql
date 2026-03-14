-- 0062: Create category_parents junction table for 1-to-N parent-child relationships
-- and merge Canva compound-slug categories into simple slugs.

-- ============================================================
-- 1. Create table + indexes
-- ============================================================
CREATE TABLE IF NOT EXISTS category_parents (
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  parent_category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (category_id, parent_category_id)
);

CREATE INDEX IF NOT EXISTS idx_category_parents_parent ON category_parents(parent_category_id);

-- ============================================================
-- 2. Backfill from existing parentSlug for ALL platforms
-- ============================================================
INSERT INTO category_parents (category_id, parent_category_id)
SELECT c.id, p.id
FROM categories c
JOIN categories p ON p.slug = c.parent_slug AND p.platform = c.platform
WHERE c.parent_slug IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Merge Canva compound-slug categories
--    Compound slugs have the form "parent--topic" (e.g., "project-management--forms")
--    We merge them into the simple topic slug (e.g., "forms")
-- ============================================================

-- 3a. Create simple-slug categories for topics that don't already exist.
--     Pick the first compound row (by id) as the source for title, url, etc.
INSERT INTO categories (platform, slug, title, url, parent_slug, category_level, description, is_tracked, is_listing_page, created_at, updated_at)
SELECT DISTINCT ON (simple_slug)
  'canva' AS platform,
  simple_slug AS slug,
  compound.title,
  'https://www.canva.com/apps?topic=' || simple_slug AS url,
  -- Set parent_slug to the first parent (arbitrary, for backward compat)
  (SELECT split_part(c2.slug, '--', 1)
   FROM categories c2
   WHERE c2.platform = 'canva'
     AND c2.slug LIKE '%--%'
     AND split_part(c2.slug, '--', 2) = simple_slug
   ORDER BY c2.id
   LIMIT 1) AS parent_slug,
  compound.category_level,
  compound.description,
  compound.is_tracked,
  compound.is_listing_page,
  compound.created_at,
  now()
FROM (
  SELECT
    split_part(slug, '--', 2) AS simple_slug,
    title,
    category_level,
    description,
    is_tracked,
    is_listing_page,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY split_part(slug, '--', 2) ORDER BY id) AS rn
  FROM categories
  WHERE platform = 'canva' AND position('--' in slug) > 0
) compound
WHERE compound.rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM categories ex
    WHERE ex.platform = 'canva' AND ex.slug = compound.simple_slug
  );

-- 3b. Insert junction rows linking each simple-slug category to all its parent categories.
INSERT INTO category_parents (category_id, parent_category_id)
SELECT DISTINCT
  simple_cat.id AS category_id,
  parent_cat.id AS parent_category_id
FROM categories compound
JOIN categories simple_cat
  ON simple_cat.platform = 'canva'
  AND simple_cat.slug = split_part(compound.slug, '--', 2)
JOIN categories parent_cat
  ON parent_cat.platform = 'canva'
  AND parent_cat.slug = split_part(compound.slug, '--', 1)
WHERE compound.platform = 'canva'
  AND position('--' in compound.slug) > 0
ON CONFLICT DO NOTHING;

-- 3c. Migrate category_snapshots: update category_id from compound to simple
UPDATE category_snapshots cs
SET category_id = simple_cat.id
FROM categories compound
JOIN categories simple_cat
  ON simple_cat.platform = 'canva'
  AND simple_cat.slug = split_part(compound.slug, '--', 2)
WHERE cs.category_id = compound.id
  AND compound.platform = 'canva'
  AND position('--' in compound.slug) > 0
  AND compound.id != simple_cat.id;

-- 3d. Migrate app_category_rankings: update category_slug from compound to simple
UPDATE app_category_rankings acr
SET category_slug = split_part(acr.category_slug, '--', 2)
WHERE position('--' in acr.category_slug) > 0
  AND EXISTS (
    SELECT 1 FROM categories c
    WHERE c.slug = acr.category_slug AND c.platform = 'canva'
  );

-- 3e. Migrate app_power_scores: update category_slug from compound to simple
UPDATE app_power_scores aps
SET category_slug = split_part(aps.category_slug, '--', 2)
WHERE position('--' in aps.category_slug) > 0
  AND EXISTS (
    SELECT 1 FROM categories c
    WHERE c.slug = aps.category_slug AND c.platform = 'canva'
  );

-- 3f. Migrate account_starred_categories: update category_id from compound to simple
UPDATE account_starred_categories asc_table
SET category_id = simple_cat.id
FROM categories compound
JOIN categories simple_cat
  ON simple_cat.platform = 'canva'
  AND simple_cat.slug = split_part(compound.slug, '--', 2)
WHERE asc_table.category_id = compound.id
  AND compound.platform = 'canva'
  AND position('--' in compound.slug) > 0
  AND compound.id != simple_cat.id;

-- 3g. Migrate category_ad_sightings: update category_id from compound to simple
UPDATE category_ad_sightings cas
SET category_id = simple_cat.id
FROM categories compound
JOIN categories simple_cat
  ON simple_cat.platform = 'canva'
  AND simple_cat.slug = split_part(compound.slug, '--', 2)
WHERE cas.category_id = compound.id
  AND compound.platform = 'canva'
  AND position('--' in compound.slug) > 0
  AND compound.id != simple_cat.id;

-- 3h. Deduplicate category_snapshots (same category + same scrape run)
DELETE FROM category_snapshots cs1
USING category_snapshots cs2
WHERE cs1.category_id = cs2.category_id
  AND cs1.scrape_run_id = cs2.scrape_run_id
  AND cs1.id > cs2.id;

-- 3i. Deduplicate app_category_rankings (same app + same category_slug + same scrape_run)
DELETE FROM app_category_rankings acr1
USING app_category_rankings acr2
WHERE acr1.app_id = acr2.app_id
  AND acr1.category_slug = acr2.category_slug
  AND acr1.scrape_run_id = acr2.scrape_run_id
  AND acr1.id > acr2.id;

-- 3j. Deduplicate app_power_scores (same app + same category_slug + same computed_at)
DELETE FROM app_power_scores aps1
USING app_power_scores aps2
WHERE aps1.app_id = aps2.app_id
  AND aps1.category_slug = aps2.category_slug
  AND aps1.computed_at = aps2.computed_at
  AND aps1.id > aps2.id;

-- 3k. Deduplicate account_starred_categories (same account + same category_id)
-- The unique index idx_account_starred_categories_unique(account_id, category_id) may block dups,
-- but let's clean up just in case (using id ordering since PK is uuid).
DELETE FROM account_starred_categories a1
USING account_starred_categories a2
WHERE a1.account_id = a2.account_id
  AND a1.category_id = a2.category_id
  AND a1.id > a2.id;

-- 3l. Deduplicate category_ad_sightings (same app + same category_id + same seen_date)
-- The unique index idx_cat_ad_sightings_unique(app_id, category_id, seen_date) may block dups.
DELETE FROM category_ad_sightings cas1
USING category_ad_sightings cas2
WHERE cas1.app_id = cas2.app_id
  AND cas1.category_id = cas2.category_id
  AND cas1.seen_date = cas2.seen_date
  AND cas1.id > cas2.id;

-- 3m. Delete orphaned compound-slug category rows (all references have been migrated)
DELETE FROM categories
WHERE platform = 'canva'
  AND position('--' in slug) > 0;
