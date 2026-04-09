-- Enable email_alerts_enabled for ALL existing accounts that don't already have it.
-- Previously only the Jotform account (869253b7-...) was enabled via 0122.
-- This ensures no account is silently blocked from receiving email alerts.
INSERT INTO account_feature_flags (account_id, feature_flag_id)
SELECT a.id, ff.id
FROM accounts a
CROSS JOIN feature_flags ff
WHERE ff.slug = 'email_alerts_enabled'
  AND NOT EXISTS (
    SELECT 1 FROM account_feature_flags aff
    WHERE aff.account_id = a.id AND aff.feature_flag_id = ff.id
  )
ON CONFLICT (account_id, feature_flag_id) DO NOTHING;
