CREATE TABLE IF NOT EXISTS "similar_app_sightings" (
  "id" serial PRIMARY KEY NOT NULL,
  "app_slug" varchar(255) NOT NULL,
  "similar_app_slug" varchar(255) NOT NULL,
  "position" smallint,
  "seen_date" date NOT NULL,
  "first_seen_run_id" uuid NOT NULL,
  "last_seen_run_id" uuid NOT NULL,
  "times_seen_in_day" smallint DEFAULT 1 NOT NULL
);

ALTER TABLE "similar_app_sightings" ADD CONSTRAINT "similar_app_sightings_app_slug_apps_slug_fk" FOREIGN KEY ("app_slug") REFERENCES "public"."apps"("slug") ON DELETE no action ON UPDATE no action;
ALTER TABLE "similar_app_sightings" ADD CONSTRAINT "similar_app_sightings_similar_app_slug_apps_slug_fk" FOREIGN KEY ("similar_app_slug") REFERENCES "public"."apps"("slug") ON DELETE no action ON UPDATE no action;
ALTER TABLE "similar_app_sightings" ADD CONSTRAINT "similar_app_sightings_first_seen_run_id_scrape_runs_id_fk" FOREIGN KEY ("first_seen_run_id") REFERENCES "public"."scrape_runs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "similar_app_sightings" ADD CONSTRAINT "similar_app_sightings_last_seen_run_id_scrape_runs_id_fk" FOREIGN KEY ("last_seen_run_id") REFERENCES "public"."scrape_runs"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "idx_similar_sightings_app_date" ON "similar_app_sightings" USING btree ("app_slug", "seen_date");
CREATE INDEX "idx_similar_sightings_similar_date" ON "similar_app_sightings" USING btree ("similar_app_slug", "seen_date");
CREATE UNIQUE INDEX "idx_similar_sightings_unique" ON "similar_app_sightings" USING btree ("app_slug", "similar_app_slug", "seen_date");
