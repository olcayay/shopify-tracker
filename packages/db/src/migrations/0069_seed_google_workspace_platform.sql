-- Seed: all existing accounts get Google Workspace access
INSERT INTO account_platforms (account_id, platform)
SELECT id, 'google_workspace' FROM accounts
ON CONFLICT (account_id, platform) DO NOTHING;

-- Seed platform_visibility for Google Workspace (hidden by default, system admin can enable)
INSERT INTO platform_visibility (platform, is_visible)
VALUES ('google_workspace', false)
ON CONFLICT (platform) DO NOTHING;
