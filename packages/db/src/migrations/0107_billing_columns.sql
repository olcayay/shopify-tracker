ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar(255);
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" varchar(255);
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "subscription_status" varchar(30) DEFAULT 'free';
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "subscription_plan" varchar(50);
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "subscription_period_end" timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_accounts_stripe_customer" ON "accounts" ("stripe_customer_id") WHERE "stripe_customer_id" IS NOT NULL;
