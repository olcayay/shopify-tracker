-- Add keyword_suggestions to scraper_type enum
ALTER TYPE "scraper_type" ADD VALUE IF NOT EXISTS 'keyword_suggestions';

-- Create keyword_auto_suggestions table
CREATE TABLE IF NOT EXISTS "keyword_auto_suggestions" (
  "id" serial PRIMARY KEY NOT NULL,
  "keyword_id" integer NOT NULL REFERENCES "tracked_keywords"("id"),
  "suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "scraped_at" timestamp DEFAULT now() NOT NULL,
  "scrape_run_id" uuid REFERENCES "scrape_runs"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_kw_auto_suggestions_kw" ON "keyword_auto_suggestions" USING btree ("keyword_id");
