import type { KeywordSearchApp } from "./types/keyword.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopAppInfo {
  slug: string;
  name: string;
  logoUrl: string;
  rating: number;
  reviews: number;
  isBuiltForShopify: boolean;
}

export interface KeywordOpportunityStats {
  totalResults: number;
  organicCount: number;
  sponsoredCount: number;
  bfsCount: number;
  count1000: number;
  count100: number;
  top1Reviews: number;
  top4TotalReviews: number;
  top4AvgRating: number | null;
  firstPageTotalReviews: number;
  firstPageAvgRating: number | null;
  top1ReviewShare: number;
  top4ReviewShare: number;
}

export interface KeywordOpportunityScores {
  room: number;
  demand: number;
  organic: number;
  maturity: number;
  quality: number;
}

export interface KeywordOpportunityMetrics {
  opportunityScore: number;
  scores: KeywordOpportunityScores;
  stats: KeywordOpportunityStats;
  topApps: TopAppInfo[];
}

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

export const OPPORTUNITY_WEIGHTS = {
  room: 0.35,
  demand: 0.20,
  organic: 0.15,
  maturity: 0.10,
  quality: 0.20,
} as const;

// ---------------------------------------------------------------------------
// Normalization caps
// ---------------------------------------------------------------------------

const ROOM_CAP = 20_000;
const DEMAND_CAP = 1_000;
const MATURITY_APP_CAP = 12;
const PAGE_SIZE = 24;
const RATING_FLOOR = 3.5;
const RATING_CEIL = 5.0;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function computeKeywordOpportunity(
  results: KeywordSearchApp[],
  totalResults: number | null,
): KeywordOpportunityMetrics {
  // Separate organic vs sponsored/built-in
  const organic = results.filter(
    (r) => !r.is_sponsored && !r.is_built_in,
  );
  const sponsored = results.filter((r) => r.is_sponsored);

  const firstPage = organic.slice(0, PAGE_SIZE);
  const top4 = organic.slice(0, 4);
  const top8 = organic.slice(0, 8);
  const top1 = organic[0] ?? null;

  // Raw stats
  const firstPageTotalReviews = firstPage.reduce(
    (s, a) => s + (a.rating_count || 0),
    0,
  );
  const top4TotalReviews = top4.reduce(
    (s, a) => s + (a.rating_count || 0),
    0,
  );
  const top8TotalReviews = top8.reduce(
    (s, a) => s + (a.rating_count || 0),
    0,
  );
  const top1Reviews = top1?.rating_count || 0;

  const top4Ratings = top4.filter((a) => a.average_rating > 0);
  const top4AvgRating =
    top4Ratings.length > 0
      ? top4Ratings.reduce((s, a) => s + a.average_rating, 0) /
        top4Ratings.length
      : null;

  const firstPageRatings = firstPage.filter((a) => a.average_rating > 0);
  const firstPageAvgRating =
    firstPageRatings.length > 0
      ? firstPageRatings.reduce((s, a) => s + a.average_rating, 0) /
        firstPageRatings.length
      : null;

  const bfsCount = firstPage.filter((a) => a.is_built_for_shopify).length;
  const count1000 = firstPage.filter((a) => a.rating_count >= 1000).length;
  const count100 = firstPage.filter((a) => a.rating_count >= 100).length;

  const safeTotalResults = totalResults ?? 0;

  const top1ReviewShare =
    firstPageTotalReviews > 0 ? top1Reviews / firstPageTotalReviews : 0;
  const top4ReviewShare =
    firstPageTotalReviews > 0
      ? top4TotalReviews / firstPageTotalReviews
      : 0;

  const stats: KeywordOpportunityStats = {
    totalResults: safeTotalResults,
    organicCount: firstPage.length,
    sponsoredCount: sponsored.length,
    bfsCount,
    count1000,
    count100,
    top1Reviews,
    top4TotalReviews,
    top4AvgRating,
    firstPageTotalReviews,
    firstPageAvgRating,
    top1ReviewShare,
    top4ReviewShare,
  };

  // Score components
  const room = clamp01(1 - top8TotalReviews / ROOM_CAP);
  const demand = clamp01(safeTotalResults / DEMAND_CAP);
  const organicScore = clamp01(
    (PAGE_SIZE - sponsored.length) / PAGE_SIZE,
  );
  const maturity = 1 - clamp01(count1000 / MATURITY_APP_CAP);

  const bfsFactor = clamp01(1 - bfsCount / PAGE_SIZE);
  const ratingFactor =
    top4AvgRating == null
      ? 0.5
      : clamp01(1 - (top4AvgRating - RATING_FLOOR) / (RATING_CEIL - RATING_FLOOR));
  const quality = clamp01(bfsFactor * ratingFactor);

  const scores: KeywordOpportunityScores = {
    room,
    demand,
    organic: organicScore,
    maturity,
    quality,
  };

  const raw =
    OPPORTUNITY_WEIGHTS.room * room +
    OPPORTUNITY_WEIGHTS.demand * demand +
    OPPORTUNITY_WEIGHTS.organic * organicScore +
    OPPORTUNITY_WEIGHTS.maturity * maturity +
    OPPORTUNITY_WEIGHTS.quality * quality;

  const opportunityScore = Math.max(0, Math.min(100, Math.round(100 * raw)));

  // Top apps info (top 4 organic)
  const topApps: TopAppInfo[] = top4.map((a) => ({
    slug: a.app_slug,
    name: a.app_name,
    logoUrl: a.logo_url,
    rating: a.average_rating,
    reviews: a.rating_count,
    isBuiltForShopify: !!a.is_built_for_shopify,
  }));

  return { opportunityScore, scores, stats, topApps };
}
