-- Seed: all existing accounts get Atlassian Marketplace access
INSERT INTO account_platforms (account_id, platform)
SELECT id, 'atlassian' FROM accounts
ON CONFLICT (account_id, platform) DO NOTHING;

-- Seed platform_visibility for Atlassian (hidden by default, system admin can enable)
INSERT INTO platform_visibility (platform, is_visible)
VALUES ('atlassian', false)
ON CONFLICT (platform) DO NOTHING;
