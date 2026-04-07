-- Per-user, per-app email digest preferences (opt-out model)

CREATE TABLE IF NOT EXISTS "user_app_email_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "app_id" integer NOT NULL REFERENCES "apps"("id") ON DELETE CASCADE,
  "daily_digest_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_app_email_prefs_unique" ON "user_app_email_preferences" ("user_id", "app_id");
