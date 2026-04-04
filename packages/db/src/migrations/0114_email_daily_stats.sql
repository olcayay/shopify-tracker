-- Daily aggregated email statistics for analytics dashboard
CREATE TABLE IF NOT EXISTS "email_daily_stats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" timestamp NOT NULL,
  "email_type" varchar(100) NOT NULL,
  "sent" integer NOT NULL DEFAULT 0,
  "delivered" integer NOT NULL DEFAULT 0,
  "opened" integer NOT NULL DEFAULT 0,
  "clicked" integer NOT NULL DEFAULT 0,
  "bounced" integer NOT NULL DEFAULT 0,
  "complained" integer NOT NULL DEFAULT 0,
  "unsubscribed" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_email_daily_stats_date_type" ON "email_daily_stats" ("date", "email_type");
CREATE INDEX IF NOT EXISTS "idx_email_daily_stats_date" ON "email_daily_stats" ("date");
