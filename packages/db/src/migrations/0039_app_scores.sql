-- =============================================
-- 0039_app_scores.sql
-- Adds compute_app_scores scraper type and
-- app_visibility_scores / app_power_scores tables
-- =============================================

-- 1. Extend scraper_type enum
ALTER TYPE "scraper_type" ADD VALUE IF NOT EXISTS 'compute_app_scores';

-- 2. App Visibility Scores (historical, daily per app per category)
CREATE TABLE IF NOT EXISTS "app_visibility_scores" (
  "id" serial PRIMARY KEY NOT NULL,
  "app_slug" varchar(255) NOT NULL,
  "category_slug" varchar(255) NOT NULL,
  "computed_at" date NOT NULL,
  "scrape_run_id" uuid NOT NULL,
  "keyword_count" smallint NOT NULL,
  "visibility_raw" decimal(12, 4) NOT NULL,
  "visibility_score" smallint NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "app_visibility_scores"
    ADD CONSTRAINT "app_visibility_scores_app_slug_apps_slug_fk"
    FOREIGN KEY ("app_slug") REFERENCES "public"."apps"("slug")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "app_visibility_scores"
    ADD CONSTRAINT "app_visibility_scores_scrape_run_id_scrape_runs_id_fk"
    FOREIGN KEY ("scrape_run_id") REFERENCES "public"."scrape_runs"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_visibility_unique"
  ON "app_visibility_scores" USING btree ("app_slug", "category_slug", "computed_at");
CREATE INDEX IF NOT EXISTS "idx_app_visibility_app_date"
  ON "app_visibility_scores" USING btree ("app_slug", "computed_at");
CREATE INDEX IF NOT EXISTS "idx_app_visibility_cat_date_score"
  ON "app_visibility_scores" USING btree ("category_slug", "computed_at", "visibility_score");

-- 3. App Power Scores (historical, daily per app per category)
CREATE TABLE IF NOT EXISTS "app_power_scores" (
  "id" serial PRIMARY KEY NOT NULL,
  "app_slug" varchar(255) NOT NULL,
  "category_slug" varchar(255) NOT NULL,
  "computed_at" date NOT NULL,
  "scrape_run_id" uuid NOT NULL,
  "rating_score" decimal(5, 4) NOT NULL,
  "review_score" decimal(5, 4) NOT NULL,
  "category_score" decimal(5, 4) NOT NULL,
  "momentum_score" decimal(5, 4) NOT NULL,
  "power_raw" decimal(8, 4) NOT NULL,
  "power_score" smallint NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "app_power_scores"
    ADD CONSTRAINT "app_power_scores_app_slug_apps_slug_fk"
    FOREIGN KEY ("app_slug") REFERENCES "public"."apps"("slug")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "app_power_scores"
    ADD CONSTRAINT "app_power_scores_scrape_run_id_scrape_runs_id_fk"
    FOREIGN KEY ("scrape_run_id") REFERENCES "public"."scrape_runs"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_power_unique"
  ON "app_power_scores" USING btree ("app_slug", "category_slug", "computed_at");
CREATE INDEX IF NOT EXISTS "idx_app_power_app_date"
  ON "app_power_scores" USING btree ("app_slug", "computed_at");
CREATE INDEX IF NOT EXISTS "idx_app_power_cat_date_score"
  ON "app_power_scores" USING btree ("category_slug", "computed_at", "power_score");
