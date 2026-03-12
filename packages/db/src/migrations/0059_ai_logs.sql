CREATE TABLE IF NOT EXISTS "ai_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "platform" varchar(20) NOT NULL,
  "product_type" varchar(30) NOT NULL,
  "product_id" uuid,
  "model" varchar(50) NOT NULL,
  "system_prompt" text NOT NULL,
  "user_prompt" text NOT NULL,
  "response_content" text,
  "prompt_tokens" integer NOT NULL DEFAULT 0,
  "completion_tokens" integer NOT NULL DEFAULT 0,
  "total_tokens" integer NOT NULL DEFAULT 0,
  "cost_usd" numeric(10, 6),
  "duration_ms" integer NOT NULL,
  "status" varchar(20) NOT NULL,
  "error_message" text,
  "tags" jsonb NOT NULL DEFAULT '[]',
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_ai_logs_account" ON "ai_logs" ("account_id");
CREATE INDEX IF NOT EXISTS "idx_ai_logs_user" ON "ai_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_ai_logs_created" ON "ai_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_ai_logs_product_type" ON "ai_logs" ("product_type");
