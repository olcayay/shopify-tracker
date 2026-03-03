-- Research Projects: market research without a Shopify app
CREATE TABLE IF NOT EXISTS "research_projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL DEFAULT 'Untitled Research',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_research_projects_account"
  ON "research_projects" ("account_id");

DO $$ BEGIN
  ALTER TABLE "research_projects"
    ADD CONSTRAINT "research_projects_account_id_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Research Project Keywords (links to global tracked_keywords)
CREATE TABLE IF NOT EXISTS "research_project_keywords" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "research_project_id" uuid NOT NULL,
  "keyword_id" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_research_project_keywords_unique"
  ON "research_project_keywords" ("research_project_id", "keyword_id");

DO $$ BEGIN
  ALTER TABLE "research_project_keywords"
    ADD CONSTRAINT "research_project_keywords_project_id_fk"
    FOREIGN KEY ("research_project_id") REFERENCES "public"."research_projects"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "research_project_keywords"
    ADD CONSTRAINT "research_project_keywords_keyword_id_fk"
    FOREIGN KEY ("keyword_id") REFERENCES "public"."tracked_keywords"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Research Project Competitors (links to global apps by slug)
CREATE TABLE IF NOT EXISTS "research_project_competitors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "research_project_id" uuid NOT NULL,
  "app_slug" varchar(255) NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_research_project_competitors_unique"
  ON "research_project_competitors" ("research_project_id", "app_slug");

DO $$ BEGIN
  ALTER TABLE "research_project_competitors"
    ADD CONSTRAINT "research_project_competitors_project_id_fk"
    FOREIGN KEY ("research_project_id") REFERENCES "public"."research_projects"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "research_project_competitors"
    ADD CONSTRAINT "research_project_competitors_app_slug_fk"
    FOREIGN KEY ("app_slug") REFERENCES "public"."apps"("slug");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
