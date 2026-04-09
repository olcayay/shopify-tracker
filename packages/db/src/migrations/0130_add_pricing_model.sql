-- Add canonical pricing model column to apps table (PLA-963)
-- Stores normalized pricing type: Free, Freemium, Free trial, Free to install, Paid, or NULL
ALTER TABLE apps ADD COLUMN IF NOT EXISTS pricing_model VARCHAR(30);

-- Backfill from existing pricing_hint values
UPDATE apps SET pricing_model = CASE
  WHEN LOWER(TRIM(pricing_hint)) = 'free' THEN 'Free'
  WHEN LOWER(TRIM(pricing_hint)) = 'free!' THEN 'Free'
  WHEN LOWER(TRIM(pricing_hint)) IN ('freemium', 'free plan available', 'free_plan_available', 'free with paid features') THEN 'Freemium'
  WHEN LOWER(TRIM(pricing_hint)) IN ('free trial', 'free trial available', 'free_trial') THEN 'Free trial'
  WHEN LOWER(TRIM(pricing_hint)) IN ('free to install') THEN 'Free to install'
  WHEN LOWER(TRIM(pricing_hint)) IN ('paid', 'monthly', 'annual', 'annually') THEN 'Paid'
  WHEN pricing_hint ~ '^From \$' THEN 'Paid'
  WHEN pricing_hint ~ '^\$[0-9]' THEN 'Paid'
  WHEN pricing_hint ~ '/mo(nth)?$' THEN 'Paid'
  WHEN pricing_hint ~ '/yr$' THEN 'Paid'
  ELSE NULL
END
WHERE pricing_model IS NULL AND pricing_hint IS NOT NULL;

-- WordPress apps are all free
UPDATE apps SET pricing_model = 'Free'
WHERE platform = 'wordpress' AND pricing_model IS NULL;

CREATE INDEX IF NOT EXISTS idx_apps_pricing_model ON apps(pricing_model);
