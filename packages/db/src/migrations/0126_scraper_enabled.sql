ALTER TABLE "platform_visibility" ADD COLUMN IF NOT EXISTS "scraper_enabled" boolean NOT NULL DEFAULT true;
