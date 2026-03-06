-- Phase 1 Step 1: Add app_id / category_id integer columns (nullable) to all child tables.
-- These will be populated in the next migration, then made NOT NULL.

-- Tables referencing apps.slug → add app_id
ALTER TABLE app_snapshots ADD COLUMN app_id integer;
ALTER TABLE app_field_changes ADD COLUMN app_id integer;
ALTER TABLE app_category_rankings ADD COLUMN app_id integer;
ALTER TABLE app_keyword_rankings ADD COLUMN app_id integer;
ALTER TABLE keyword_ad_sightings ADD COLUMN app_id integer;
ALTER TABLE category_ad_sightings ADD COLUMN app_id integer;
ALTER TABLE reviews ADD COLUMN app_id integer;
ALTER TABLE featured_app_sightings ADD COLUMN app_id integer;
ALTER TABLE similar_app_sightings ADD COLUMN app_id integer;
ALTER TABLE similar_app_sightings ADD COLUMN similar_app_id integer;
ALTER TABLE app_similarity_scores ADD COLUMN app_id_a integer;
ALTER TABLE app_similarity_scores ADD COLUMN app_id_b integer;
ALTER TABLE app_review_metrics ADD COLUMN app_id integer;
ALTER TABLE app_power_scores ADD COLUMN app_id integer;
ALTER TABLE app_visibility_scores ADD COLUMN tracked_app_id integer;
ALTER TABLE app_visibility_scores ADD COLUMN app_id integer;
ALTER TABLE account_tracked_apps ADD COLUMN app_id integer;
ALTER TABLE account_tracked_keywords ADD COLUMN tracked_app_id integer;
ALTER TABLE account_competitor_apps ADD COLUMN tracked_app_id integer;
ALTER TABLE account_competitor_apps ADD COLUMN competitor_app_id integer;
ALTER TABLE research_project_competitors ADD COLUMN app_id integer;

-- Tables referencing categories.slug → add category_id
ALTER TABLE category_snapshots ADD COLUMN category_id integer;
ALTER TABLE category_ad_sightings ADD COLUMN category_id integer;
ALTER TABLE account_starred_categories ADD COLUMN category_id integer;
