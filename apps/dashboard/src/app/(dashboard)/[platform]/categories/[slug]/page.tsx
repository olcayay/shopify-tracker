import Link from "next/link";
import { formatDateTime } from "@/lib/format-date";
import { getCategory, getCategoryHistory, getAccountCompetitors, getAccountTrackedApps, getAccountStarredCategories, getAppsLastChanges, getAppsMinPaidPrices, getAppsReverseSimilarCounts, getFeaturedApps, getCategoryAds, getCategoryScores } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, Info, AppWindow as AppWindowIcon } from "lucide-react";
import { StarCategoryButton } from "@/components/star-category-button";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";
import { AdHeatmap } from "@/components/ad-heatmap";
import { CategoryAppResults } from "./app-results";
import { buildExternalCategoryUrl, getPlatformName } from "@/lib/platform-urls";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { platform, slug } = await params;

  let category: any;
  let history: any;
  let competitors: any[] = [];
  let trackedApps: any[] = [];
  let starredCategories: any[] = [];
  try {
    [category, history, competitors, trackedApps, starredCategories] = await Promise.all([
      getCategory(slug, platform as PlatformId),
      getCategoryHistory(slug, 10, platform as PlatformId),
      getAccountCompetitors(platform as PlatformId).catch(() => []),
      getAccountTrackedApps(platform as PlatformId).catch(() => []),
      getAccountStarredCategories(platform as PlatformId).catch(() => []),
    ]);
  } catch {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-lg font-semibold mb-2">Category not indexed yet</h2>
        <p className="text-muted-foreground mb-4">
          This category hasn&apos;t been discovered by the crawler yet. It may appear after the next scrape cycle.
        </p>
        <Link
          href={`/${platform}/categories`}
          className="text-sm text-primary hover:underline"
        >
          Browse all categories
        </Link>
      </div>
    );
  }

  const caps = isPlatformId(platform) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const competitorSlugs = new Set(competitors.map((c: any) => c.appSlug));
  const trackedSlugs = new Set(trackedApps.map((a: any) => a.appSlug));
  const isStarred = starredCategories.some((sc: any) => sc.categorySlug === slug);

  const rankedApps = category.rankedApps || [];
  const appSlugs: string[] = rankedApps.map((a: any) => a.slug);
  const [lastChanges, minPaidPrices, reverseSimilarCounts, featuredData, categoryAdData, categoryScoresData] = await Promise.all([
    getAppsLastChanges(appSlugs, platform as PlatformId).catch(() => ({} as Record<string, string>)),
    getAppsMinPaidPrices(appSlugs, platform as PlatformId).catch(() => ({} as Record<string, number | null>)),
    getAppsReverseSimilarCounts(appSlugs, platform as PlatformId).catch(() => ({} as Record<string, number>)),
    getFeaturedApps(30, "category", slug, undefined, platform as PlatformId).catch(() => ({
      sightings: [],
      trackedSlugs: [],
      competitorSlugs: [],
    })),
    caps.hasAdTracking ? getCategoryAds(slug, 30, platform as PlatformId).catch(() => ({ adSightings: [] })) : Promise.resolve({ adSightings: [] }),
    getCategoryScores(slug, 50, platform as PlatformId).catch(() => ({ scores: [], computedAt: null })),
  ]);

  // Build score lookup maps (power only, visibility is now account-scoped)
  const scoreTotalApps: number | null = categoryScoresData?.totalApps ?? null;
  const categoryScores = (categoryScoresData?.scores?.length > 0)
    ? {
        powerScore: Object.fromEntries(
          (categoryScoresData.scores as any[]).map((s: any) => [s.appSlug, s.powerScore])
        ) as Record<string, number>,
        ratingScore: Object.fromEntries(
          (categoryScoresData.scores as any[]).map((s: any) => [s.appSlug, Number(s.ratingScore) || 0])
        ) as Record<string, number>,
        reviewScore: Object.fromEntries(
          (categoryScoresData.scores as any[]).map((s: any) => [s.appSlug, Number(s.reviewScore) || 0])
        ) as Record<string, number>,
        categoryScore: Object.fromEntries(
          (categoryScoresData.scores as any[]).map((s: any) => [s.appSlug, Number(s.categoryScore) || 0])
        ) as Record<string, number>,
        momentumScore: Object.fromEntries(
          (categoryScoresData.scores as any[]).map((s: any) => [s.appSlug, Number(s.momentumScore) || 0])
        ) as Record<string, number>,
        // Position = rank in sorted scores (already sorted by powerScore desc from API)
        position: Object.fromEntries(
          (categoryScoresData.scores as any[]).map((s: any, i: number) => [s.appSlug, i + 1])
        ) as Record<string, number>,
        totalApps: scoreTotalApps,
      }
    : undefined;

  // Group featured sightings by section
  const featuredSections = new Map<
    string,
    { sectionHandle: string; sectionTitle: string; sightings: any[] }
  >();
  for (const s of featuredData.sightings) {
    const key = s.sectionHandle;
    if (!featuredSections.has(key)) {
      featuredSections.set(key, {
        sectionHandle: s.sectionHandle,
        sectionTitle: s.sectionTitle || s.sectionHandle,
        sightings: [],
      });
    }
    featuredSections.get(key)!.sightings.push({
      slug: s.appSlug,
      name: s.appName,
      seenDate: s.seenDate,
      timesSeenInDay: s.timesSeenInDay ?? 1,
      iconUrl: s.iconUrl,
    });
  }
  const sortedFeaturedSections = [...featuredSections.values()].sort((a, b) =>
    a.sectionHandle.localeCompare(b.sectionHandle)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          {category.allParentPaths?.length > 1 ? (
            <nav className="flex flex-col gap-0.5 text-sm text-muted-foreground mb-1">
              {category.allParentPaths.map((parent: any) => (
                <span key={parent.slug} className="flex items-center gap-1">
                  <Link
                    href={`/${platform}/categories/${parent.slug}`}
                    className="hover:underline hover:text-foreground"
                  >
                    {parent.title}
                  </Link>
                  <span>&rsaquo;</span>
                </span>
              ))}
            </nav>
          ) : category.breadcrumb?.length > 0 ? (
            <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
              {category.breadcrumb.map((item: any, i: number) => (
                <span key={item.slug} className="flex items-center gap-1">
                  {i > 0 && <span>&rsaquo;</span>}
                  <Link
                    href={`/${platform}/categories/${item.slug}`}
                    className="hover:underline hover:text-foreground"
                  >
                    {item.title}
                  </Link>
                </span>
              ))}
            </nav>
          ) : null}
          <h1 className="text-2xl font-bold">{category.title}</h1>
          {category.description && (
            <p className="text-muted-foreground mt-1">{category.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StarCategoryButton
            categorySlug={category.slug}
            initialStarred={isStarred}
          />
          <AdminScraperTrigger
            scraperType="category"
            slug={category.slug}
            label="Scrape Category"
          />
          <a
            href={buildExternalCategoryUrl(platform as PlatformId, category.slug)}
            target="_blank"
            rel="noopener noreferrer"
            title={`View on ${getPlatformName(platform as PlatformId)}`}
            className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent transition-colors"
          >
            <ExternalLink className="h-5 w-5 text-muted-foreground" />
          </a>
        </div>
      </div>

      {/* Children */}
      {category.children?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Subcategories ({category.children.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {category.children.map((child: any) => (
                <Link key={child.slug} href={`/${platform}/categories/${child.slug}`}>
                  <Badge variant="outline" className="cursor-pointer">
                    {child.title}{child.appCount != null ? ` (${child.appCount})` : ""}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommended by Shopify */}
      {sortedFeaturedSections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommended by Shopify</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {sortedFeaturedSections.map((section) => (
              <div key={section.sectionHandle}>
                {sortedFeaturedSections.length > 1 && (
                  <h3 className="text-sm font-medium mb-2">{section.sectionTitle}</h3>
                )}
                <AdHeatmap
                  sightings={section.sightings}
                  linkPrefix={`/${platform}/apps/`}
                  trackedSlugs={featuredData.trackedSlugs}
                  competitorSlugs={featuredData.competitorSlugs}
                  initialVisible={12}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Sponsored Apps */}
      {caps.hasAdTracking && (
      <Card>
        <CardHeader>
          <CardTitle>
            Sponsored Apps
            {categoryAdData.adSightings?.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {new Set(categoryAdData.adSightings.map((s: any) => s.appSlug)).size} apps, last 30 days
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categoryAdData.adSightings?.length > 0 ? (
            <AdHeatmap
              sightings={categoryAdData.adSightings.map((s: any) => ({
                slug: s.appSlug,
                name: s.appName,
                seenDate: s.seenDate,
                timesSeenInDay: s.timesSeenInDay,
                iconUrl: s.iconUrl,
              }))}
              linkPrefix={`/${platform}/apps/`}
              trackedSlugs={[...trackedSlugs]}
              competitorSlugs={[...competitorSlugs]}
              initialVisible={12}
            />
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No sponsored app sightings recorded for this category yet.
            </p>
          )}
        </CardContent>
      </Card>
      )}

      {/* Ranked Apps (listing pages) or Aggregated Apps (hub pages) */}
      {!category.isListingPage && rankedApps.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 px-4 py-3 text-sm">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <span className="text-muted-foreground">
            This is not a listing category. The apps below are aggregated from child listing categories and their order does not represent Shopify rankings. By default, they are sorted by review count.
          </span>
        </div>
      )}

      {rankedApps.length === 0 && category.isListingPage && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <AppWindowIcon className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium mb-1">No plugins found yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                This {platform === "wordpress" ? "tag" : "category"} hasn&apos;t been scraped yet. Plugins will appear here after the next scrape cycle.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {rankedApps.length > 0 && (
        <CategoryAppResults
          apps={rankedApps.map((app: any) => ({
            position: app.position,
            name: app.name,
            slug: app.slug,
            logo_url: app.icon_url,
            average_rating: app.average_rating,
            rating_count: app.rating_count,
            pricing_hint: app.pricing_hint,
            is_built_for_shopify: app.is_built_for_shopify,
            launched_date: app.launched_date,
            source_categories: app.source_categories,
          }))}
          trackedSlugs={[...trackedSlugs]}
          competitorSlugs={[...competitorSlugs]}
          lastChanges={lastChanges}
          minPaidPrices={minPaidPrices}
          reverseSimilarCounts={reverseSimilarCounts}
          isHubPage={!category.isListingPage}
          categoryScores={categoryScores}
        />
      )}

      {/* History (listing pages only) */}
      {category.isListingPage && history?.snapshots?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>History ({history.total} snapshots)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>App Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.snapshots.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {formatDateTime(s.scrapedAt)}
                    </TableCell>
                    <TableCell>{s.appCount ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
