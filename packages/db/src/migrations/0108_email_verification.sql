ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;

CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" varchar(255) NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_email_verification_tokens_user" ON "email_verification_tokens" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_email_verification_tokens_hash" ON "email_verification_tokens" ("token_hash");
