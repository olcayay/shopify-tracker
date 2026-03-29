CREATE TABLE IF NOT EXISTS "account_starred_developers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "global_developer_id" integer NOT NULL REFERENCES "global_developers"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_account_starred_developers_unique"
  ON "account_starred_developers" ("account_id", "global_developer_id");
