ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "user_agent_hash" varchar(64);
