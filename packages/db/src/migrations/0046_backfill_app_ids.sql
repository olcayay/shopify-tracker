-- Phase 1 Step 2: Backfill app_id and category_id from slug lookups.

-- Backfill app_id from app_slug
UPDATE app_snapshots SET app_id = a.id FROM apps a WHERE app_snapshots.app_slug = a.slug;
UPDATE app_field_changes SET app_id = a.id FROM apps a WHERE app_field_changes.app_slug = a.slug;
UPDATE app_category_rankings SET app_id = a.id FROM apps a WHERE app_category_rankings.app_slug = a.slug;
UPDATE app_keyword_rankings SET app_id = a.id FROM apps a WHERE app_keyword_rankings.app_slug = a.slug;
UPDATE keyword_ad_sightings SET app_id = a.id FROM apps a WHERE keyword_ad_sightings.app_slug = a.slug;
UPDATE category_ad_sightings SET app_id = a.id FROM apps a WHERE category_ad_sightings.app_slug = a.slug;
UPDATE reviews SET app_id = a.id FROM apps a WHERE reviews.app_slug = a.slug;
UPDATE featured_app_sightings SET app_id = a.id FROM apps a WHERE featured_app_sightings.app_slug = a.slug;
UPDATE similar_app_sightings SET app_id = a.id FROM apps a WHERE similar_app_sightings.app_slug = a.slug;
UPDATE similar_app_sightings SET similar_app_id = a.id FROM apps a WHERE similar_app_sightings.similar_app_slug = a.slug;
UPDATE app_similarity_scores SET app_id_a = a.id FROM apps a WHERE app_similarity_scores.app_slug_a = a.slug;
UPDATE app_similarity_scores SET app_id_b = a.id FROM apps a WHERE app_similarity_scores.app_slug_b = a.slug;
UPDATE app_review_metrics SET app_id = a.id FROM apps a WHERE app_review_metrics.app_slug = a.slug;
UPDATE app_power_scores SET app_id = a.id FROM apps a WHERE app_power_scores.app_slug = a.slug;
UPDATE app_visibility_scores SET tracked_app_id = a.id FROM apps a WHERE app_visibility_scores.tracked_app_slug = a.slug;
UPDATE app_visibility_scores SET app_id = a.id FROM apps a WHERE app_visibility_scores.app_slug = a.slug;
UPDATE account_tracked_apps SET app_id = a.id FROM apps a WHERE account_tracked_apps.app_slug = a.slug;
UPDATE account_tracked_keywords SET tracked_app_id = a.id FROM apps a WHERE account_tracked_keywords.tracked_app_slug = a.slug;
UPDATE account_competitor_apps SET tracked_app_id = a.id FROM apps a WHERE account_competitor_apps.tracked_app_slug = a.slug;
UPDATE account_competitor_apps SET competitor_app_id = a.id FROM apps a WHERE account_competitor_apps.app_slug = a.slug;
UPDATE research_project_competitors SET app_id = a.id FROM apps a WHERE research_project_competitors.app_slug = a.slug;

-- Backfill category_id from category_slug
UPDATE category_snapshots SET category_id = c.id FROM categories c WHERE category_snapshots.category_slug = c.slug;
UPDATE category_ad_sightings SET category_id = c.id FROM categories c WHERE category_ad_sightings.category_slug = c.slug;
UPDATE account_starred_categories SET category_id = c.id FROM categories c WHERE account_starred_categories.category_slug = c.slug;

-- Delete any orphaned rows where the slug didn't match (shouldn't happen, but safety)
DELETE FROM app_snapshots WHERE app_id IS NULL;
DELETE FROM app_field_changes WHERE app_id IS NULL;
DELETE FROM app_category_rankings WHERE app_id IS NULL;
DELETE FROM app_keyword_rankings WHERE app_id IS NULL;
DELETE FROM keyword_ad_sightings WHERE app_id IS NULL;
DELETE FROM category_ad_sightings WHERE app_id IS NULL;
DELETE FROM reviews WHERE app_id IS NULL;
DELETE FROM featured_app_sightings WHERE app_id IS NULL;
DELETE FROM similar_app_sightings WHERE app_id IS NULL OR similar_app_id IS NULL;
DELETE FROM app_similarity_scores WHERE app_id_a IS NULL OR app_id_b IS NULL;
DELETE FROM app_review_metrics WHERE app_id IS NULL;
DELETE FROM app_power_scores WHERE app_id IS NULL;
DELETE FROM app_visibility_scores WHERE tracked_app_id IS NULL OR app_id IS NULL;
DELETE FROM account_tracked_apps WHERE app_id IS NULL;
DELETE FROM account_tracked_keywords WHERE tracked_app_id IS NULL;
DELETE FROM account_competitor_apps WHERE tracked_app_id IS NULL OR competitor_app_id IS NULL;
DELETE FROM research_project_competitors WHERE app_id IS NULL;
DELETE FROM category_snapshots WHERE category_id IS NULL;
DELETE FROM category_ad_sightings WHERE category_id IS NULL;
DELETE FROM account_starred_categories WHERE category_id IS NULL;
