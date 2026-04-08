-- Waitlist for non-authenticated users to sign up with their email
CREATE TABLE IF NOT EXISTS "waitlist" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL,
  "ip_address" varchar(45),
  "user_agent" varchar(512),
  "referrer" varchar(512),
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_waitlist_email" ON "waitlist" ("email");
CREATE INDEX IF NOT EXISTS "idx_waitlist_created_at" ON "waitlist" ("created_at");
