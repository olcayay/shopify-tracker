-- Rename columns on app_snapshots to match Shopify terminology
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_snapshots' AND column_name = 'title') THEN
    ALTER TABLE "app_snapshots" RENAME COLUMN "title" TO "app_introduction";
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_snapshots' AND column_name = 'description') THEN
    ALTER TABLE "app_snapshots" RENAME COLUMN "description" TO "seo_meta_description";
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_snapshots' AND column_name = 'works_with') THEN
    ALTER TABLE "app_snapshots" RENAME COLUMN "works_with" TO "integrations";
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_snapshots' AND column_name = 'pricing_tiers') THEN
    ALTER TABLE "app_snapshots" RENAME COLUMN "pricing_tiers" TO "pricing_plans";
  END IF;
END $$;

-- New columns on app_snapshots
ALTER TABLE "app_snapshots" ADD COLUMN IF NOT EXISTS "app_details" text NOT NULL DEFAULT '';
ALTER TABLE "app_snapshots" ADD COLUMN IF NOT EXISTS "seo_title" varchar(500) NOT NULL DEFAULT '';
ALTER TABLE "app_snapshots" ADD COLUMN IF NOT EXISTS "features" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "app_snapshots" ADD COLUMN IF NOT EXISTS "support" jsonb;

-- New columns on apps
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "icon_url" varchar(1000);
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "app_card_subtitle" varchar(500);
