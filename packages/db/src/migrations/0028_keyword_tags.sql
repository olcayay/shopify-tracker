-- Keyword tags (account-scoped tag definitions)
CREATE TABLE IF NOT EXISTS "keyword_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "name" varchar(50) NOT NULL,
  "color" varchar(20) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_keyword_tags_account_name"
  ON "keyword_tags" ("account_id", lower("name"));

-- Keyword-to-tag assignments
CREATE TABLE IF NOT EXISTS "keyword_tag_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tag_id" uuid NOT NULL REFERENCES "keyword_tags"("id") ON DELETE CASCADE,
  "keyword_id" integer NOT NULL REFERENCES "tracked_keywords"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_keyword_tag_assignments_unique"
  ON "keyword_tag_assignments" ("tag_id", "keyword_id");
CREATE INDEX IF NOT EXISTS "idx_keyword_tag_assignments_keyword"
  ON "keyword_tag_assignments" ("keyword_id");
