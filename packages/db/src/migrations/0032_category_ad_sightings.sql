CREATE TABLE IF NOT EXISTS "category_ad_sightings" (
  "id" serial PRIMARY KEY NOT NULL,
  "app_slug" varchar(255) NOT NULL,
  "category_slug" varchar(255) NOT NULL,
  "seen_date" date NOT NULL,
  "first_seen_run_id" uuid NOT NULL,
  "last_seen_run_id" uuid NOT NULL,
  "times_seen_in_day" smallint DEFAULT 1 NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "category_ad_sightings" ADD CONSTRAINT "category_ad_sightings_app_slug_apps_slug_fk" FOREIGN KEY ("app_slug") REFERENCES "public"."apps"("slug") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "category_ad_sightings" ADD CONSTRAINT "category_ad_sightings_category_slug_categories_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."categories"("slug") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "category_ad_sightings" ADD CONSTRAINT "category_ad_sightings_first_seen_run_id_scrape_runs_id_fk" FOREIGN KEY ("first_seen_run_id") REFERENCES "public"."scrape_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "category_ad_sightings" ADD CONSTRAINT "category_ad_sightings_last_seen_run_id_scrape_runs_id_fk" FOREIGN KEY ("last_seen_run_id") REFERENCES "public"."scrape_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "idx_cat_ad_sightings_cat_date" ON "category_ad_sightings" USING btree ("category_slug", "seen_date");
CREATE INDEX IF NOT EXISTS "idx_cat_ad_sightings_app_date" ON "category_ad_sightings" USING btree ("app_slug", "seen_date");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_cat_ad_sightings_unique" ON "category_ad_sightings" USING btree ("app_slug", "category_slug", "seen_date");
