import {
  getIntegration,
  getAccountCompetitorSlugs,
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
import { AppListTable } from "@/components/app-list-table";
import type { PlatformId } from "@appranks/shared";

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ platform: string; name: string }>;
}) {
  const { platform, name } = await params;
  const decodedName = decodeURIComponent(name);

  let integration: any;
  let competitorSlugs: string[] = [];
  let trackedApps: any[] = [];
  try {
    [integration, competitorSlugs, trackedApps] = await Promise.all([
      getIntegration(decodedName, platform as PlatformId),
      getAccountCompetitorSlugs(platform as PlatformId).catch(() => []),
      getAccountTrackedApps(platform as PlatformId).catch(() => []),
    ]);
  } catch {
    return <p className="text-muted-foreground">Integration not found.</p>;
  }

  const appSlugs = (integration.apps || []).map((a: any) => a.slug).filter(Boolean);
  const [lastChanges, minPaidPrices, launchedDates, appCategories, reverseSimilarCounts, featuredSectionCounts, adKeywordCounts, reviewVelocity] = await Promise.all([
    getAppsLastChanges(appSlugs, platform as PlatformId).catch(() => ({} as Record<string, string>)),
    getAppsMinPaidPrices(appSlugs, platform as PlatformId).catch(() => ({} as Record<string, number | null>)),
    getAppsLaunchedDates(appSlugs, platform as PlatformId).catch(() => ({} as Record<string, string | null>)),
    getAppsCategories(appSlugs, platform as PlatformId).catch(() => ({} as Record<string, any[]>)),
    getAppsReverseSimilarCounts(appSlugs, platform as PlatformId).catch(() => ({} as Record<string, number>)),
    getAppsFeaturedSectionCounts(appSlugs, platform as PlatformId).catch(() => ({} as Record<string, number>)),
    getAppsAdKeywordCounts(appSlugs, platform as PlatformId).catch(() => ({} as Record<string, number>)),
    getAppsReviewVelocity(appSlugs, platform as PlatformId).catch(() => ({})),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{integration.name}</h1>

      <AppListTable
        title="Apps with this Integration"
        apps={integration.apps || []}
        trackedSlugs={trackedApps.map((a: any) => a.appSlug)}
        competitorSlugs={competitorSlugs}
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
