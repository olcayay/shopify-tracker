import Link from "next/link";
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
    date: new Date(r.scrapedAt).toLocaleDateString(),
    position: r.position,
    label: r.appName || r.appSlug,
    slug: r.appSlug,
    linkPrefix: "/apps/",
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
                {new Date(snapshot.scrapedAt).toLocaleDateString()}
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
      <Card>
        <CardHeader>
          <CardTitle>Organic Results ({organicApps.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Reviews</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {organicApps.map((app: any, idx: number) => {
                const isTracked = trackedSlugs.has(app.app_slug);
                const isCompetitor = competitorSlugs.has(app.app_slug);
                return (
                <TableRow key={app.app_slug} className={isTracked ? "border-l-2 border-l-primary bg-primary/5" : isCompetitor ? "border-l-2 border-l-yellow-500 bg-yellow-500/5" : ""}>
                  <TableCell className="font-mono">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/apps/${app.app_slug}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {app.app_name}
                      </Link>
                      {isTracked && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-primary text-primary">Tracked</Badge>}
                      {isCompetitor && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-yellow-500 text-yellow-600">Competitor</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {app.short_description}
                    </p>
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
                  <TableRow key={app.app_slug} className={isTracked ? "border-l-2 border-l-primary bg-primary/5" : isCompetitor ? "border-l-2 border-l-yellow-500 bg-yellow-500/5" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/apps/${app.app_slug}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {app.app_name}
                        </Link>
                        {isTracked && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-primary text-primary">Tracked</Badge>}
                        {isCompetitor && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-yellow-500 text-yellow-600">Competitor</Badge>}
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
      {adData?.adSightings?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ad History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Times Seen</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {adData.adSightings.map((ad: any, i: number) => {
                  const isTracked = trackedSlugs.has(ad.appSlug);
                  const isCompetitor = competitorSlugs.has(ad.appSlug);
                  return (
                  <TableRow key={i} className={isTracked ? "border-l-2 border-l-primary bg-primary/5" : isCompetitor ? "border-l-2 border-l-yellow-500 bg-yellow-500/5" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/apps/${ad.appSlug}`}
                          className="text-primary hover:underline"
                        >
                          {ad.appName}
                        </Link>
                        {isTracked && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-primary text-primary">Tracked</Badge>}
                        {isCompetitor && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-yellow-500 text-yellow-600">Competitor</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(ad.seenDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {ad.timesSeenInDay}
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
      )}
    </div>
  );
}
