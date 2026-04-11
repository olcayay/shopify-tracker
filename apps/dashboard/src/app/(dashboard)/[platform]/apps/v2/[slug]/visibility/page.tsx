import Link from "next/link";
import {
  getApp,
  getAppScores,
  getAppScoresHistory,
  getAppRankings,
  getAppKeywords,
  getAppFeaturedPlacements,
  getAppAdSightings,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";
import { VisibilityTrendChart } from "@/components/v2/visibility-trend-chart";
import { shouldShowAds } from "@/lib/ads-feature";
import { Search, TrendingUp, Award, Megaphone, ArrowRight } from "lucide-react";

export default async function VisibilityOverviewPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { platform, slug } = await params;
  const caps = isPlatformId(platform) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const base = `/${platform}/apps/v2/${slug}/visibility`;

  let app: any;
  let scoresData: any;
  let scoresHistory: any;
  let rankings: any;
  let keywords: any[];
  let featuredData: any;
  let adData: any;

  try {
    [app, scoresData, scoresHistory, rankings, keywords, featuredData, adData] = await Promise.all([
      getApp(slug, platform as PlatformId),
      getAppScores(slug, platform as PlatformId).catch(() => ({ visibility: [], power: [], weightedPowerScore: 0 })),
      getAppScoresHistory(slug, 30, undefined, platform as PlatformId).catch(() => ({ history: [] })),
      getAppRankings(slug, 30, platform as PlatformId).catch(() => ({})),
      app?.isTrackedByAccount !== false
        ? getAppKeywords(slug, platform as PlatformId).catch(() => [])
        : Promise.resolve([]),
      caps.hasFeaturedSections
        ? getAppFeaturedPlacements(slug, 30, platform as PlatformId).catch(() => ({ sightings: [] }))
        : Promise.resolve({ sightings: [] }),
      shouldShowAds(caps)
        ? getAppAdSightings(slug, 30, platform as PlatformId).catch(() => ({ sightings: [] }))
        : Promise.resolve({ sightings: [] }),
    ]);
  } catch {
    return <p className="text-muted-foreground">Failed to load visibility data.</p>;
  }

  // Build chart data
  const hist = scoresHistory?.history || [];
  const chartData = hist.map((h: any) => ({
    date: h.date || h.computedAt,
    visibilityScore: h.visibilityScore,
    powerScore: h.powerScore,
  }));

  // Quick insights
  const kwRankings = rankings?.keywordRankings || [];
  const rankedKwCount = new Set(kwRankings.filter((r: any) => r.position != null).map((r: any) => r.keyword)).size;
  const bestPosition = kwRankings.length > 0
    ? Math.min(...kwRankings.filter((r: any) => r.position != null && r.position > 0).map((r: any) => r.position))
    : null;
  const featuredSections = new Set((featuredData?.sightings || []).map((s: any) => s.sectionHandle || s.surface)).size;
  const adKeywords = new Set((adData?.sightings || []).map((s: any) => s.keywordSlug)).size;

  // Score breakdown
  const bestVis = scoresData.visibility?.length > 0
    ? scoresData.visibility.reduce((best: any, v: any) => (v.visibilityScore ?? 0) > (best.visibilityScore ?? 0) ? v : best)
    : null;

  return (
    <div className="space-y-4">
      {/* Trend Chart */}
      <VisibilityTrendChart history={chartData} />

      {/* Score Breakdown */}
      {bestVis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Visibility Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold tabular-nums">{Math.round(bestVis.visibilityScore ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Overall Score</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{bestVis.keywordCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Keywords Tracked</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{rankedKwCount}</p>
                <p className="text-xs text-muted-foreground">Keywords Ranked</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{bestPosition ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Best Position</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Insights */}
      <div className={`grid grid-cols-2 gap-3 ${
        caps.hasFeaturedSections && shouldShowAds(caps) ? "sm:grid-cols-4" :
        !caps.hasFeaturedSections && !shouldShowAds(caps) ? "sm:grid-cols-2" :
        "sm:grid-cols-3"
      }`}>
        <Link href={`${base}/keywords`}>
          <Card className="hover:ring-1 hover:ring-muted-foreground/20 transition-all h-full">
            <CardContent className="pt-4 flex items-center gap-3">
              <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-lg font-bold">{rankedKwCount}</p>
                <p className="text-xs text-muted-foreground">Keywords ranked</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={`${base}/rankings`}>
          <Card className="hover:ring-1 hover:ring-muted-foreground/20 transition-all h-full">
            <CardContent className="pt-4 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-lg font-bold">{bestPosition != null ? `#${bestPosition}` : "—"}</p>
                <p className="text-xs text-muted-foreground">Best position</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {caps.hasFeaturedSections && (
          <Link href={`${base}/featured`}>
            <Card className="hover:ring-1 hover:ring-muted-foreground/20 transition-all h-full">
              <CardContent className="pt-4 flex items-center gap-3">
                <Award className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-lg font-bold">{featuredSections}</p>
                  <p className="text-xs text-muted-foreground">Featured spots</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {shouldShowAds(caps) && (
          <Link href={`${base}/ads`}>
            <Card className="hover:ring-1 hover:ring-muted-foreground/20 transition-all h-full">
              <CardContent className="pt-4 flex items-center gap-3">
                <Megaphone className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-lg font-bold">{adKeywords}</p>
                  <p className="text-xs text-muted-foreground">Ad keywords</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
