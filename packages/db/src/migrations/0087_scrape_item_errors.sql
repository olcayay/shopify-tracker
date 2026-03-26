CREATE TABLE IF NOT EXISTS "scrape_item_errors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "scrape_run_id" uuid NOT NULL REFERENCES "scrape_runs"("id"),
  "item_identifier" varchar(255) NOT NULL,
  "item_type" varchar(50) NOT NULL,
  "url" varchar(1024),
  "error_message" varchar(2048) NOT NULL,
  "stack_trace" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "idx_scrape_item_errors_run_id" ON "scrape_item_errors" ("scrape_run_id");
CREATE INDEX "idx_scrape_item_errors_identifier" ON "scrape_item_errors" ("item_identifier");
