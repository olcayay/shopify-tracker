-- Create email_alerts_enabled feature flag and enable for Jotform account
INSERT INTO feature_flags (slug, name, description, is_enabled, activated_at)
VALUES (
  'email_alerts_enabled',
  'Email Alerts Enabled',
  'Gates all alert and digest email sending. Users/accounts without this flag receive zero emails.',
  false,
  NULL
)
ON CONFLICT (slug) DO NOTHING;

-- Enable for Jotform account (869253b7-eb5a-42c2-8751-e1211dbdf0c4)
INSERT INTO account_feature_flags (account_id, feature_flag_id)
SELECT
  '869253b7-eb5a-42c2-8751-e1211dbdf0c4',
  id
FROM feature_flags
WHERE slug = 'email_alerts_enabled'
ON CONFLICT (account_id, feature_flag_id) DO NOTHING;
