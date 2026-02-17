-- Rename columns on app_snapshots to match Shopify terminology
ALTER TABLE "app_snapshots" RENAME COLUMN "title" TO "app_introduction";
ALTER TABLE "app_snapshots" RENAME COLUMN "description" TO "seo_meta_description";
ALTER TABLE "app_snapshots" RENAME COLUMN "works_with" TO "integrations";
ALTER TABLE "app_snapshots" RENAME COLUMN "pricing_tiers" TO "pricing_plans";

-- New columns on app_snapshots
ALTER TABLE "app_snapshots" ADD COLUMN "app_details" text NOT NULL DEFAULT '';
ALTER TABLE "app_snapshots" ADD COLUMN "seo_title" varchar(500) NOT NULL DEFAULT '';
ALTER TABLE "app_snapshots" ADD COLUMN "features" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "app_snapshots" ADD COLUMN "support" jsonb;

-- New columns on apps
ALTER TABLE "apps" ADD COLUMN "icon_url" varchar(1000);
ALTER TABLE "apps" ADD COLUMN "app_card_subtitle" varchar(500);
