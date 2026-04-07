-- Feature flags: global definitions + per-account overrides

CREATE TABLE IF NOT EXISTS "feature_flags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" varchar(100) NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "is_enabled" boolean NOT NULL DEFAULT false,
  "activated_at" timestamp,
  "deactivated_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_feature_flags_slug" ON "feature_flags" ("slug");

CREATE TABLE IF NOT EXISTS "account_feature_flags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "feature_flag_id" uuid NOT NULL REFERENCES "feature_flags"("id") ON DELETE CASCADE,
  "enabled_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_account_feature_flags_unique" ON "account_feature_flags" ("account_id", "feature_flag_id");
CREATE INDEX IF NOT EXISTS "idx_account_feature_flags_account" ON "account_feature_flags" ("account_id");
CREATE INDEX IF NOT EXISTS "idx_account_feature_flags_flag" ON "account_feature_flags" ("feature_flag_id");

-- Seed: market-research flag (disabled by default, enabled per-account)
INSERT INTO "feature_flags" ("slug", "name", "description", "is_enabled")
VALUES ('market-research', 'Market Research', 'Access to research projects, virtual apps, and competitive analysis tools', false)
ON CONFLICT ("slug") DO NOTHING;
