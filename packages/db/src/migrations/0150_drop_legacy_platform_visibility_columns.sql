-- Phase B/C of the platform-access refactor (PLA-1082).
-- Migration 0148 moved the gating logic to feature_flags.platform-<id> (3-tier). The API
-- code in this release no longer reads these columns; they can be dropped safely.
--
-- Dropped:
--   * platform_visibility.is_visible          → replaced by feature_flags.platform-<id>.is_enabled
--   * account_platforms.override_global_visibility → replaced by account_feature_flags rows
--
-- platform_visibility.scraper_enabled stays (separate concern: worker on/off).
-- account_platforms stays as subscription table (capped by accounts.max_platforms).
--
-- Safe to run once 0148 has shipped. Rollback: ADD COLUMN with defaults; data is recoverable
-- from feature_flags.platform-<id>.is_enabled and EXISTS(account_feature_flags row).

ALTER TABLE platform_visibility DROP COLUMN IF EXISTS is_visible;
ALTER TABLE account_platforms   DROP COLUMN IF EXISTS override_global_visibility;
