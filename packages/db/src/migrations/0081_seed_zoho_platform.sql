-- Seed: all existing accounts get Zoho Marketplace access
INSERT INTO account_platforms (account_id, platform)
SELECT id, 'zoho' FROM accounts
ON CONFLICT (account_id, platform) DO NOTHING;

-- Seed platform_visibility for Zoho (hidden by default, system admin can enable)
INSERT INTO platform_visibility (platform, is_visible)
VALUES ('zoho', false)
ON CONFLICT (platform) DO NOTHING;
