-- Seed score-related feature flags (default: disabled globally)
INSERT INTO feature_flags (id, slug, name, description, is_enabled, created_at)
VALUES
  (
    gen_random_uuid(),
    'keyword-score',
    'Keyword Score',
    'Opportunity score surfaces for keyword and research workflows',
    false,
    NOW()
  ),
  (
    gen_random_uuid(),
    'app-power',
    'App Power',
    'Power score surfaces across app detail and market intel pages',
    false,
    NOW()
  ),
  (
    gen_random_uuid(),
    'app-visibility',
    'App Visibility',
    'Visibility score surfaces and visibility detail pages',
    false,
    NOW()
  )
ON CONFLICT (slug) DO NOTHING;
