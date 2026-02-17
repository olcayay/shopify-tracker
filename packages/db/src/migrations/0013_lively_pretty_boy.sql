ALTER TABLE "apps" ADD COLUMN "is_built_for_shopify" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "company" varchar(255);