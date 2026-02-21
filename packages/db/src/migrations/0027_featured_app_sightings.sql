-- Add featured_apps to scraper_type enum
ALTER TYPE scraper_type ADD VALUE IF NOT EXISTS 'featured_apps';

-- Create featured_app_sightings table
CREATE TABLE IF NOT EXISTS "featured_app_sightings" (
  "id" serial PRIMARY KEY,
  "app_slug" varchar(255) NOT NULL REFERENCES "apps"("slug"),
  "surface" varchar(50) NOT NULL,
  "surface_detail" varchar(255) NOT NULL,
  "section_handle" varchar(255) NOT NULL,
  "section_title" varchar(500),
  "position" smallint,
  "seen_date" date NOT NULL,
  "first_seen_run_id" uuid NOT NULL REFERENCES "scrape_runs"("id"),
  "last_seen_run_id" uuid NOT NULL REFERENCES "scrape_runs"("id"),
  "times_seen_in_day" smallint NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_featured_surface_date" ON "featured_app_sightings" ("surface", "surface_detail", "seen_date");
CREATE INDEX IF NOT EXISTS "idx_featured_app_date" ON "featured_app_sightings" ("app_slug", "seen_date");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_featured_unique" ON "featured_app_sightings" ("app_slug", "section_handle", "surface_detail", "seen_date");
