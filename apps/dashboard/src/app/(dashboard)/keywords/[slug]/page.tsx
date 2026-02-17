import Link from "next/link";
import { formatDateOnly } from "@/lib/format-date";
import { getKeyword, getKeywordRankings, getKeywordAds, getAccountCompetitors, getAccountTrackedApps } from "@/lib/api";
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
import { RankingChart } from "@/components/ranking-chart";
import { TrackKeywordButton } from "./track-button";
import { StarAppButton } from "@/components/star-app-button";
import { LiveSearchTrigger } from "@/components/live-search-trigger";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";
import { KeywordAppResults } from "./app-results";
import { AdHeatmap } from "@/components/ad-heatmap";

export default async function KeywordDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let keyword: any;
  let rankings: any;
  let adData: any;
  let competitors: any[] = [];
  let trackedApps: any[] = [];
  try {
    [keyword, rankings, adData, competitors, trackedApps] = await Promise.all([
      getKeyword(slug),
      getKeywordRankings(slug, 30, "account"),
      getKeywordAds(slug),
      getAccountCompetitors().catch(() => []),
      getAccountTrackedApps().catch(() => []),
    ]);
  } catch {
    return <p className="text-muted-foreground">Keyword not found.</p>;
  }

  const competitorSlugs = new Set(competitors.map((c: any) => c.appSlug));
  const trackedSlugs = new Set(trackedApps.map((a: any) => a.appSlug));

  const snapshot = keyword.latestSnapshot;
  const allApps = snapshot?.results || [];
  const builtInApps = allApps.filter((a: any) => a.is_built_in);
  const organicApps = allApps.filter((a: any) => !a.is_sponsored && !a.is_built_in);
  const sponsoredApps = allApps.filter((a: any) => a.is_sponsored);

  // Build ranking chart data from rankings (filtered to tracked + competitor apps)
  const rankingChartData = (rankings?.rankings || []).map((r: any) => ({
    date: formatDateOnly(r.scrapedAt),
    position: r.position,
    label: r.appName || r.appSlug,
    slug: r.appSlug,
    linkPrefix: "/apps/",
    isBuiltForShopify: r.isBuiltForShopify,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            &ldquo;{keyword.keyword}&rdquo;
          </h1>
          <p className="text-muted-foreground">
            {snapshot?.totalResults?.toLocaleString() ?? "?"} total results
            {snapshot?.scrapedAt && (
              <>
                {" "}
                &middot; Last updated:{" "}
                {formatDateOnly(snapshot.scrapedAt)}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LiveSearchTrigger keyword={keyword.keyword} />
          <a
            href={`https://apps.shopify.com/search?q=${encodeURIComponent(keyword.keyword)}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Search on Shopify App Store"
            className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent transition-colors"
          >
            <ExternalLink className="h-5 w-5 text-muted-foreground" />
          </a>
          <AdminScraperTrigger
            scraperType="keyword_search"
            keyword={keyword.keyword}
            label="Scrape Keyword"
          />
          <TrackKeywordButton
            keywordId={keyword.id}
            keywordText={keyword.keyword}
            initialTracked={keyword.isTrackedByAccount}
          />
        </div>
      </div>

      {/* Shopify Built-in Features */}
      {builtInApps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Shopify Built-in ({builtInApps.length})
              <Badge variant="secondary" className="ml-2">Built-in Feature</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {builtInApps.map((app: any) => (
                  <TableRow key={app.app_slug} className="bg-blue-50/50 border-l-2 border-l-blue-400">
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={app.app_url || `https://apps.shopify.com/built-in-features/${app.app_slug.replace("bif:", "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline"
                        >
                          {app.app_name}
                        </a>
                        <Badge className="text-[10px] px-1 py-0 h-4 bg-blue-100 text-blue-700 border-blue-300" variant="outline">
                          Built-in
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.short_description || "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Organic Search Results */}
      <KeywordAppResults
        apps={organicApps}
        trackedSlugs={Array.from(trackedSlugs)}
        competitorSlugs={Array.from(competitorSlugs)}
        positionChanges={keyword.positionChanges}
      />

      {/* Sponsored Apps */}
      {sponsoredApps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Sponsored Apps ({sponsoredApps.length})
              <Badge variant="secondary" className="ml-2">Ads</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Reviews</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sponsoredApps.map((app: any) => {
                  const isTracked = trackedSlugs.has(app.app_slug);
                  const isCompetitor = competitorSlugs.has(app.app_slug);
                  return (
                  <TableRow key={app.app_slug} className={isTracked ? "border-l-2 border-l-emerald-500 bg-emerald-500/10" : isCompetitor ? "border-l-2 border-l-amber-500 bg-amber-500/10" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/apps/${app.app_slug}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {app.app_name}
                        </Link>
                        {app.is_built_for_shopify && <span title="Built for Shopify">💎</span>}
                        {isTracked && <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50">Tracked</Badge>}
                        {isCompetitor && <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50">Competitor</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {app.average_rating?.toFixed(1) ?? "\u2014"}
                    </TableCell>
                    <TableCell>
                      {app.rating_count?.toLocaleString() ?? "\u2014"}
                    </TableCell>
                    <TableCell>
                      <StarAppButton
                        appSlug={app.app_slug}
                        initialStarred={competitorSlugs.has(app.app_slug)}
                        size="sm"
                      />
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Organic Ranking History */}
      {rankingChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Organic Ranking History</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingChart data={rankingChartData} />
          </CardContent>
        </Card>
      )}

      {/* Ad History */}
      {adData?.adSightings?.length > 0 && (() => {
        // Group by app
        const adsByApp = new Map<string, { appSlug: string; appName: string; averageRating: any; ratingCount: any; lastSeen: string; totalSightings: number; daysActive: number }>();
        for (const ad of adData.adSightings) {
          const existing = adsByApp.get(ad.appSlug);
          if (existing) {
            existing.totalSightings += ad.timesSeenInDay;
            existing.daysActive += 1;
            if (ad.seenDate > existing.lastSeen) {
              existing.lastSeen = ad.seenDate;
              existing.averageRating = ad.averageRating;
              existing.ratingCount = ad.ratingCount;
            }
          } else {
            adsByApp.set(ad.appSlug, {
              appSlug: ad.appSlug,
              appName: ad.appName,
              averageRating: ad.averageRating,
              ratingCount: ad.ratingCount,
              lastSeen: ad.seenDate,
              totalSightings: ad.timesSeenInDay,
              daysActive: 1,
            });
          }
        }
        const groupedAds = [...adsByApp.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));

        return (
        <Card>
          <CardHeader>
            <CardTitle>Ad History ({groupedAds.length} apps)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <AdHeatmap
              sightings={adData.adSightings.map((s: any) => ({ slug: s.appSlug, name: s.appName, seenDate: s.seenDate, timesSeenInDay: s.timesSeenInDay }))}
              trackedSlugs={Array.from(trackedSlugs)}
              competitorSlugs={Array.from(competitorSlugs)}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Reviews</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className="text-right">Total Sightings</TableHead>
                  <TableHead className="text-right">Days Active</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedAds.map((ad) => {
                  const isTracked = trackedSlugs.has(ad.appSlug);
                  const isCompetitor = competitorSlugs.has(ad.appSlug);
                  return (
                  <TableRow key={ad.appSlug} className={isTracked ? "border-l-2 border-l-emerald-500 bg-emerald-500/10" : isCompetitor ? "border-l-2 border-l-amber-500 bg-amber-500/10" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/apps/${ad.appSlug}`}
                          className="text-primary hover:underline"
                        >
                          {ad.appName}
                        </Link>
                        {isTracked && <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50">Tracked</Badge>}
                        {isCompetitor && <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50">Competitor</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {ad.averageRating ? Number(ad.averageRating).toFixed(1) : "\u2014"}
                    </TableCell>
                    <TableCell>
                      {ad.ratingCount?.toLocaleString() ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateOnly(ad.lastSeen)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {ad.totalSightings}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {ad.daysActive}
                    </TableCell>
                    <TableCell>
                      <StarAppButton
                        appSlug={ad.appSlug}
                        initialStarred={competitorSlugs.has(ad.appSlug)}
                        size="sm"
                      />
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        );
      })()}
    </div>
  );
}
