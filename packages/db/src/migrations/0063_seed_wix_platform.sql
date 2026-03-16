-- Seed: all existing accounts get Wix access
INSERT INTO account_platforms (account_id, platform)
SELECT id, 'wix' FROM accounts
ON CONFLICT (account_id, platform) DO NOTHING;
