import Link from "next/link";
import { formatDateTime } from "@/lib/format-date";
import { getCategory, getCategoryHistory, getAccountCompetitors, getAccountTrackedApps, getAccountStarredCategories, getAppsLastChanges, getAppsMinPaidPrices } from "@/lib/api";
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
import { ExternalLink } from "lucide-react";
import { StarCategoryButton } from "@/components/star-category-button";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";
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

  const snapshot = category.latestSnapshot;

  // Use rankedApps (all pages) if available, fall back to firstPageApps
  const hasRankedApps = category.rankedApps?.length > 0;
  const appSlugs: string[] = hasRankedApps
    ? category.rankedApps.map((a: any) => a.slug)
    : (snapshot?.firstPageApps || [])
        .map((app: any) => app.app_url?.replace("https://apps.shopify.com/", "")?.split("?")[0])
        .filter(Boolean);
  const [lastChanges, minPaidPrices] = await Promise.all([
    getAppsLastChanges(appSlugs).catch(() => ({} as Record<string, string>)),
    getAppsMinPaidPrices(appSlugs).catch(() => ({} as Record<string, number | null>)),
  ]);

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

      {/* Latest Snapshot */}
      {snapshot && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">App Count</div>
                <div className="text-xl font-semibold">
                  {snapshot.appCount ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Scraped At</div>
                <div className="text-sm">
                  {formatDateTime(snapshot.scrapedAt)}
                </div>
              </div>
              {snapshot.firstPageMetrics && (
                <>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Avg Rating
                    </div>
                    <div className="text-xl font-semibold">
                      {snapshot.firstPageMetrics.avg_rating?.toFixed(2) ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Avg Reviews
                    </div>
                    <div className="text-xl font-semibold">
                      {snapshot.firstPageMetrics.avg_review_count?.toFixed(0) ??
                        "—"}
                    </div>
                  </div>
                </>
              )}
            </div>

          </CardContent>
        </Card>
      )}

      {/* Ranked Apps (all pages when available, otherwise first page) */}
      {appSlugs.length > 0 && (
        <CategoryAppResults
          apps={hasRankedApps
            ? category.rankedApps.map((app: any) => ({
                position: app.position,
                name: app.name,
                slug: app.slug,
                logo_url: app.icon_url,
                average_rating: app.average_rating,
                rating_count: app.rating_count,
                pricing_hint: app.pricing,
                is_built_for_shopify: app.is_built_for_shopify,
              }))
            : snapshot.firstPageApps.map((app: any, i: number) => {
                const appSlug = app.app_url
                  ?.replace("https://apps.shopify.com/", "")
                  ?.split("?")[0] || "";
                return {
                  position: app.position || i + 1,
                  name: app.name,
                  slug: appSlug,
                  logo_url: app.logo_url,
                  average_rating: app.average_rating,
                  rating_count: app.rating_count,
                  pricing_hint: app.pricing_hint,
                  is_sponsored: app.is_sponsored,
                  is_built_for_shopify: app.is_built_for_shopify,
                };
              })
          }
          trackedSlugs={[...trackedSlugs]}
          competitorSlugs={[...competitorSlugs]}
          lastChanges={lastChanges}
          minPaidPrices={minPaidPrices}
        />
      )}

      {/* History */}
      {history?.snapshots?.length > 0 && (
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
                  <TableHead>First Page Apps</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.snapshots.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {formatDateTime(s.scrapedAt)}
                    </TableCell>
                    <TableCell>{s.appCount ?? "—"}</TableCell>
                    <TableCell>{s.firstPageApps?.length ?? 0}</TableCell>
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
