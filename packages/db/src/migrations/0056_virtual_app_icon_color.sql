ALTER TABLE "research_virtual_apps" ADD COLUMN IF NOT EXISTS "icon" varchar(10) NOT NULL DEFAULT '🚀';
ALTER TABLE "research_virtual_apps" ADD COLUMN IF NOT EXISTS "color" varchar(7) NOT NULL DEFAULT '#3B82F6';
