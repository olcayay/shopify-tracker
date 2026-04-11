/**
 * Client component version: checks "ads" feature flag via the provided hasFeature function.
 * Use with useFeatureFlags().hasFeature from the FeatureFlagsProvider.
 */
export function shouldShowAdsClient(
  caps: { hasAdTracking: boolean },
  hasFeature: (slug: string) => boolean,
): boolean {
  return caps.hasAdTracking && hasFeature("ads");
}
