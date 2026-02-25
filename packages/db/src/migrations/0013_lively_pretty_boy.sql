ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "is_built_for_shopify" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "company" varchar(255);