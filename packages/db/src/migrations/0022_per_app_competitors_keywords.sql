-- Per-app competitors and keywords: add tracked_app_slug to scope
-- competitors and keywords to specific "my apps" instead of flat per-account

-- Step 1: Add tracked_app_slug columns (nullable first for data migration)
ALTER TABLE "account_competitor_apps"
  ADD COLUMN IF NOT EXISTS "tracked_app_slug" varchar(255) REFERENCES "apps"("slug");

ALTER TABLE "account_tracked_keywords"
  ADD COLUMN IF NOT EXISTS "tracked_app_slug" varchar(255) REFERENCES "apps"("slug");

-- Step 2: Assign existing rows to account's first tracked app (by created_at)
UPDATE "account_competitor_apps" ac
SET "tracked_app_slug" = (
  SELECT "app_slug" FROM "account_tracked_apps" at
  WHERE at."account_id" = ac."account_id"
  ORDER BY at."created_at" ASC LIMIT 1
);

UPDATE "account_tracked_keywords" ak
SET "tracked_app_slug" = (
  SELECT "app_slug" FROM "account_tracked_apps" at
  WHERE at."account_id" = ak."account_id"
  ORDER BY at."created_at" ASC LIMIT 1
);

-- Step 3: Delete orphan rows (accounts with no tracked apps)
DELETE FROM "account_competitor_apps" WHERE "tracked_app_slug" IS NULL;
DELETE FROM "account_tracked_keywords" WHERE "tracked_app_slug" IS NULL;

-- Step 4: Make columns NOT NULL
ALTER TABLE "account_competitor_apps"
  ALTER COLUMN "tracked_app_slug" SET NOT NULL;

ALTER TABLE "account_tracked_keywords"
  ALTER COLUMN "tracked_app_slug" SET NOT NULL;

-- Step 5: Replace unique indexes with three-column versions
DROP INDEX IF EXISTS "idx_account_competitor_apps_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "idx_account_competitor_apps_unique"
  ON "account_competitor_apps" ("account_id", "tracked_app_slug", "app_slug");

DROP INDEX IF EXISTS "idx_account_tracked_keywords_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "idx_account_tracked_keywords_unique"
  ON "account_tracked_keywords" ("account_id", "tracked_app_slug", "keyword_id");
