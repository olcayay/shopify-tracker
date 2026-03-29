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
  getCategoriesBatch,
  getAppScores,
} from "@/lib/api";
import { DataFreshness } from "@/components/data-freshness";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";
import { computeRankingChanges } from "./utils";
import { ReviewPulseCard } from "./review-pulse-card";
import { KeywordPerformanceCard } from "./keyword-performance-card";
import { CategoryRankingsCard } from "./category-rankings-card";
import { CompetitorWatchCard } from "./competitor-watch-card";
import { CompetitorUpdatesCard, ListingChangesCard } from "./listing-changes-card";
import { AppScoresCard } from "./app-scores-card";
import { VisibilityDiscoveryCard } from "./visibility-discovery-card";

export default async function AppOverviewPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { platform, slug } = await params;
  const caps = isPlatformId(platform) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;

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
  let scoresData: any;

  try {
    [app, reviewData, rankings, changes, reviewMetrics, featuredData, adData, similarData, selfMinPaidPriceMap, scoresData] =
      await Promise.all([
        getApp(slug, platform as PlatformId),
        caps.hasReviews
          ? getAppReviews(slug, 3, 0, "newest", platform as PlatformId).catch(() => ({ reviews: [], total: 0, distribution: [] }))
          : Promise.resolve({ reviews: [], total: 0, distribution: [] }),
        getAppRankings(slug, 30, platform as PlatformId).catch(() => ({})),
        getAppChanges(slug, 10, platform as PlatformId).catch(() => []),
        caps.hasReviews
          ? getAppReviewMetrics(slug, platform as PlatformId).catch(() => null)
          : Promise.resolve(null),
        caps.hasFeaturedSections
          ? getAppFeaturedPlacements(slug, 30, platform as PlatformId).catch(() => ({ sightings: [] }))
          : Promise.resolve({ sightings: [] }),
        caps.hasAdTracking
          ? getAppAdSightings(slug, 30, platform as PlatformId).catch(() => ({ sightings: [] }))
          : Promise.resolve({ sightings: [] }),
        caps.hasSimilarApps
          ? getAppSimilarApps(slug, 30, platform as PlatformId).catch(() => ({ direct: [], reverse: [], secondDegree: [] }))
          : Promise.resolve({ direct: [], reverse: [], secondDegree: [] }),
        caps.hasPricing
          ? getAppsMinPaidPrices([slug], platform as PlatformId).catch(() => ({}))
          : Promise.resolve({}),
        getAppScores(slug, platform as PlatformId).catch(() => ({ visibility: [], power: [], weightedPowerScore: 0 })),
      ]);
  } catch {
    return <p className="text-muted-foreground">App not found.</p>;
  }

  // Category ranking changes (computed early for category leader fetches)
  const catRankings = rankings?.categoryRankings || [];
  const catChanges = computeRankingChanges(catRankings, "categorySlug", "categoryTitle");

  // Round 2: tracked-only fetches + batch category leaders (all parallel, no Round 3 needed)
  let competitors: any[] = [];
  let keywords: any[] = [];
  const categoryInfoMap = new Map<string, { leaders: any[]; appCount: number | null }>();

  const catSlugs = catChanges.map((c) => c.slug);
  await Promise.all([
    ...(app.isTrackedByAccount
      ? [
          getAppCompetitors(slug, platform as PlatformId, true).catch(() => []).then((c: any[]) => { competitors = c; }),
          getAppKeywords(slug, platform as PlatformId).catch(() => []).then((k: any[]) => { keywords = k; }),
        ]
      : []),
    ...(catSlugs.length > 0
      ? [
          getCategoriesBatch(catSlugs, platform as PlatformId)
            .then((batchData) => {
              for (const [catSlug, info] of Object.entries(batchData || {})) {
                categoryInfoMap.set(catSlug, info);
              }
            })
            .catch(() => {}),
        ]
      : []),
  ]);

  // Competitor changes extracted from competitors response (includeChanges=true eliminates Round 3)
  let competitorChanges: any[] = [];
  if (competitors.length > 0) {
    competitorChanges = competitors
      .slice(0, 10)
      .flatMap((c: any) =>
        (c.recentChanges || []).map((ch: any) => ({
          ...ch,
          competitorName: c.appName || c.appSlug,
          competitorSlug: c.appSlug,
          competitorIcon: c.iconUrl,
        }))
      )
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  }

  const isTracked = app.isTrackedByAccount;

  // === Business Logic ===

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
  const featuredSections = [...new Set<string>((featuredData?.sightings || []).map((s: any) => s.sectionTitle))];

  // Ad keywords dedup
  const adKeywords = [...new Set<string>((adData?.sightings || []).map((s: any) => s.keyword))];

  // Reverse similar count
  const reverseSimilarSlugs = [...new Set<string>((similarData?.reverse || []).map((s: any) => s.slug))];

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

  // Grouped competitor changes (combine same-app field updates into one row)
  const groupedCompChanges: {
    competitorName: string;
    competitorSlug: string;
    competitorIcon: string | null;
    fields: string[];
    latestDate: string;
  }[] = [];

  if (showCompetitorChanges) {
    const compMap = new Map<string, (typeof groupedCompChanges)[0]>();
    for (const c of competitorChanges) {
      const existing = compMap.get(c.competitorSlug);
      if (existing) {
        if (!existing.fields.includes(c.field)) existing.fields.push(c.field);
        if (new Date(c.detectedAt) > new Date(existing.latestDate)) {
          existing.latestDate = c.detectedAt;
        }
      } else {
        compMap.set(c.competitorSlug, {
          competitorName: c.competitorName,
          competitorSlug: c.competitorSlug,
          competitorIcon: c.competitorIcon,
          fields: [c.field],
          latestDate: c.detectedAt,
        });
      }
    }
    groupedCompChanges.push(...compMap.values());
    groupedCompChanges.sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());
  }

  // Review velocity
  const v7d = reviewMetrics?.v7d ?? null;
  const v30d = reviewMetrics?.v30d ?? null;
  const v90d = reviewMetrics?.v90d ?? null;
  const momentum = reviewMetrics?.momentum ?? null;

  const totalVisibility =
    (caps.hasFeaturedSections ? featuredSections.length : 0) +
    (caps.hasAdTracking ? adKeywords.length : 0) +
    (caps.hasSimilarApps ? reverseSimilarSlugs.length : 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="lg:col-span-2">
        <DataFreshness dateStr={app.latestSnapshot?.scrapedAt} />
      </div>
      {/* Card 1: Review Pulse */}
      {caps.hasReviews && (
        <ReviewPulseCard
          platform={platform}
          slug={slug}
          reviewData={reviewData}
          v7d={v7d}
          v30d={v30d}
          v90d={v90d}
          momentum={momentum}
          distribution={distribution}
          maxDistCount={maxDistCount}
          maxRatingStars={caps.maxRatingStars}
        />
      )}

      {/* Card 2: Keyword Performance (tracked only) */}
      {isTracked && (
        <KeywordPerformanceCard
          platform={platform}
          slug={slug}
          keywords={keywords}
          rankedKeywordCount={rankedKeywordCount}
          kwMovers={kwMovers}
          topKeywords={topKeywords}
        />
      )}

      {/* Card 3: Category Rankings */}
      <CategoryRankingsCard
        platform={platform}
        slug={slug}
        catChanges={catChanges}
        categoryInfoMap={categoryInfoMap}
      />

      {/* Card 4: Competitor Watch (tracked only) */}
      {isTracked && (
        <CompetitorWatchCard
          platform={platform}
          slug={slug}
          competitors={competitors}
          allWithSelf={allWithSelf}
          selfRatingPos={selfRatingPos}
          selfReviewsPos={selfReviewsPos}
          selfPricePos={selfPricePos}
          caps={{ hasReviews: caps.hasReviews, hasPricing: caps.hasPricing }}
        />
      )}

      {/* Card 5: Listing Changes / Competitor Updates */}
      {showCompetitorChanges ? (
        <CompetitorUpdatesCard
          platform={platform}
          slug={slug}
          groupedCompChanges={groupedCompChanges}
        />
      ) : (
        <ListingChangesCard
          platform={platform}
          slug={slug}
          changes={changes}
          todayChanges={todayChanges}
          weekChanges={weekChanges}
          earlierChanges={earlierChanges}
        />
      )}

      {/* Card 6: App Scores */}
      <AppScoresCard
        scoresData={scoresData}
        caps={{ hasReviews: caps.hasReviews }}
      />

      {/* Card 7: Visibility & Discovery */}
      <VisibilityDiscoveryCard
        platform={platform}
        slug={slug}
        totalVisibility={totalVisibility}
        featuredSections={featuredSections}
        adKeywords={adKeywords}
        reverseSimilarSlugs={reverseSimilarSlugs}
        caps={{ hasFeaturedSections: caps.hasFeaturedSections, hasAdTracking: caps.hasAdTracking, hasSimilarApps: caps.hasSimilarApps }}
      />
    </div>
  );
}
