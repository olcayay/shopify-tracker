-- Email suppression list for bounce/complaint management
CREATE TABLE IF NOT EXISTS "email_suppression_list" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(500) NOT NULL,
  "reason" varchar(50) NOT NULL,
  "source" varchar(50) NOT NULL,
  "bounce_count" integer NOT NULL DEFAULT 1,
  "last_bounce_at" timestamp NOT NULL DEFAULT now(),
  "diagnostic_code" text,
  "removed_at" timestamp,
  "removed_by" varchar(255),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_email_suppression_email" ON "email_suppression_list" ("email");
CREATE INDEX IF NOT EXISTS "idx_email_suppression_reason" ON "email_suppression_list" ("reason");

-- Daily email health metrics for bounce rate monitoring
CREATE TABLE IF NOT EXISTS "email_health_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" timestamp NOT NULL,
  "sent" integer NOT NULL DEFAULT 0,
  "delivered" integer NOT NULL DEFAULT 0,
  "bounced" integer NOT NULL DEFAULT 0,
  "complained" integer NOT NULL DEFAULT 0,
  "bounce_rate" varchar(10),
  "complaint_rate" varchar(10),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_email_health_metrics_date" ON "email_health_metrics" ("date");
