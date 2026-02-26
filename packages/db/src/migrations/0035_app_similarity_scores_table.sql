CREATE TABLE IF NOT EXISTS "app_similarity_scores" (
  "id" serial PRIMARY KEY NOT NULL,
  "app_slug_a" varchar(255) NOT NULL,
  "app_slug_b" varchar(255) NOT NULL,
  "overall_score" decimal(5, 4) NOT NULL,
  "category_score" decimal(5, 4) NOT NULL,
  "feature_score" decimal(5, 4) NOT NULL,
  "keyword_score" decimal(5, 4) NOT NULL,
  "text_score" decimal(5, 4) NOT NULL,
  "computed_at" date NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "app_similarity_scores" ADD CONSTRAINT "app_similarity_scores_app_slug_a_apps_slug_fk" FOREIGN KEY ("app_slug_a") REFERENCES "public"."apps"("slug") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "app_similarity_scores" ADD CONSTRAINT "app_similarity_scores_app_slug_b_apps_slug_fk" FOREIGN KEY ("app_slug_b") REFERENCES "public"."apps"("slug") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_similarity_scores_unique" ON "app_similarity_scores" USING btree ("app_slug_a", "app_slug_b");
CREATE INDEX IF NOT EXISTS "idx_app_similarity_scores_a" ON "app_similarity_scores" USING btree ("app_slug_a");
CREATE INDEX IF NOT EXISTS "idx_app_similarity_scores_b" ON "app_similarity_scores" USING btree ("app_slug_b");
