import {
  getIntegration,
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
import { AppListTable } from "@/components/app-list-table";

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  let integration: any;
  let competitors: any[] = [];
  let trackedApps: any[] = [];
  try {
    [integration, competitors, trackedApps] = await Promise.all([
      getIntegration(decodedName),
      getAccountCompetitors().catch(() => []),
      getAccountTrackedApps().catch(() => []),
    ]);
  } catch {
    return <p className="text-muted-foreground">Integration not found.</p>;
  }

  const appSlugs = (integration.apps || []).map((a: any) => a.slug).filter(Boolean);
  const [lastChanges, minPaidPrices, launchedDates, appCategories, reverseSimilarCounts, featuredSectionCounts, adKeywordCounts, reviewVelocity] = await Promise.all([
    getAppsLastChanges(appSlugs).catch(() => ({} as Record<string, string>)),
    getAppsMinPaidPrices(appSlugs).catch(() => ({} as Record<string, number | null>)),
    getAppsLaunchedDates(appSlugs).catch(() => ({} as Record<string, string | null>)),
    getAppsCategories(appSlugs).catch(() => ({} as Record<string, any[]>)),
    getAppsReverseSimilarCounts(appSlugs).catch(() => ({} as Record<string, number>)),
    getAppsFeaturedSectionCounts(appSlugs).catch(() => ({} as Record<string, number>)),
    getAppsAdKeywordCounts(appSlugs).catch(() => ({} as Record<string, number>)),
    getAppsReviewVelocity(appSlugs).catch(() => ({})),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{integration.name}</h1>

      <AppListTable
        title="Apps with this Integration"
        apps={integration.apps || []}
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
