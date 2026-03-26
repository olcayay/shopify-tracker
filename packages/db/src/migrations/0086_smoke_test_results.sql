CREATE TABLE IF NOT EXISTS "smoke_test_results" (
  "id" serial PRIMARY KEY,
  "platform" varchar(50) NOT NULL,
  "check_name" varchar(50) NOT NULL,
  "status" varchar(10) NOT NULL,
  "duration_ms" integer,
  "error" text,
  "output" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_smoke_test_results_platform_check_created"
  ON "smoke_test_results" ("platform", "check_name", "created_at" DESC);
