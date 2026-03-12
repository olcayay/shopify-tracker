ALTER TABLE "ai_logs" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE "ai_logs" ADD COLUMN IF NOT EXISTS "ip_address" varchar(45);
ALTER TABLE "ai_logs" ADD COLUMN IF NOT EXISTS "user_agent" varchar(512);
