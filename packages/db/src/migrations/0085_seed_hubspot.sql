-- Seed: all existing accounts get HubSpot Marketplace access
INSERT INTO account_platforms (account_id, platform)
SELECT id, 'hubspot' FROM accounts
ON CONFLICT (account_id, platform) DO NOTHING;

-- Seed platform_visibility for HubSpot (hidden by default, system admin can enable)
INSERT INTO platform_visibility (platform, is_visible)
VALUES ('hubspot', false)
ON CONFLICT (platform) DO NOTHING;

-- Seed HubSpot App Marketplace categories (hierarchical: 6 top-level)
-- URL format: /marketplace/apps/{slug}
INSERT INTO categories (platform, slug, title, url, category_level, parent_slug)
VALUES
  ('hubspot', 'sales', 'Sales', 'https://ecosystem.hubspot.com/marketplace/apps/sales', 0, NULL),
  ('hubspot', 'marketing', 'Marketing', 'https://ecosystem.hubspot.com/marketplace/apps/marketing', 0, NULL),
  ('hubspot', 'service', 'Service', 'https://ecosystem.hubspot.com/marketplace/apps/service', 0, NULL),
  ('hubspot', 'commerce', 'Commerce', 'https://ecosystem.hubspot.com/marketplace/apps/commerce', 0, NULL),
  ('hubspot', 'operations', 'Operations', 'https://ecosystem.hubspot.com/marketplace/apps/operations', 0, NULL),
  ('hubspot', 'content', 'Content', 'https://ecosystem.hubspot.com/marketplace/apps/content', 0, NULL)
ON CONFLICT (platform, slug) DO UPDATE SET
  title = EXCLUDED.title,
  url = EXCLUDED.url,
  category_level = EXCLUDED.category_level,
  parent_slug = EXCLUDED.parent_slug;
