CREATE TABLE IF NOT EXISTS "research_virtual_apps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "research_project_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL DEFAULT 'My App',
  "icon_url" text,
  "app_card_subtitle" text NOT NULL DEFAULT '',
  "app_introduction" text NOT NULL DEFAULT '',
  "app_details" text NOT NULL DEFAULT '',
  "seo_title" text NOT NULL DEFAULT '',
  "seo_meta_description" text NOT NULL DEFAULT '',
  "features" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "integrations" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "languages" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "categories" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "pricing_plans" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_research_virtual_apps_project"
  ON "research_virtual_apps" ("research_project_id");

DO $$ BEGIN
  ALTER TABLE "research_virtual_apps"
    ADD CONSTRAINT "research_virtual_apps_research_project_id_research_projects_id_fk"
    FOREIGN KEY ("research_project_id") REFERENCES "public"."research_projects"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
