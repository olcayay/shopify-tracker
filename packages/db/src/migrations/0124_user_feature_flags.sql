-- User-level feature flag overrides (takes precedence over account-level)
CREATE TABLE IF NOT EXISTS "user_feature_flags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "feature_flag_id" uuid NOT NULL REFERENCES "feature_flags"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT true,
  "enabled_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_feature_flags_unique" ON "user_feature_flags" ("user_id", "feature_flag_id");
CREATE INDEX IF NOT EXISTS "idx_user_feature_flags_user" ON "user_feature_flags" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_feature_flags_flag" ON "user_feature_flags" ("feature_flag_id");
