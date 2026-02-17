ALTER TABLE "users" ADD COLUMN "email_digest_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" varchar(100) DEFAULT 'Europe/Istanbul' NOT NULL;