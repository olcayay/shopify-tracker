-- Notification infrastructure tables

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  body TEXT,
  url VARCHAR(1000),
  icon VARCHAR(500),
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  event_data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  push_sent BOOLEAN NOT NULL DEFAULT false,
  push_sent_at TIMESTAMP,
  push_clicked BOOLEAN NOT NULL DEFAULT false,
  push_clicked_at TIMESTAMP,
  push_dismissed BOOLEAN NOT NULL DEFAULT false,
  push_error TEXT,
  trigger_job_id VARCHAR(255),
  batch_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (type);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications (category);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at);

-- breakpoint

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent VARCHAR(500),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_push_at TIMESTAMP,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions (user_id);

-- breakpoint

CREATE TABLE IF NOT EXISTS notification_type_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type VARCHAR(100) NOT NULL,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  push_default_enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_type_configs_unique ON notification_type_configs (notification_type);

-- breakpoint

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(100) NOT NULL,
  in_app_enabled BOOLEAN,
  push_enabled BOOLEAN,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notification_prefs_unique ON user_notification_preferences (user_id, notification_type);

-- breakpoint

CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL,
  push_subscription_id UUID,
  status VARCHAR(50) NOT NULL,
  status_code INTEGER,
  error_message TEXT,
  sent_at TIMESTAMP NOT NULL DEFAULT now(),
  interacted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_log_notification ON notification_delivery_log (notification_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_sent ON notification_delivery_log (sent_at);

-- breakpoint

-- Add push_notifications_enabled to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN NOT NULL DEFAULT false;

-- Seed default notification type configs
INSERT INTO notification_type_configs (notification_type, in_app_enabled, push_default_enabled) VALUES
  ('ranking_top3_entry', true, true),
  ('ranking_top3_exit', true, true),
  ('ranking_significant_change', true, false),
  ('ranking_new_entry', true, false),
  ('ranking_dropped_out', true, false),
  ('ranking_category_change', true, false),
  ('competitor_overtook', true, true),
  ('competitor_featured', true, false),
  ('competitor_review_surge', true, false),
  ('competitor_pricing_change', true, true),
  ('review_new_positive', true, false),
  ('review_new_negative', true, true),
  ('review_velocity_spike', true, false),
  ('keyword_position_gained', true, false),
  ('keyword_position_lost', true, false),
  ('keyword_new_ranking', true, false),
  ('featured_new_placement', true, false),
  ('featured_removed', true, false),
  ('system_scrape_complete', true, false),
  ('system_scrape_failed', true, true),
  ('account_member_joined', true, false),
  ('account_limit_warning', true, true),
  ('account_limit_reached', true, true)
ON CONFLICT (notification_type) DO NOTHING;
