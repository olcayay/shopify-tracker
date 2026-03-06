-- Seed: all existing accounts get Salesforce access
INSERT INTO account_platforms (account_id, platform)
SELECT id, 'salesforce' FROM accounts
ON CONFLICT (account_id, platform) DO NOTHING;
