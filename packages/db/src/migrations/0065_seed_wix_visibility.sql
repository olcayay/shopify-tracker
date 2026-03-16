-- Seed platform_visibility for Wix (hidden by default, system admin can enable)
INSERT INTO platform_visibility (platform, is_visible)
VALUES ('wix', false)
ON CONFLICT (platform) DO NOTHING;
