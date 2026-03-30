-- PLA-444: Editable notification and email templates

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type VARCHAR(100) NOT NULL,
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  is_customized BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_templates_type
  ON notification_templates (notification_type);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type VARCHAR(100) NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  is_customized BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_type
  ON email_templates (email_type);

-- Seed notification templates with current hardcoded content
INSERT INTO notification_templates (notification_type, title_template, body_template) VALUES
  ('ranking_top3_entry', '{{appName}} entered Top 3 for "{{keyword}}"', 'Now at position {{position}} in {{categoryName}}.'),
  ('ranking_top3_exit', '{{appName}} dropped out of Top 3 for "{{keyword}}"', 'Now at position {{position}}. Was in Top 3.'),
  ('ranking_significant_change', '{{appName}} ranking changed for "{{keyword}}"', 'Position changed from {{previousPosition}} to {{position}}.'),
  ('ranking_new_entry', '{{appName}} appeared in "{{categoryName}}"', 'New entry at position {{position}}.'),
  ('ranking_dropped_out', '{{appName}} dropped out of "{{categoryName}}"', 'No longer listed in this category. Was at position {{previousPosition}}.'),
  ('ranking_category_change', '{{appName}} rank changed in "{{categoryName}}"', 'Category rank changed from {{previousPosition}} to {{position}}.'),
  ('competitor_overtook', '{{competitorName}} overtook {{appName}}', 'For "{{keyword}}": {{competitorName}} is now at {{position}}.'),
  ('competitor_featured', '{{competitorName}} got featured', 'Spotted in {{surfaceName}}.'),
  ('competitor_review_surge', '{{competitorName}} review surge', '{{reviewCount}} new reviews detected.'),
  ('competitor_pricing_change', '{{competitorName}} changed pricing', 'Pricing update detected for {{competitorName}}.'),
  ('review_new_positive', 'New {{rating}} star review for {{appName}}', 'A positive review was posted.'),
  ('review_new_negative', 'New {{rating}} star review for {{appName}}', 'A negative review needs attention.'),
  ('review_velocity_spike', 'Review velocity spike for {{appName}}', '{{reviewCount}} reviews in recent period.'),
  ('keyword_position_gained', '{{appName}} gained position for "{{keyword}}"', 'Moved from {{previousPosition}} to {{position}}.'),
  ('keyword_position_lost', '{{appName}} lost position for "{{keyword}}"', 'Dropped from {{previousPosition}} to {{position}}.'),
  ('keyword_new_ranking', '{{appName}} ranked for "{{keyword}}"', 'First appearance at position {{position}}.'),
  ('featured_new_placement', '{{appName}} got featured', 'Spotted in {{surfaceName}}.'),
  ('featured_removed', '{{appName}} removed from featured', 'No longer in {{surfaceName}}.'),
  ('system_scrape_complete', 'Scrape completed: {{scraperType}}', '{{platform}} {{scraperType}} run finished successfully.'),
  ('system_scrape_failed', 'Scrape failed: {{scraperType}}', '{{errorMessage}}'),
  ('account_member_joined', '{{memberName}} joined your team', 'A new team member has joined your account.'),
  ('account_limit_warning', 'Approaching {{limitType}} limit', 'Using {{current}} of {{max}}. Consider upgrading.'),
  ('account_limit_reached', '{{limitType}} limit reached', 'You have reached {{max}}. Upgrade to add more.')
ON CONFLICT (notification_type) DO NOTHING;

-- Seed email templates with current defaults
INSERT INTO email_templates (email_type, subject_template, body_template) VALUES
  ('email_password_reset', 'Reset your password', 'Click the link to reset your password. This link expires in {{expiryMinutes}} minutes.'),
  ('email_verification', 'Verify your email address', 'Click the link to verify your email address.'),
  ('email_welcome', 'Welcome to AppRanks', 'Welcome {{name}}! Your account is ready.'),
  ('email_invitation', 'You have been invited to {{accountName}}', '{{inviterName}} invited you to join {{accountName}} as {{role}}.'),
  ('email_login_alert', 'New login detected', 'A new login was detected from {{ipAddress}} ({{userAgent}}).'),
  ('email_2fa_code', 'Your verification code', 'Your verification code is {{code}}. It expires in {{expiryMinutes}} minutes.'),
  ('email_daily_digest', 'Daily Digest — {{date}}', 'Your daily app tracking summary.'),
  ('email_weekly_summary', 'Weekly Summary — {{dateRange}}', 'Your weekly app performance summary.'),
  ('email_ranking_alert', 'Ranking Alert: {{appName}}', '{{appName}} ranking changed in {{categoryName}}.'),
  ('email_competitor_alert', 'Competitor Alert: {{competitorName}}', '{{competitorName}} activity detected.'),
  ('email_review_alert', 'Review Alert: {{appName}}', 'New review activity for {{appName}}.'),
  ('email_win_celebration', 'Congratulations! {{appName}} reached #{{position}}', '{{appName}} is now ranked #{{position}} in {{categoryName}}.'),
  ('email_re_engagement', 'We miss you! Check your app rankings', 'Your tracked apps have had new activity since your last visit.'),
  ('email_onboarding', 'Getting started with AppRanks', 'Welcome! Here is how to get the most out of AppRanks.')
ON CONFLICT (email_type) DO NOTHING;
