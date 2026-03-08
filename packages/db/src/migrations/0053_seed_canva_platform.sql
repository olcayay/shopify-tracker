-- Seed: all existing accounts get Canva access
INSERT INTO account_platforms (account_id, platform)
SELECT id, 'canva' FROM accounts
ON CONFLICT (account_id, platform) DO NOTHING;
