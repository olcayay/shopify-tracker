import Link from "next/link";
import {
  getFeature,
  getAccountCompetitors,
  getAccountTrackedApps,
  getAppsLastChanges,
  getAppsMinPaidPrices,
  getAppsLaunchedDates,
  getAppsCategories,
  getAppsReverseSimilarCounts,
  getAppsFeaturedSectionCounts,
  getAppsAdKeywordCounts,
  getAppsReviewVelocity,
} from "@/lib/api";
import { StarFeatureButton } from "./track-button";
import { AppListTable } from "@/components/app-list-table";
import type { PlatformId } from "@appranks/shared";
import { hasServerFeature } from "@/lib/score-features-server";
import {
  buildFeatureCategoryPath,
  buildFeatureSubcategoryPath,
} from "@/lib/feature-category-links";

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ platform: string; handle: string }>;
}) {
  const { platform, handle } = await params;
  const hasAppSimilarity = await hasServerFeature("app-similarity");

  let feature: any;
  let competitors: any[] = [];
  let trackedApps: any[] = [];
  try {
    [feature, competitors, trackedApps] = await Promise.all([
      getFeature(handle, platform as PlatformId),
      getAccountCompetitors(platform as PlatformId).catch(() => []),
      getAccountTrackedApps(platform as PlatformId).catch(() => []),
    ]);
  } catch {
    return <p className="text-muted-foreground">Feature not found.</p>;
  }

  const featureAppSlugs = (feature.apps || []).map((a: any) => a.slug).filter(Boolean);
  const [lastChanges, minPaidPrices, launchedDates, appCategories, reverseSimilarCounts, featuredSectionCounts, adKeywordCounts, reviewVelocity] = await Promise.all([
    getAppsLastChanges(featureAppSlugs, platform as PlatformId).catch(() => ({} as Record<string, string>)),
    getAppsMinPaidPrices(featureAppSlugs, platform as PlatformId).catch(() => ({} as Record<string, number | null>)),
    getAppsLaunchedDates(featureAppSlugs, platform as PlatformId).catch(() => ({} as Record<string, string | null>)),
    getAppsCategories(featureAppSlugs, platform as PlatformId).catch(() => ({} as Record<string, any[]>)),
    hasAppSimilarity
      ? getAppsReverseSimilarCounts(featureAppSlugs, platform as PlatformId).catch(() => ({} as Record<string, number>))
      : Promise.resolve({} as Record<string, number>),
    getAppsFeaturedSectionCounts(featureAppSlugs, platform as PlatformId).catch(() => ({} as Record<string, number>)),
    getAppsAdKeywordCounts(featureAppSlugs, platform as PlatformId).catch(() => ({} as Record<string, number>)),
    getAppsReviewVelocity(featureAppSlugs, platform as PlatformId).catch(() => ({})),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {(feature.categoryTitle || feature.subcategoryTitle) && (
            <p className="text-sm text-muted-foreground mb-1">
              {feature.categoryTitle && (
                <Link
                  href={buildFeatureCategoryPath(platform, feature.categoryTitle)}
                  className="hover:underline hover:text-foreground transition-colors"
                >
                  {feature.categoryTitle}
                </Link>
              )}
              {feature.categoryTitle && feature.subcategoryTitle && " > "}
              {feature.subcategoryTitle && (
                <Link
                  href={buildFeatureSubcategoryPath(
                    platform,
                    feature.categoryTitle || feature.subcategoryTitle,
                    feature.subcategoryTitle,
                  )}
                  className="hover:underline hover:text-foreground transition-colors"
                >
                  {feature.subcategoryTitle}
                </Link>
              )}
            </p>
          )}
          <h1 className="text-2xl font-bold">{feature.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <StarFeatureButton
            featureHandle={feature.handle}
            featureTitle={feature.title}
            initialStarred={feature.isStarredByAccount}
          />
        </div>
      </div>

      <AppListTable
        title="Apps with this Feature"
        apps={feature.apps || []}
        trackedSlugs={trackedApps.map((a: any) => a.appSlug)}
        competitorSlugs={competitors.map((c: any) => c.appSlug)}
        lastChanges={lastChanges}
        minPaidPrices={minPaidPrices}
        launchedDates={launchedDates}
        appCategories={appCategories}
        reverseSimilarCounts={reverseSimilarCounts}
        featuredSectionCounts={featuredSectionCounts}
        adKeywordCounts={adKeywordCounts}
        reviewVelocity={reviewVelocity}
      />
    </div>
  );
}
