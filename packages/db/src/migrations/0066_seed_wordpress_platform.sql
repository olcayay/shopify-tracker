-- Seed: all existing accounts get WordPress access
INSERT INTO account_platforms (account_id, platform)
SELECT id, 'wordpress' FROM accounts
ON CONFLICT (account_id, platform) DO NOTHING;

-- Seed platform_visibility for WordPress (hidden by default, system admin can enable)
INSERT INTO platform_visibility (platform, is_visible)
VALUES ('wordpress', false)
ON CONFLICT (platform) DO NOTHING;
