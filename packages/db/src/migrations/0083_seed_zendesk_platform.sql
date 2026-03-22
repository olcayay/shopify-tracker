-- Seed: all existing accounts get Zendesk Marketplace access
INSERT INTO account_platforms (account_id, platform)
SELECT id, 'zendesk' FROM accounts
ON CONFLICT (account_id, platform) DO NOTHING;

-- Seed platform_visibility for Zendesk (hidden by default, system admin can enable)
INSERT INTO platform_visibility (platform, is_visible)
VALUES ('zendesk', false)
ON CONFLICT (platform) DO NOTHING;
