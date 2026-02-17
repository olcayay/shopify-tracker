CREATE TABLE "app_field_changes" (
  "id" serial PRIMARY KEY,
  "app_slug" varchar(255) NOT NULL REFERENCES "apps"("slug"),
  "field" varchar(50) NOT NULL,
  "old_value" text,
  "new_value" text,
  "detected_at" timestamp NOT NULL DEFAULT NOW(),
  "scrape_run_id" uuid NOT NULL REFERENCES "scrape_runs"("id")
);
--> statement-breakpoint
CREATE INDEX "idx_app_field_changes_slug" ON "app_field_changes" ("app_slug", "detected_at" DESC);
