ALTER TABLE "research_virtual_apps" ADD COLUMN IF NOT EXISTS "created_by" uuid;

DO $$ BEGIN
  ALTER TABLE "research_virtual_apps"
    ADD CONSTRAINT "research_virtual_apps_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
