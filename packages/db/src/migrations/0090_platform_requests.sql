-- Platform requests: user-submitted requests for new platforms
CREATE TABLE IF NOT EXISTS "platform_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "platform_name" varchar(100) NOT NULL,
  "marketplace_url" varchar(500),
  "notes" text,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_platform_requests_account"
  ON "platform_requests" ("account_id");

CREATE INDEX IF NOT EXISTS "idx_platform_requests_status"
  ON "platform_requests" ("status");
