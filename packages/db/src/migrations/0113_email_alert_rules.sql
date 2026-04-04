-- Configurable alert rules for email system monitoring
CREATE TABLE IF NOT EXISTS "email_alert_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "rule_name" varchar(255) NOT NULL,
  "metric" varchar(100) NOT NULL,
  "operator" varchar(10) NOT NULL DEFAULT '>',
  "threshold" integer NOT NULL,
  "cooldown_minutes" integer NOT NULL DEFAULT 60,
  "enabled" boolean NOT NULL DEFAULT true,
  "channels" jsonb NOT NULL DEFAULT '["email","notification"]',
  "webhook_url" varchar(1000),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_email_alert_rules_name" ON "email_alert_rules" ("rule_name");

-- Alert history log
CREATE TABLE IF NOT EXISTS "email_alerts_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "rule_id" uuid REFERENCES "email_alert_rules"("id") ON DELETE SET NULL,
  "rule_name" varchar(255) NOT NULL,
  "metric" varchar(100) NOT NULL,
  "current_value" integer NOT NULL,
  "threshold" integer NOT NULL,
  "message" text,
  "channels" jsonb,
  "delivered_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_email_alerts_log_rule" ON "email_alerts_log" ("rule_id");
CREATE INDEX IF NOT EXISTS "idx_email_alerts_log_created" ON "email_alerts_log" ("created_at");

-- Seed default alert rules
INSERT INTO "email_alert_rules" ("rule_name", "metric", "operator", "threshold", "cooldown_minutes", "channels")
VALUES
  ('Instant Queue Depth High', 'instant_queue_depth', '>', 50, 30, '["email","notification"]'),
  ('Bulk Queue Depth High', 'bulk_queue_depth', '>', 200, 60, '["email","notification"]'),
  ('Instant Error Rate High', 'error_rate_1h', '>', 10, 60, '["email","notification"]'),
  ('Bounce Rate High', 'bounce_rate_24h', '>', 5, 360, '["email","notification"]'),
  ('DLQ Depth High', 'dlq_depth', '>', 10, 120, '["email","notification"]')
ON CONFLICT DO NOTHING;
