CREATE INDEX "idx_apps_is_tracked" ON "apps" USING btree ("is_tracked");--> statement-breakpoint
CREATE INDEX "idx_reviews_app_date" ON "reviews" USING btree ("app_slug","review_date");--> statement-breakpoint
CREATE INDEX "idx_scrape_runs_type_started" ON "scrape_runs" USING btree ("scraper_type","started_at");--> statement-breakpoint
CREATE INDEX "idx_scrape_runs_status" ON "scrape_runs" USING btree ("status");