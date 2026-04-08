import Link from "next/link";
import {
  getApp,
  getAppScores,
  getAppScoresHistory,
  getAppRankings,
  getAppChanges,
  getAppReviews,
  getAppFeaturedPlacements,
  getAppAdSightings,
  getAppCompetitors,
  getAppKeywords,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format-utils";
import { HealthScoreBar } from "@/components/v2/health-score-bar";
import { AlertsCard, generateAlerts } from "@/components/v2/alerts-card";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";
import { getMetadataLimits } from "@appranks/shared";
import {
  Eye,
  Users,
  FileText,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Lock,
} from "lucide-react";

function computeRankChanges(rankings: any[], key: string) {
  const grouped = new Map<string, any[]>();
  for (const r of rankings) {
    if (r.position == null) continue;
    const k = r[key];
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(r);
  }
  const results: { label: string; position: number; delta: number }[] = [];
  for (const [, entries] of grouped) {
    entries.sort((a: any, b: any) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime());
    if (entries.length < 2) {
      results.push({ label: entries[0].keyword || entries[0].categoryTitle, position: entries[0].position, delta: 0 });
    } else {
      const delta = entries[1].position - entries[0].position;
      results.push({ label: entries[0].keyword || entries[0].categoryTitle, position: entries[0].position, delta });
    }
  }
  return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function computeListingHealth(snapshot: any, platform: string, app?: any) {
  if (!snapshot) return { completeness: 0, checks: [] };
  const limits = getMetadataLimits(platform);
  const checks: { label: string; status: "good" | "warning" | "missing"; detail: string }[] = [];

  // Title — name lives on the app object, not snapshot
  const titleLen = (app?.name || snapshot.name || "").length;
  if (titleLen > 0) {
    checks.push({
      label: "Title",
      status: limits.appName > 0 && titleLen > limits.appName * 0.9 ? "warning" : "good",
      detail: limits.appName > 0 ? `${titleLen}/${limits.appName} chars` : `${titleLen} chars`,
    });
  } else {
    checks.push({ label: "Title", status: "missing", detail: "Missing" });
  }

  // Subtitle — appCardSubtitle lives on the app object, not snapshot
  const subtitleLen = (app?.appCardSubtitle || snapshot.appCardSubtitle || "").length;
  if (subtitleLen > 0) {
    checks.push({
      label: "Subtitle",
      status: limits.subtitle > 0 && subtitleLen < limits.subtitle * 0.5 ? "warning" : "good",
      detail: limits.subtitle > 0 ? `${subtitleLen}/${limits.subtitle} chars` : `${subtitleLen} chars`,
    });
  } else if (limits.subtitle > 0) {
    checks.push({ label: "Subtitle", status: "missing", detail: "Missing" });
  }

  // Description
  const descLen = (snapshot.appDetails || "").length;
  if (descLen > 0) {
    checks.push({
      label: "Description",
      status: limits.details > 0 && descLen < limits.details * 0.3 ? "warning" : "good",
      detail: limits.details > 0 ? `${formatNumber(descLen)}/${formatNumber(limits.details)} chars` : `${formatNumber(descLen)} chars`,
    });
  } else {
    checks.push({ label: "Description", status: "missing", detail: "Missing" });
  }

  // Features
  const features = snapshot.features || snapshot.platformData?.features || [];
  if (features.length > 0) {
    checks.push({ label: "Features", status: "good", detail: `${features.length} listed` });
  } else {
    checks.push({ label: "Features", status: "missing", detail: "None" });
  }

  // SEO
  if (limits.seoTitle > 0) {
    const seoLen = (snapshot.seoTitle || "").length;
    if (seoLen > 0) {
      checks.push({ label: "SEO Title", status: "good", detail: `${seoLen}/${limits.seoTitle} chars` });
    } else {
      checks.push({ label: "SEO Title", status: "missing", detail: "Missing" });
    }
  }

  if (limits.seoMetaDescription > 0) {
    const metaLen = (snapshot.seoMetaDescription || "").length;
    if (metaLen > 0) {
      checks.push({ label: "SEO Description", status: "good", detail: `${metaLen}/${limits.seoMetaDescription} chars` });
    } else {
      checks.push({ label: "SEO Description", status: "missing", detail: "Missing" });
    }
  }

  const good = checks.filter((c) => c.status === "good").length;
  const completeness = checks.length > 0 ? Math.round((good / checks.length) * 100) : 0;

  return { completeness, checks };
}

export default async function V2DashboardPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { platform, slug } = await params;
  const caps = isPlatformId(platform) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const base = `/${platform}/apps/v2/${slug}`;

  // Round 1: parallel fetches
  let app: any;
  let scoresData: any;
  let scoresHistory: any;
  let rankings: any;
  let changes: any[];
  let reviewData: any;
  let featuredData: any;
  let adData: any;

  try {
    [app, scoresData, scoresHistory, rankings, changes, reviewData, featuredData, adData] = await Promise.all([
      getApp(slug, platform as PlatformId),
      getAppScores(slug, platform as PlatformId).catch(() => ({ visibility: [], power: [], weightedPowerScore: 0 })),
      getAppScoresHistory(slug, 7, undefined, platform as PlatformId).catch(() => ({ history: [] })),
      getAppRankings(slug, 30, platform as PlatformId).catch(() => ({})),
      getAppChanges(slug, 10, platform as PlatformId).catch(() => []),
      caps.hasReviews
        ? getAppReviews(slug, 5, 0, "newest", platform as PlatformId).catch(() => ({ reviews: [], total: 0, distribution: [] }))
        : Promise.resolve({ reviews: [], total: 0, distribution: [] }),
      caps.hasFeaturedSections
        ? getAppFeaturedPlacements(slug, 30, platform as PlatformId).catch(() => ({ sightings: [] }))
        : Promise.resolve({ sightings: [] }),
      caps.hasAdTracking
        ? getAppAdSightings(slug, 30, platform as PlatformId).catch(() => ({ sightings: [] }))
        : Promise.resolve({ sightings: [] }),
    ]);
  } catch {
    return <p className="text-muted-foreground">App not found.</p>;
  }

  // Round 2: tracked-only fetches
  let competitors: any[] = [];
  let keywords: any[] = [];
  if (app.isTrackedByAccount) {
    [competitors, keywords] = await Promise.all([
      getAppCompetitors(slug, platform as PlatformId).catch(() => []),
      getAppKeywords(slug, platform as PlatformId).catch(() => []),
    ]);
  }

  const snapshot = app.latestSnapshot;

  // Compute scores
  const bestVisibility = scoresData.visibility?.length > 0
    ? Math.max(...scoresData.visibility.map((v: any) => v.visibilityScore ?? 0))
    : null;
  const powerScore = scoresData.weightedPowerScore || null;

  // Compute score deltas from history
  const hist = scoresHistory?.history || [];
  let visDelta: number | null = null;
  let powDelta: number | null = null;
  if (hist.length >= 2) {
    const latest = hist[hist.length - 1];
    const oldest = hist[0];
    if (latest?.visibilityScore != null && oldest?.visibilityScore != null) {
      visDelta = Math.round(latest.visibilityScore - oldest.visibilityScore);
    }
    if (latest?.powerScore != null && oldest?.powerScore != null) {
      powDelta = Math.round(latest.powerScore - oldest.powerScore);
    }
  }

  // Keyword stats
  const kwRankings = rankings?.keywordRankings || [];
  const rankedKeywords = new Set(kwRankings.filter((r: any) => r.position != null).map((r: any) => r.keyword || r.keywordSlug));
  const positions = kwRankings.filter((r: any) => r.position != null).map((r: any) => r.position);
  const avgPosition = positions.length > 0 ? positions.reduce((s: number, p: number) => s + p, 0) / positions.length : null;
  const featuredCount = new Set((featuredData?.sightings || []).map((s: any) => s.sectionHandle || s.surface)).size;

  // Keyword movers
  const kwChanges = computeRankChanges(kwRankings, "keyword");
  const topMovers = kwChanges.filter((k) => k.delta !== 0).slice(0, 5);

  // Category rankings
  const catRankings = rankings?.categoryRankings || [];
  const catChanges = computeRankChanges(catRankings, "categorySlug");

  // Alerts
  const alerts = generateAlerts({ rankings, changes, featuredData, reviewData, adData, platform, slug });

  // Listing health
  const listingHealth = computeListingHealth(snapshot, platform, app);

  return (
    <div className="space-y-4">
      {/* Health Score Bar */}
      <HealthScoreBar
        visibilityScore={bestVisibility}
        visibilityDelta={visDelta}
        powerScore={powerScore}
        powerDelta={powDelta}
        keywordCount={rankedKeywords.size}
        avgPosition={avgPosition}
        featuredCount={featuredCount}
      />

      {/* Alerts */}
      <AlertsCard alerts={alerts} />

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Visibility Snapshot */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Visibility Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topMovers.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Top keyword movers</p>
                {topMovers.map((kw) => (
                  <div key={kw.label} className="flex items-center justify-between text-sm">
                    <span className="truncate">{kw.label}</span>
                    <span className="flex items-center gap-1 text-xs tabular-nums">
                      #{kw.position}
                      {kw.delta > 0 && <span className="text-emerald-600">▲{kw.delta}</span>}
                      {kw.delta < 0 && <span className="text-red-600">▼{Math.abs(kw.delta)}</span>}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No keyword ranking changes</p>
            )}
            {catChanges.length > 0 && (
              <div className="space-y-1 pt-2 border-t">
                <p className="text-xs text-muted-foreground font-medium">Category ranks</p>
                {catChanges.slice(0, 3).map((cat) => (
                  <div key={cat.label} className="flex items-center justify-between text-sm">
                    <span className="truncate">{cat.label}</span>
                    <span className="text-xs tabular-nums">
                      #{cat.position}
                      {cat.delta > 0 && <span className="text-emerald-600 ml-1">▲{cat.delta}</span>}
                      {cat.delta < 0 && <span className="text-red-600 ml-1">▼{Math.abs(cat.delta)}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link href={`${base}/visibility`} className="flex items-center gap-1 text-xs text-primary hover:underline pt-1">
              Go to Visibility <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Competitive Snapshot */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Competitive Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {app.isTrackedByAccount ? (
              <>
                <p className="text-sm">
                  vs <span className="font-medium">{competitors.length}</span> competitor{competitors.length !== 1 ? "s" : ""}
                </p>
                {competitors.length > 0 && (
                  <div className="space-y-1">
                    {competitors.slice(0, 4).map((c: any) => (
                      <div key={c.appSlug} className="flex items-center justify-between text-sm">
                        <span className="truncate">{c.appName}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {c.latestSnapshot?.averageRating != null && `${Number(c.latestSnapshot.averageRating).toFixed(1)}★`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <Link href={`${base}/intel/competitors`} className="flex items-center gap-1 text-xs text-primary hover:underline pt-1">
                  Go to Market Intel <ArrowRight className="h-3 w-3" />
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                Track this app to see competitors
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Listing Health */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Listing Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Completeness:</span>
              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${listingHealth.completeness}%` }}
                />
              </div>
              <span className="text-sm font-bold tabular-nums">{listingHealth.completeness}%</span>
            </div>
            <div className="flex items-center gap-3 text-xs flex-wrap">
              {listingHealth.checks.map((c) => (
                <span key={c.label} className="flex items-center gap-1">
                  {c.status === "good" && <span className="text-emerald-500">✓</span>}
                  {c.status === "warning" && <span className="text-amber-500">⚠</span>}
                  {c.status === "missing" && <span className="text-red-500">✗</span>}
                  {c.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2">
            {app.isTrackedByAccount && (
              <Link href={`${base}/studio`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                Go to Listing Studio <ArrowRight className="h-3 w-3" />
              </Link>
            )}
            <a
              href={`/audit/${platform}/${app.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              View Full Audit →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
