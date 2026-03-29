-- Email system infrastructure tables

CREATE TABLE IF NOT EXISTS email_type_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  frequency_limit_hours INTEGER,
  config JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_type_configs_unique ON email_type_configs (email_type);

-- breakpoint

CREATE TABLE IF NOT EXISTS email_type_account_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email_type VARCHAR(100) NOT NULL,
  enabled BOOLEAN,
  config JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_type_account_overrides_unique ON email_type_account_overrides (account_id, email_type);

-- breakpoint

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  recipient_email VARCHAR(500) NOT NULL,
  recipient_name VARCHAR(500),
  subject VARCHAR(1000) NOT NULL,
  html_body TEXT,
  data_snapshot JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  bounced_at TIMESTAMP,
  error_message TEXT,
  campaign_id UUID,
  message_id VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs (email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_account ON email_logs (account_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs (status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs (created_at);

-- breakpoint

CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  total_prospects INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  open_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  config JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- breakpoint

CREATE TABLE IF NOT EXISTS email_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  email VARCHAR(500) NOT NULL,
  name VARCHAR(500),
  app_slug VARCHAR(500),
  platform VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  last_contacted_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_prospects_status ON email_prospects (status);
CREATE INDEX IF NOT EXISTS idx_email_prospects_campaign ON email_prospects (campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_prospects_email ON email_prospects (email);

-- breakpoint

CREATE TABLE IF NOT EXISTS user_email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email_prefs_unique ON user_email_preferences (user_id, email_type);

-- breakpoint

CREATE TABLE IF NOT EXISTS email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type VARCHAR(100),
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_unsubscribe_token ON email_unsubscribe_tokens (token);

-- breakpoint

-- Seed default email type configs
INSERT INTO email_type_configs (email_type, enabled, frequency_limit_hours) VALUES
  ('daily_digest', true, 24),
  ('weekly_summary', true, 168),
  ('ranking_alert', true, 1),
  ('competitor_alert', true, 1),
  ('review_alert', true, 1),
  ('opportunity_alert', true, 168),
  ('win_celebration', true, 24),
  ('re_engagement', true, 336),
  ('welcome', true, NULL),
  ('onboarding_day2', true, NULL),
  ('onboarding_day7', true, NULL),
  ('cold_first_contact', true, NULL),
  ('cold_follow_up', true, NULL),
  ('cold_competitive_alert', true, NULL),
  ('security_password_change', true, NULL)
ON CONFLICT (email_type) DO NOTHING;
