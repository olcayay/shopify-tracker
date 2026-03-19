-- Seed: all existing accounts get Zoom App Marketplace access
INSERT INTO account_platforms (account_id, platform)
SELECT id, 'zoom' FROM accounts
ON CONFLICT (account_id, platform) DO NOTHING;

-- Seed platform_visibility for Zoom (hidden by default, system admin can enable)
INSERT INTO platform_visibility (platform, is_visible)
VALUES ('zoom', false)
ON CONFLICT (platform) DO NOTHING;
