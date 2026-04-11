-- Seed the "ads" feature flag (default: disabled globally)
INSERT INTO feature_flags (id, slug, name, description, is_enabled, created_at)
VALUES (
  gen_random_uuid(),
  'ads',
  'Ads Feature',
  'Ad tracking and visibility features — gated until IP rotation is solved',
  false,
  NOW()
)
ON CONFLICT (slug) DO NOTHING;
