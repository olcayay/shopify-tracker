import { getEnabledFeatures } from "@/lib/api";

/**
 * Server component version: checks DB-backed "ads" feature flag.
 * Requires both the feature flag AND the platform capability.
 */
export async function shouldShowAds(caps: { hasAdTracking: boolean }): Promise<boolean> {
  if (!caps.hasAdTracking) return false;
  const features = await getEnabledFeatures();
  return features.includes("ads");
}
