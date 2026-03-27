-- Global developers: cross-platform developer profiles
CREATE TABLE IF NOT EXISTS "global_developers" (
  "id" serial PRIMARY KEY,
  "slug" varchar(255) NOT NULL,
  "name" text NOT NULL,
  "website" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_global_developers_slug"
  ON "global_developers" ("slug");

-- Platform developers: per-platform developer names linked to global profiles
CREATE TABLE IF NOT EXISTS "platform_developers" (
  "id" serial PRIMARY KEY,
  "platform" varchar(20) NOT NULL,
  "name" text NOT NULL,
  "global_developer_id" integer NOT NULL
    REFERENCES "global_developers"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_platform_developers_platform_name"
  ON "platform_developers" ("platform", "name");

CREATE INDEX IF NOT EXISTS "idx_platform_developers_global_id"
  ON "platform_developers" ("global_developer_id");
