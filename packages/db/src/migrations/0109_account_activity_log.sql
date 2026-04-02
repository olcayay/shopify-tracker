CREATE TABLE IF NOT EXISTS "account_activity_log" (
  "id" serial PRIMARY KEY,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action" varchar(50) NOT NULL,
  "entity_type" varchar(30),
  "entity_id" varchar(255),
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_activity_log_account" ON "account_activity_log" ("account_id", "created_at" DESC);
