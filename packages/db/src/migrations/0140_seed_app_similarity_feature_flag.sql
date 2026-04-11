-- Seed app similarity feature flag (default: disabled globally)
INSERT INTO feature_flags (id, slug, name, description, is_enabled, created_at)
VALUES (
  gen_random_uuid(),
  'app-similarity',
  'App Similarity',
  'Competitor similarity score surfaces',
  false,
  NOW()
)
ON CONFLICT (slug) DO NOTHING;
