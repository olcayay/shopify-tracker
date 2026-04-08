-- Seed platform feature flags for all 12 platforms
-- All flags start as enabled (isEnabled: true) to preserve current behavior
-- Platform access can then be restricted per-account or globally via admin panel

INSERT INTO "feature_flags" ("slug", "name", "description", "is_enabled", "activated_at")
VALUES
  ('platform-shopify', 'Platform: Shopify', 'Access to Shopify App Store tracking and analytics', true, now()),
  ('platform-salesforce', 'Platform: Salesforce', 'Access to Salesforce AppExchange tracking and analytics', true, now()),
  ('platform-canva', 'Platform: Canva', 'Access to Canva Apps Marketplace tracking and analytics', true, now()),
  ('platform-wix', 'Platform: Wix', 'Access to Wix App Market tracking and analytics', true, now()),
  ('platform-wordpress', 'Platform: WordPress', 'Access to WordPress Plugin Directory tracking and analytics', true, now()),
  ('platform-google-workspace', 'Platform: Google Workspace', 'Access to Google Workspace Marketplace tracking and analytics', true, now()),
  ('platform-atlassian', 'Platform: Atlassian', 'Access to Atlassian Marketplace tracking and analytics', true, now()),
  ('platform-zoom', 'Platform: Zoom', 'Access to Zoom App Marketplace tracking and analytics', true, now()),
  ('platform-zoho', 'Platform: Zoho', 'Access to Zoho Marketplace tracking and analytics', true, now()),
  ('platform-zendesk', 'Platform: Zendesk', 'Access to Zendesk Marketplace tracking and analytics', true, now()),
  ('platform-hubspot', 'Platform: HubSpot', 'Access to HubSpot App Marketplace tracking and analytics', true, now()),
  ('platform-woocommerce', 'Platform: WooCommerce', 'Access to WooCommerce Marketplace tracking and analytics', true, now())
ON CONFLICT ("slug") DO NOTHING;
