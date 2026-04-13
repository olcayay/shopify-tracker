-- Rename historical pricing_model values to canonical Title Case (PLA-1077).
-- Before: "Free trial", "Free to install"
-- After:  "Free Trial", "Free To Install"
--
-- Also re-normalizes any rows where pricing_model was previously NULL but
-- pricing_hint matches a new variant (Subscription / Paid plan).
UPDATE apps SET pricing_model = 'Free Trial'
WHERE pricing_model = 'Free trial';

UPDATE apps SET pricing_model = 'Free To Install'
WHERE pricing_model = 'Free to install';

UPDATE apps SET pricing_model = 'Paid'
WHERE pricing_model IS NULL
  AND pricing_hint IS NOT NULL
  AND LOWER(TRIM(pricing_hint)) IN ('subscription', 'paid plan');
