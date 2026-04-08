"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useFeatureFlags } from "@/contexts/feature-flags-context";
import { PLATFORMS, type PlatformId, platformFeatureFlagSlug, PLATFORM_IDS } from "@appranks/shared";

/**
 * Returns the list of platforms the current user can access,
 * filtered by both account-level enablement AND platform feature flags.
 *
 * System admins see all platforms.
 */
export function usePlatformAccess() {
  const { user, account } = useAuth();
  const { hasFeature } = useFeatureFlags();
  const isSystemAdmin = user?.isSystemAdmin ?? false;
  const enabledPlatforms = account?.enabledPlatforms ?? [];

  const accessiblePlatforms = useMemo<PlatformId[]>(() => {
    if (isSystemAdmin) return [...PLATFORM_IDS];
    return enabledPlatforms.filter(
      (pid) => pid in PLATFORMS && hasFeature(platformFeatureFlagSlug(pid as PlatformId))
    ) as PlatformId[];
  }, [isSystemAdmin, enabledPlatforms, hasFeature]);

  const hasPlatformAccess = useMemo(() => {
    const set = new Set<string>(accessiblePlatforms);
    return (platformId: PlatformId) => set.has(platformId);
  }, [accessiblePlatforms]);

  return { accessiblePlatforms, hasPlatformAccess };
}
