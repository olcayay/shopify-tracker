-- Seed scrape-timestamps feature flag (default: disabled)
-- Controls visibility of "Data from X ago" freshness indicator on app/category pages
INSERT INTO feature_flags (id, slug, name, description, is_enabled, created_at)
VALUES (
  gen_random_uuid(),
  'scrape-timestamps',
  'Scrape Timestamps',
  'Show "Data from X ago" freshness indicator on app detail, details, rankings, and category pages',
  false,
  NOW()
)
ON CONFLICT (slug) DO NOTHING;
