-- Seed emailTypeConfigs for alert email types with frequency limits.
-- All disabled by default — must be explicitly enabled per-account or globally.
INSERT INTO email_type_configs (email_type, enabled, frequency_limit_hours)
VALUES
  ('email_ranking_alert', false, 24),
  ('email_competitor_alert', false, 24),
  ('email_review_alert', false, 24),
  ('email_win_celebration', false, 24)
ON CONFLICT (email_type) DO NOTHING;
