-- Phase A: Consolidate platform access into feature_flags.
-- Before: platform_visibility.is_visible + account_platforms.override_global_visibility were
-- a parallel/duplicate system alongside feature_flags.platform-<id>. This migration
-- makes feature_flags the single source of truth for platform access.
--
-- After this migration, API code reads only feature_flags.platform-<id> (3-tier).
-- The legacy columns are still present but unused; Phase B/C drops them once the
-- new code has fully rolled out.

-- 1. Ensure a feature flag exists for every platform currently tracked in platform_visibility.
INSERT INTO feature_flags (slug, name, description, is_enabled)
SELECT
  'platform-' || replace(pv.platform, '_', '-') AS slug,
  'Platform: ' || pv.platform                    AS name,
  'Access gate for ' || pv.platform || ' marketplace data' AS description,
  pv.is_visible                                  AS is_enabled
FROM platform_visibility pv
ON CONFLICT (slug) DO NOTHING;

-- 2. Source-of-truth sync: feature_flags.is_enabled = platform_visibility.is_visible.
-- This corrects any drift (e.g. feature flag toggled manually while platform_visibility stale).
UPDATE feature_flags ff
SET
  is_enabled     = pv.is_visible,
  activated_at   = CASE WHEN pv.is_visible = true  AND ff.activated_at IS NULL THEN NOW() ELSE ff.activated_at END,
  deactivated_at = CASE WHEN pv.is_visible = false AND ff.is_enabled    = true THEN NOW() ELSE ff.deactivated_at END
FROM platform_visibility pv
WHERE ff.slug = 'platform-' || replace(pv.platform, '_', '-')
  AND ff.is_enabled IS DISTINCT FROM pv.is_visible;

-- 3. Migrate per-account "early access" overrides to account_feature_flags.
-- (Currently empty in prod, but idempotent for safety / dev envs.)
INSERT INTO account_feature_flags (account_id, feature_flag_id)
SELECT ap.account_id, ff.id
FROM account_platforms ap
JOIN feature_flags ff ON ff.slug = 'platform-' || replace(ap.platform, '_', '-')
WHERE ap.override_global_visibility = true
ON CONFLICT (account_id, feature_flag_id) DO NOTHING;
