ALTER TABLE "ai_logs" ADD COLUMN IF NOT EXISTS "trigger_type" varchar(20) NOT NULL DEFAULT 'manual';
