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

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  let feature: any;
  let competitors: any[] = [];
  let trackedApps: any[] = [];
  try {
    [feature, competitors, trackedApps] = await Promise.all([
      getFeature(handle),
      getAccountCompetitors().catch(() => []),
      getAccountTrackedApps().catch(() => []),
    ]);
  } catch {
    return <p className="text-muted-foreground">Feature not found.</p>;
  }

  const featureAppSlugs = (feature.apps || []).map((a: any) => a.slug).filter(Boolean);
  const [lastChanges, minPaidPrices, launchedDates, appCategories, reverseSimilarCounts, featuredSectionCounts, adKeywordCounts, reviewVelocity] = await Promise.all([
    getAppsLastChanges(featureAppSlugs).catch(() => ({} as Record<string, string>)),
    getAppsMinPaidPrices(featureAppSlugs).catch(() => ({} as Record<string, number | null>)),
    getAppsLaunchedDates(featureAppSlugs).catch(() => ({} as Record<string, string | null>)),
    getAppsCategories(featureAppSlugs).catch(() => ({} as Record<string, any[]>)),
    getAppsReverseSimilarCounts(featureAppSlugs).catch(() => ({} as Record<string, number>)),
    getAppsFeaturedSectionCounts(featureAppSlugs).catch(() => ({} as Record<string, number>)),
    getAppsAdKeywordCounts(featureAppSlugs).catch(() => ({} as Record<string, number>)),
    getAppsReviewVelocity(featureAppSlugs).catch(() => ({})),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {(feature.categoryTitle || feature.subcategoryTitle) && (
            <p className="text-sm text-muted-foreground mb-1">
              {feature.categoryTitle && (
                <Link
                  href={`/features/category?category=${encodeURIComponent(feature.categoryTitle)}`}
                  className="hover:underline hover:text-foreground transition-colors"
                >
                  {feature.categoryTitle}
                </Link>
              )}
              {feature.categoryTitle && feature.subcategoryTitle && " > "}
              {feature.subcategoryTitle && (
                <Link
                  href={`/features/category?${new URLSearchParams({ ...(feature.categoryTitle ? { category: feature.categoryTitle } : {}), subcategory: feature.subcategoryTitle }).toString()}`}
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
