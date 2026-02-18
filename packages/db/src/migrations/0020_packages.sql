-- Packages table
CREATE TABLE IF NOT EXISTS "packages" (
  "id" serial PRIMARY KEY,
  "slug" varchar(50) NOT NULL UNIQUE,
  "name" varchar(100) NOT NULL,
  "max_tracked_apps" integer NOT NULL DEFAULT 5,
  "max_tracked_keywords" integer NOT NULL DEFAULT 5,
  "max_competitor_apps" integer NOT NULL DEFAULT 3,
  "max_tracked_features" integer NOT NULL DEFAULT 5,
  "max_users" integer NOT NULL DEFAULT 2,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Seed default packages
INSERT INTO "packages" ("slug", "name", "max_tracked_apps", "max_tracked_keywords", "max_competitor_apps", "max_tracked_features", "max_users", "sort_order")
VALUES
  ('free',       'Free',       3,   3,   2,   3,   1,  0),
  ('starter',    'Starter',   10,  10,   5,  10,   3,  1),
  ('pro',        'Pro',       30,  30,  15,  30,  10,  2),
  ('enterprise', 'Enterprise', 100, 100, 50, 100, 50,  3)
ON CONFLICT ("slug") DO NOTHING;

-- Add package_id to accounts
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "package_id" integer REFERENCES "packages"("id");

-- Set existing accounts to 'starter' (id=2) since they already have starter-like limits
UPDATE "accounts" SET "package_id" = (SELECT id FROM "packages" WHERE slug = 'starter') WHERE "package_id" IS NULL;
