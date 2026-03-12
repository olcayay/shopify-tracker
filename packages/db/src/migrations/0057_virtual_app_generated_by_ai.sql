ALTER TABLE "research_virtual_apps" ADD COLUMN IF NOT EXISTS "generated_by_ai" boolean NOT NULL DEFAULT false;
