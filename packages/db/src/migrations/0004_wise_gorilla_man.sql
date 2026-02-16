CREATE TABLE "keyword_ad_sightings" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_slug" varchar(255) NOT NULL,
	"keyword_id" integer NOT NULL,
	"seen_date" date NOT NULL,
	"first_seen_run_id" uuid NOT NULL,
	"last_seen_run_id" uuid NOT NULL,
	"times_seen_in_day" smallint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "keyword_ad_sightings" ADD CONSTRAINT "keyword_ad_sightings_app_slug_apps_slug_fk" FOREIGN KEY ("app_slug") REFERENCES "public"."apps"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_ad_sightings" ADD CONSTRAINT "keyword_ad_sightings_keyword_id_tracked_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."tracked_keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_ad_sightings" ADD CONSTRAINT "keyword_ad_sightings_first_seen_run_id_scrape_runs_id_fk" FOREIGN KEY ("first_seen_run_id") REFERENCES "public"."scrape_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_ad_sightings" ADD CONSTRAINT "keyword_ad_sightings_last_seen_run_id_scrape_runs_id_fk" FOREIGN KEY ("last_seen_run_id") REFERENCES "public"."scrape_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_kw_ad_sightings_kw_date" ON "keyword_ad_sightings" USING btree ("keyword_id","seen_date");--> statement-breakpoint
CREATE INDEX "idx_kw_ad_sightings_app_date" ON "keyword_ad_sightings" USING btree ("app_slug","seen_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_kw_ad_sightings_unique" ON "keyword_ad_sightings" USING btree ("app_slug","keyword_id","seen_date");--> statement-breakpoint
UPDATE categories SET title = regexp_replace(title, '\s+[Aa]pps?\s*$', '', 'g') WHERE title ~ '\s+[Aa]pps?\s*$';