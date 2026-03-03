/**
 * App Visibility Score - measures how discoverable an app is across Shopify's
 * search and browsing surfaces.
 *
 * Uses a page-boundary decay model: Shopify shows 24 apps per page, so rank 25
 * is worth dramatically less than rank 24 (page turn friction).
 */

export const PAGE_SIZE = 24;
export const PAGE_DECAY = 0.3;

export interface KeywordRankingInput {
  /** The keyword's totalResults (proxy for search volume) */
  totalResults: number;
  /** The app's rank position for this keyword (1-based) */
  position: number;
}

export interface VisibilityResult {
  /** Number of keywords the app ranks for */
  keywordCount: number;
  /** Raw visibility sum before normalization */
  visibilityRaw: number;
}

/**
 * Compute the rank weight for a given position, accounting for page boundaries.
 *
 * rank_weight = (1 / log2(rank + 1)) * PAGE_DECAY^page
 */
export function computeRankWeight(position: number): number {
  const page = Math.floor((position - 1) / PAGE_SIZE);
  const pagePenalty = Math.pow(PAGE_DECAY, page);
  return (1 / Math.log2(position + 1)) * pagePenalty;
}

/**
 * Compute the raw visibility score for an app based on its keyword rankings.
 *
 * visibility_raw = SUM(totalResults * rank_weight) for all ranked keywords
 */
export function computeAppVisibility(rankings: KeywordRankingInput[]): VisibilityResult {
  let visibilityRaw = 0;
  let keywordCount = 0;

  for (const r of rankings) {
    if (r.position < 1 || r.totalResults <= 0) continue;
    const rankWeight = computeRankWeight(r.position);
    visibilityRaw += r.totalResults * rankWeight;
    keywordCount++;
  }

  return {
    keywordCount,
    visibilityRaw: Math.round(visibilityRaw * 10000) / 10000,
  };
}

/**
 * Normalize a raw visibility value to 0-100 relative to the max in the category.
 */
export function normalizeScore(raw: number, maxRaw: number): number {
  if (maxRaw <= 0) return 0;
  return Math.round(100 * (raw / maxRaw));
}
