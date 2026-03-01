import Link from "next/link";
import {
  getApp,
  getAppReviews,
  getAppRankings,
  getAppChanges,
  getAppCompetitors,
  getAppKeywords,
  getAppReviewMetrics,
  getAppFeaturedPlacements,
  getAppAdSightings,
  getAppSimilarApps,
  getAppsMinPaidPrices,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { MomentumBadge } from "@/components/momentum-badge";
import {
  MessageSquare,
  Search,
  Trophy,
  Users,
  History,
  Eye,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Megaphone,
  Star,
  Minus,
} from "lucide-react";

// --- Helper functions ---

function relativeDate(dateStr: string): string {
  const date = new Date(
    /[Zz]$/.test(dateStr) || /[+-]\d{2}(:\d{2})?$/.test(dateStr)
      ? dateStr
      : dateStr.replace(" ", "T") + "Z"
  );
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function computeRankingChanges(
  rankings: any[],
  slugKey: string,
  labelKey: string,
): { slug: string; label: string; position: number; prevPosition: number | null; delta: number }[] {
  const grouped = new Map<string, any[]>();
  for (const r of rankings) {
    if (r.position == null || r.position <= 0) continue;
    const key = r[slugKey];
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }
  const results: { slug: string; label: string; position: number; prevPosition: number | null; delta: number }[] = [];
  for (const [key, entries] of grouped) {
    entries.sort((a: any, b: any) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime());
    const latest = entries[0];
    const prev = entries.length > 1 ? entries[1] : null;
    const delta = prev ? prev.position - latest.position : 0;
    results.push({
      slug: key,
      label: latest[labelKey],
      position: latest.position,
      prevPosition: prev?.position ?? null,
      delta,
    });
  }
  return results;
}

const FIELD_LABELS: Record<string, string> = {
  name: "App Name",
  appIntroduction: "Introduction",
  appDetails: "Details",
  features: "Features",
  seoTitle: "SEO Title",
  seoMetaDescription: "SEO Description",
  appCardSubtitle: "Subtitle",
};

const FIELD_COLORS: Record<string, string> = {
  name: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  appIntroduction: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  appDetails: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
  features: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  seoTitle: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  seoMetaDescription: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  appCardSubtitle: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300",
};

export default async function AppOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Round 1: parallel fetches (all apps)
  let app: any;
  let reviewData: any;
  let rankings: any;
  let changes: any[];
  let reviewMetrics: any;
  let featuredData: any;
  let adData: any;
  let similarData: any;
  let selfMinPaidPriceMap: Record<string, number | null>;

  try {
    [app, reviewData, rankings, changes, reviewMetrics, featuredData, adData, similarData, selfMinPaidPriceMap] =
      await Promise.all([
        getApp(slug),
        getAppReviews(slug, 3).catch(() => ({ reviews: [], total: 0, distribution: [] })),
        getAppRankings(slug).catch(() => ({})),
        getAppChanges(slug, 10).catch(() => []),
        getAppReviewMetrics(slug).catch(() => null),
        getAppFeaturedPlacements(slug).catch(() => ({ sightings: [] })),
        getAppAdSightings(slug).catch(() => ({ sightings: [] })),
        getAppSimilarApps(slug).catch(() => ({ direct: [], reverse: [], secondDegree: [] })),
        getAppsMinPaidPrices([slug]).catch(() => ({})),
      ]);
  } catch {
    return <p className="text-muted-foreground">App not found.</p>;
  }

  // Round 2: tracked-only fetches
  let competitors: any[] = [];
  let keywords: any[] = [];
  if (app.isTrackedByAccount) {
    [competitors, keywords] = await Promise.all([
      getAppCompetitors(slug).catch(() => []),
      getAppKeywords(slug).catch(() => []),
    ]);
  }

  // Round 3: competitor changes (need competitor slugs from Round 2)
  let competitorChanges: any[] = [];
  if (competitors.length > 0) {
    const changeBatches = await Promise.all(
      competitors.slice(0, 10).map((c: any) =>
        getAppChanges(c.appSlug, 3)
          .then((arr: any[]) =>
            arr.map((ch) => ({
              ...ch,
              competitorName: c.appName || c.appSlug,
              competitorSlug: c.appSlug,
              competitorIcon: c.iconUrl,
            }))
          )
          .catch(() => [])
      )
    );
    competitorChanges = changeBatches
      .flat()
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  }

  const isTracked = app.isTrackedByAccount;

  // === Business Logic ===

  // Category ranking changes
  const catRankings = rankings?.categoryRankings || [];
  const catChanges = computeRankingChanges(catRankings, "categorySlug", "categoryTitle");

  // Keyword ranking changes (filtered to valid positions in computeRankingChanges)
  const kwRankings = rankings?.keywordRankings || [];
  const kwChanges = computeRankingChanges(kwRankings, "keywordSlug", "keyword");

  // Keywords ranked count — use kwChanges (from rankings time-series) since
  // getAppKeywords doesn't populate rankings without appSlugs param
  const rankedKeywordCount = kwChanges.length;

  // Keyword movers (top 3 by absolute delta)
  const kwMovers = [...kwChanges]
    .filter((k) => k.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  // Top keyword positions (top 3 best-ranked)
  const topKeywords = [...kwChanges]
    .sort((a, b) => a.position - b.position)
    .slice(0, 3);

  // Competitor ranking — by rating, by reviews, by price
  const selfRating = parseFloat(app.latestSnapshot?.averageRating) || 0;
  const selfReviews = app.latestSnapshot?.ratingCount || 0;
  const selfMinPaidPrice = selfMinPaidPriceMap[slug] ?? null;

  const allWithSelf = [
    { slug: app.slug, name: app.name, iconUrl: app.iconUrl, rating: selfRating, reviews: selfReviews, minPaidPrice: selfMinPaidPrice, isSelf: true },
    ...competitors.map((c: any) => ({
      slug: c.appSlug,
      name: c.appName || c.appSlug,
      iconUrl: c.iconUrl,
      rating: parseFloat(c.latestSnapshot?.averageRating) || 0,
      reviews: c.latestSnapshot?.ratingCount || 0,
      minPaidPrice: (c.minPaidPrice as number | null) ?? null,
      isSelf: false,
    })),
  ];

  const byRating = [...allWithSelf].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  const selfRatingPos = byRating.findIndex((c) => c.isSelf) + 1;

  const byReviewCount = [...allWithSelf].sort((a, b) => b.reviews - a.reviews || b.rating - a.rating);
  const selfReviewsPos = byReviewCount.findIndex((c) => c.isSelf) + 1;

  const withPrice = allWithSelf.filter((c) => c.minPaidPrice != null && c.minPaidPrice > 0);
  const byPrice = [...withPrice].sort((a, b) => a.minPaidPrice! - b.minPaidPrice!);
  const selfPricePos = byPrice.findIndex((c) => c.isSelf) + 1;

  // Featured sections dedup
  const featuredSections = [...new Set((featuredData?.sightings || []).map((s: any) => s.sectionTitle))];

  // Ad keywords dedup
  const adKeywords = [...new Set((adData?.sightings || []).map((s: any) => s.keyword))];

  // Reverse similar count
  const reverseSimilarSlugs = [...new Set((similarData?.reverse || []).map((s: any) => s.slug))];

  // Review distribution
  const distribution: { rating: number; count: number }[] = reviewData?.distribution || [];
  const maxDistCount = Math.max(...distribution.map((d) => d.count), 1);

  // Change grouping (for competitor changes or own changes)
  const changesToShow = isTracked && competitorChanges.length > 0 ? competitorChanges : changes;
  const showCompetitorChanges = isTracked && competitorChanges.length > 0;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const oneWeekAgo = new Date(startOfToday);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const todayChanges: any[] = [];
  const weekChanges: any[] = [];
  const earlierChanges: any[] = [];
  for (const c of changesToShow.slice(0, 5)) {
    const d = new Date(c.detectedAt);
    if (d >= startOfToday) todayChanges.push(c);
    else if (d >= oneWeekAgo) weekChanges.push(c);
    else earlierChanges.push(c);
  }

  // Review velocity
  const v7d = reviewMetrics?.v7d ?? null;
  const v30d = reviewMetrics?.v30d ?? null;
  const v90d = reviewMetrics?.v90d ?? null;
  const momentum = reviewMetrics?.momentum ?? null;

  const totalVisibility = featuredSections.length + adKeywords.length + reverseSimilarSlugs.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Card 1: Review Pulse */}
      <Link href={`/apps/${slug}/reviews`} className="group">
        <Card className="h-full transition-colors group-hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Review Pulse
            </CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardHeader>
          <CardContent>
            {reviewData?.total > 0 || v7d || v30d || v90d ? (
              <div className="space-y-4">
                {/* Velocity strip + momentum */}
                <div className="flex gap-3">
                  {[
                    { label: "7d", value: v7d },
                    { label: "30d", value: v30d },
                    { label: "90d", value: v90d },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex-1 rounded-md bg-muted/50 px-3 py-2 text-center">
                      <div className={`text-lg font-semibold ${value && value > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                        {value != null ? `+${value}` : "\u2014"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{label}</div>
                    </div>
                  ))}
                  <div className="flex items-center">
                    <MomentumBadge momentum={momentum} />
                  </div>
                </div>

                {/* Mini rating distribution */}
                {distribution.length > 0 && (
                  <div className="space-y-1">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const d = distribution.find((x) => x.rating === star);
                      const count = d?.count || 0;
                      const pct = (count / maxDistCount) * 100;
                      return (
                        <div key={star} className="flex items-center gap-2 text-xs">
                          <span className="w-3 text-right text-muted-foreground">{star}</span>
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-muted-foreground">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Latest reviews */}
                {reviewData.reviews.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {reviewData.reviews.slice(0, 3).map((r: any, i: number) => (
                      <div key={i} className="text-sm">
                        <div className="flex items-center gap-1.5">
                          <span className="text-yellow-500 text-xs">
                            {"\u2605".repeat(r.rating)}{"\u2606".repeat(5 - r.rating)}
                          </span>
                          <span className="text-muted-foreground text-xs font-medium">{r.reviewerName}</span>
                          <span className="text-muted-foreground/60 text-xs">{"\u00B7"}</span>
                          <span className="text-muted-foreground/60 text-xs">{relativeDate(r.reviewDate)}</span>
                        </div>
                        <p className="text-muted-foreground line-clamp-1 text-xs mt-0.5">{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <p className="text-xs text-muted-foreground pt-1">
                  View all {reviewData.total} reviews {"\u2192"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Reviews appear here automatically as they&apos;re collected
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Card 2: Keyword Performance (tracked only) */}
      {isTracked && (
        <Link href={`/apps/${slug}/keywords`} className="group">
          <Card className="h-full transition-colors group-hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                Keyword Performance
              </CardTitle>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              {keywords.length > 0 ? (
                <div className="space-y-3">
                  {/* Header stat */}
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{rankedKeywordCount}</span>{" "}
                    of {keywords.length} keywords ranked
                  </p>

                  {/* Movers */}
                  {kwMovers.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Movers</p>
                      <div className="space-y-1">
                        {kwMovers.map((kw) => (
                          <div key={kw.slug} className="flex items-center justify-between text-sm">
                            <span className="truncate">{kw.label}</span>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <Badge variant="secondary" className="text-xs">#{kw.position}</Badge>
                              {kw.delta > 0 ? (
                                <span className="flex items-center text-xs text-green-600 dark:text-green-400">
                                  <ArrowUpRight className="h-3 w-3" />+{kw.delta}
                                </span>
                              ) : (
                                <span className="flex items-center text-xs text-red-600 dark:text-red-400">
                                  <ArrowDownRight className="h-3 w-3" />{kw.delta}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Positions */}
                  {topKeywords.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Top Positions</p>
                      <div className="space-y-1">
                        {topKeywords.map((kw) => (
                          <div key={kw.slug} className="flex items-center justify-between text-sm">
                            <span className="truncate">{kw.label}</span>
                            <Badge variant="secondary" className="ml-2 shrink-0 text-xs">#{kw.position}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <p className="text-xs text-muted-foreground pt-1">Manage keywords {"\u2192"}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Search className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Track keywords to monitor your search visibility
                  </p>
                  <span className={buttonVariants({ size: "sm", variant: "outline" })}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Your First Keywords
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Card 3: Category Rankings */}
      <Link href={`/apps/${slug}/rankings`} className="group">
        <Card className="h-full transition-colors group-hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              Category Rankings
            </CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardHeader>
          <CardContent>
            {catChanges.length > 0 ? (
              <div className="space-y-2">
                {catChanges.map((cat) => (
                  <div key={cat.slug} className="flex items-center justify-between text-sm">
                    <span className="truncate text-muted-foreground">{cat.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <Badge variant="secondary">#{cat.position}</Badge>
                      {cat.delta > 0 ? (
                        <ArrowUpRight className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      ) : cat.delta < 0 ? (
                        <ArrowDownRight className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      ) : (
                        <Minus className="h-3.5 w-3.5 text-muted-foreground/50" />
                      )}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-1">View full rankings {"\u2192"}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Trophy className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Category rankings will appear here once data is collected
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Card 4: Competitor Watch (tracked only) */}
      {isTracked && (
        <Link href={`/apps/${slug}/competitors`} className="group">
          <Card className="h-full transition-colors group-hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Competitor Watch
              </CardTitle>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              {competitors.length > 0 ? (
                <div className="space-y-3">
                  {/* Header stat */}
                  <p className="text-sm text-muted-foreground">
                    Tracking{" "}
                    <span className="font-semibold text-foreground">{competitors.length}</span>{" "}
                    competitor{competitors.length !== 1 ? "s" : ""}
                  </p>

                  {/* Your position — multi-metric */}
                  <div className={`grid gap-2 ${selfPricePos > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
                    <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                      <div className="text-sm font-semibold">{ordinal(selfRatingPos)}</div>
                      <div className="text-[10px] text-muted-foreground">by rating</div>
                    </div>
                    <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                      <div className="text-sm font-semibold">{ordinal(selfReviewsPos)}</div>
                      <div className="text-[10px] text-muted-foreground">by reviews</div>
                    </div>
                    {selfPricePos > 0 && (
                      <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                        <div className="text-sm font-semibold">{ordinal(selfPricePos)}</div>
                        <div className="text-[10px] text-muted-foreground">cheapest</div>
                      </div>
                    )}
                  </div>

                  {/* Competitor list */}
                  <div className="space-y-1.5">
                    {allWithSelf.filter((c) => !c.isSelf).slice(0, 5).map((c) => (
                      <div key={c.slug} className="flex items-center gap-2 text-sm">
                        {c.iconUrl ? (
                          <img src={c.iconUrl} alt="" className="h-5 w-5 rounded shrink-0" />
                        ) : (
                          <div className="h-5 w-5 rounded bg-muted shrink-0" />
                        )}
                        <span className="truncate flex-1">{c.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 inline align-text-bottom" />{" "}
                          {c.rating.toFixed(1)} {"\u00B7"} {c.reviews}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <p className="text-xs text-muted-foreground pt-1">View all competitors {"\u2192"}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Add competitors to see how you stack up
                  </p>
                  <span className={buttonVariants({ size: "sm", variant: "outline" })}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Your First Competitors
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Card 5: Listing Changes — shows competitor updates for tracked apps, own changes otherwise */}
      <Link href={`/apps/${slug}/changes`} className="group">
        <Card className="h-full transition-colors group-hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              {showCompetitorChanges ? "Competitor Updates" : "Listing Changes"}
            </CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardHeader>
          <CardContent>
            {changesToShow.length > 0 ? (
              <div className="space-y-3">
                {todayChanges.length > 0 && (
                  <ChangeGroup label="Today" items={todayChanges} showCompetitor={showCompetitorChanges} />
                )}
                {weekChanges.length > 0 && (
                  <ChangeGroup label="This Week" items={weekChanges} showCompetitor={showCompetitorChanges} />
                )}
                {earlierChanges.length > 0 && (
                  <ChangeGroup label="Earlier" items={earlierChanges} showCompetitor={showCompetitorChanges} />
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  {showCompetitorChanges ? "View all competitors" : "View all changes"} {"\u2192"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <History className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  {showCompetitorChanges ? "No competitor updates yet" : "No changes detected yet"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {showCompetitorChanges
                    ? "We monitor your competitors for listing updates."
                    : "We monitor your listing for any updates."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Card 6: Visibility & Discovery */}
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            Visibility &amp; Discovery
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalVisibility > 0 ? (
            <div className="space-y-3">
              {/* Featured */}
              <Link
                href={`/apps/${slug}/featured`}
                className="block rounded-md p-2 -mx-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Star className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>
                    Seen in{" "}
                    <span className="font-semibold">{featuredSections.length}</span>{" "}
                    editorial section{featuredSections.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {featuredSections.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5 ml-6 truncate">
                    {featuredSections.slice(0, 3).join(", ")}
                    {featuredSections.length > 3 ? ` +${featuredSections.length - 3} more` : ""}
                  </p>
                )}
              </Link>

              {/* Search Ads */}
              <Link
                href={`/apps/${slug}/ads`}
                className="block rounded-md p-2 -mx-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Megaphone className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>
                    Advertising on{" "}
                    <span className="font-semibold">{adKeywords.length}</span>{" "}
                    keyword{adKeywords.length !== 1 ? "s" : ""}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">Ad</Badge>
                </div>
                {adKeywords.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5 ml-6 truncate">
                    {adKeywords.slice(0, 3).join(", ")}
                    {adKeywords.length > 3 ? ` +${adKeywords.length - 3} more` : ""}
                  </p>
                )}
              </Link>

              {/* Similar Apps */}
              <Link
                href={`/apps/${slug}/similar`}
                className="block rounded-md p-2 -mx-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-purple-500 shrink-0" />
                  <span>
                    Listed as similar by{" "}
                    <span className="font-semibold">{reverseSimilarSlugs.length}</span>{" "}
                    app{reverseSimilarSlugs.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Eye className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                We&apos;re tracking your app&apos;s visibility across the Shopify App Store
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Sub-components ---

function ChangeGroup({ label, items, showCompetitor }: { label: string; items: any[]; showCompetitor: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      <div className="space-y-1.5">
        {items.map((c: any) => (
          <div key={c.id} className="flex items-center gap-2 text-sm">
            {showCompetitor && (
              <>
                {c.competitorIcon ? (
                  <img src={c.competitorIcon} alt="" className="h-4 w-4 rounded shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded bg-muted shrink-0" />
                )}
                <span className="text-xs font-medium truncate max-w-[120px]">{c.competitorName}</span>
              </>
            )}
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${
                FIELD_COLORS[c.field] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {FIELD_LABELS[c.field] || c.field}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">{relativeDate(c.detectedAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
