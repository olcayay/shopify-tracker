import {
  getPlatformAttribute,
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

/** Format a URL value into a readable title. Handles encoded display names
 *  (e.g. "Horizontal Product"), camelCase keys (e.g. "customerService"),
 *  and legacy slugs (e.g. "horizontal-product"). */
function formatTitle(value: string): string {
  // If the value already has spaces, it's a proper display name
  if (value.includes(" ")) return value;
  // camelCase: insert space before uppercase letters (e.g. "customerService" → "Customer Service")
  if (/[a-z][A-Z]/.test(value)) {
    return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  }
  // If all uppercase or title case without spaces, return as-is
  if (/[A-Z]/.test(value)) return value;
  // Otherwise treat as a slug: replace hyphens with spaces and title-case
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const TYPE_LABELS: Record<string, string> = {
  industry: "Industry",
  "business-need": "Business Need",
  "product-required": "Requires",
};

export default async function DiscoverPage({
  params,
}: {
  params: Promise<{ platform: string; type: string; value: string }>;
}) {
  const { platform, type, value } = await params;
  const decodedValue = decodeURIComponent(value);
  const typeLabel = TYPE_LABELS[type] || type;

  let result: any;
  let competitorSlugs: string[] = [];
  let trackedApps: any[] = [];
  try {
    [result, competitorSlugs, trackedApps] = await Promise.all([
      getPlatformAttribute(type, decodedValue, platform as PlatformId),
      getAccountCompetitorSlugs(platform as PlatformId).catch(() => []),
      getAccountTrackedApps(platform as PlatformId).catch(() => []),
    ]);
  } catch {
    return <p className="text-muted-foreground">No apps found.</p>;
  }

  const appSlugs = (result.apps || []).map((a: any) => a.slug).filter(Boolean);
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
      <div>
        <p className="text-sm text-muted-foreground">{typeLabel}</p>
        <h1 className="text-2xl font-bold">{formatTitle(decodedValue)}</h1>
      </div>

      <AppListTable
        title={`Apps (${result.apps?.length || 0})`}
        apps={result.apps || []}
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
