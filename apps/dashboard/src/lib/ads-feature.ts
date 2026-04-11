/**
 * Global feature gate for ads.
 * Set NEXT_PUBLIC_ADS_ENABLED=true to enable ads across the dashboard.
 * Default: disabled (ads hidden from all users).
 *
 * This flag works alongside the platform capability `hasAdTracking` —
 * both must be true for ads to appear.
 */
export function isAdsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ADS_ENABLED === "true";
}

/**
 * Check if ads should be shown for a given platform.
 * Requires both the global feature flag AND the platform capability.
 */
export function shouldShowAds(caps: { hasAdTracking: boolean }): boolean {
  return caps.hasAdTracking && isAdsEnabled();
}
