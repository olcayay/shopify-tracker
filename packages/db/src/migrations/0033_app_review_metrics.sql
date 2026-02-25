ALTER TYPE "scraper_type" ADD VALUE IF NOT EXISTS 'compute_review_metrics';

CREATE TABLE IF NOT EXISTS "app_review_metrics" (
  "id" serial PRIMARY KEY NOT NULL,
  "app_slug" varchar(255) NOT NULL,
  "computed_at" date NOT NULL,
  "rating_count" integer,
  "average_rating" decimal(3, 2),
  "v7d" integer,
  "v30d" integer,
  "v90d" integer,
  "acc_micro" decimal(8, 2),
  "acc_macro" decimal(8, 2),
  "momentum" varchar(20),
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "app_review_metrics" ADD CONSTRAINT "app_review_metrics_app_slug_apps_slug_fk" FOREIGN KEY ("app_slug") REFERENCES "public"."apps"("slug") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_review_metrics_unique" ON "app_review_metrics" USING btree ("app_slug", "computed_at");
CREATE INDEX IF NOT EXISTS "idx_app_review_metrics_date" ON "app_review_metrics" USING btree ("computed_at");
