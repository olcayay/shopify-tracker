import Link from "next/link";
import { formatDateTime } from "@/lib/format-date";
import { getCategory, getCategoryHistory, getAccountCompetitors, getAccountTrackedApps, getAccountStarredCategories, getAppsLastChanges, getAppsMinPaidPrices, getAppsReverseSimilarCounts, getFeaturedApps, getCategoryAds } from "@/lib/api";
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
import { ExternalLink, Info } from "lucide-react";
import { StarCategoryButton } from "@/components/star-category-button";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";
import { AdHeatmap } from "@/components/ad-heatmap";
import { CategoryAppResults } from "./app-results";

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let category: any;
  let history: any;
  let competitors: any[] = [];
  let trackedApps: any[] = [];
  let starredCategories: any[] = [];
  try {
    [category, history, competitors, trackedApps, starredCategories] = await Promise.all([
      getCategory(slug),
      getCategoryHistory(slug, 10),
      getAccountCompetitors().catch(() => []),
      getAccountTrackedApps().catch(() => []),
      getAccountStarredCategories().catch(() => []),
    ]);
  } catch {
    return <p className="text-muted-foreground">Category not found.</p>;
  }

  const competitorSlugs = new Set(competitors.map((c: any) => c.appSlug));
  const trackedSlugs = new Set(trackedApps.map((a: any) => a.appSlug));
  const isStarred = starredCategories.some((sc: any) => sc.categorySlug === slug);

  const rankedApps = category.rankedApps || [];
  const appSlugs: string[] = rankedApps.map((a: any) => a.slug);
  const [lastChanges, minPaidPrices, reverseSimilarCounts, featuredData, categoryAdData] = await Promise.all([
    getAppsLastChanges(appSlugs).catch(() => ({} as Record<string, string>)),
    getAppsMinPaidPrices(appSlugs).catch(() => ({} as Record<string, number | null>)),
    getAppsReverseSimilarCounts(appSlugs).catch(() => ({} as Record<string, number>)),
    getFeaturedApps(30, "category", slug).catch(() => ({
      sightings: [],
      trackedSlugs: [],
      competitorSlugs: [],
    })),
    getCategoryAds(slug).catch(() => ({ adSightings: [] })),
  ]);

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
          {category.breadcrumb?.length > 0 && (
            <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
              {category.breadcrumb.map((item: any, i: number) => (
                <span key={item.slug} className="flex items-center gap-1">
                  {i > 0 && <span>&rsaquo;</span>}
                  <Link
                    href={`/categories/${item.slug}`}
                    className="hover:underline hover:text-foreground"
                  >
                    {item.title}
                  </Link>
                </span>
              ))}
            </nav>
          )}
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
            href={`https://apps.shopify.com/categories/${category.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            title="View on Shopify App Store"
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
                <Link key={child.slug} href={`/categories/${child.slug}`}>
                  <Badge variant="outline" className="cursor-pointer">
                    {child.title}
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
                  linkPrefix="/apps/"
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
              linkPrefix="/apps/"
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

      {/* Ranked Apps (listing pages) or Aggregated Apps (hub pages) */}
      {!category.isListingPage && rankedApps.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 px-4 py-3 text-sm">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <span className="text-muted-foreground">
            This is not a listing category. The apps below are aggregated from child listing categories and their order does not represent Shopify rankings. By default, they are sorted by review count.
          </span>
        </div>
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
