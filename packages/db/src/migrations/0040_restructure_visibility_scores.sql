-- =============================================
-- 0040_restructure_visibility_scores.sql
-- Restructures app_visibility_scores:
--   - Removes category_slug (visibility is now per tracked-app context, not per category)
--   - Adds account_id + tracked_app_slug (account-scoped visibility)
-- No production data yet (0039 just created the table).
-- =============================================

-- 1. Drop existing table (no production data)
DROP TABLE IF EXISTS "app_visibility_scores";

-- 2. Recreate with new schema
CREATE TABLE "app_visibility_scores" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" uuid NOT NULL,
  "tracked_app_slug" varchar(255) NOT NULL,
  "app_slug" varchar(255) NOT NULL,
  "computed_at" date NOT NULL,
  "scrape_run_id" uuid NOT NULL,
  "keyword_count" smallint NOT NULL,
  "visibility_raw" decimal(12, 4) NOT NULL,
  "visibility_score" smallint NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 3. Foreign keys
DO $$ BEGIN
  ALTER TABLE "app_visibility_scores"
    ADD CONSTRAINT "app_visibility_scores_account_id_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id")
    ON DELETE CASCADE ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "app_visibility_scores"
    ADD CONSTRAINT "app_visibility_scores_tracked_app_slug_apps_slug_fk"
    FOREIGN KEY ("tracked_app_slug") REFERENCES "public"."apps"("slug")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

-- 4. Indexes
CREATE UNIQUE INDEX "idx_app_visibility_unique"
  ON "app_visibility_scores" USING btree ("account_id", "tracked_app_slug", "app_slug", "computed_at");
CREATE INDEX "idx_app_visibility_app_date"
  ON "app_visibility_scores" USING btree ("app_slug", "computed_at");
CREATE INDEX "idx_app_visibility_account_tracked"
  ON "app_visibility_scores" USING btree ("account_id", "tracked_app_slug", "computed_at");
