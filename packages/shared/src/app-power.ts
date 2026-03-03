/**
 * App Power Score - measures overall market authority and competitive strength.
 *
 * Components:
 * 1. Rating Score (weight 0.35) - ((rating - 3) / 2) ^ 1.5, floor at 3.0
 * 2. Review Authority (weight 0.25) - log10(ratingCount + 1), normalized per category
 * 3. Category Rank Score (weight 0.25) - sqrt(1/log2(position+1)) * page_penalty
 * 4. Momentum (weight 0.15) - review acceleration (accMacro)
 */

import { PAGE_SIZE, PAGE_DECAY } from "./app-visibility.js";

export const POWER_WEIGHTS = {
  rating: 0.35,
  review: 0.25,
  category: 0.25,
  momentum: 0.15,
};

export interface CategoryRankInput {
  /** App's rank position in this category (1-based) */
  position: number;
  /** Total number of apps in this category */
  totalApps: number;
}

export interface PowerInput {
  /** App's average rating (0-5) */
  averageRating: number | null;
  /** App's total review count */
  ratingCount: number | null;
  /** Category rankings (max 2) */
  categoryRankings: CategoryRankInput[];
  /** Review acceleration (accMacro from appReviewMetrics) */
  accMacro: number | null;
}

export interface PowerComponents {
  ratingScore: number;
  reviewScore: number;
  categoryScore: number;
  momentumScore: number;
  powerRaw: number;
}

/** Page decay specific to power scoring (softer than visibility's 0.3) */
const POWER_PAGE_DECAY = 0.5;

/**
 * Compute the category rank score for a single category.
 *
 * rankWeight = sqrt(1 / log2(position + 1))  — softened logarithmic decay
 * pagePenalty = POWER_PAGE_DECAY ^ floor((position-1) / PAGE_SIZE)
 * score = rankWeight * pagePenalty             — always in [0, 1]
 */
export function computeCategoryRankScore(input: CategoryRankInput): number {
  if (input.totalApps <= 0 || input.position < 1) return 0;
  if (input.position > input.totalApps) return 0;

  const rankWeight = Math.sqrt(1 / Math.log2(input.position + 1));
  const page = Math.floor((input.position - 1) / PAGE_SIZE);
  const pagePenalty = Math.pow(POWER_PAGE_DECAY, page);

  return rankWeight * pagePenalty;
}

/**
 * Compute the raw power score components for an app.
 *
 * Note: reviewScore is NOT normalized here - caller must divide by
 * log10(maxReviewsInCategory + 1) and momentumScore must be normalized
 * by caller dividing by maxAccMacro in category.
 */
export function computeAppPower(
  input: PowerInput,
  maxReviewsInCategory: number,
  maxAccMacroInCategory: number,
): PowerComponents {
  // Component 1: Rating (0-1), shifted range with floor at 3.0
  const ratingScore = input.averageRating != null
    ? Math.pow(Math.max((input.averageRating - 3) / 2, 0), 1.5)
    : 0;

  // Component 2: Review authority (log scale, normalized per category)
  const rawReview = Math.log10((input.ratingCount ?? 0) + 1);
  const maxReview = Math.log10(maxReviewsInCategory + 1);
  const reviewScore = maxReview > 0 ? rawReview / maxReview : 0;

  // Component 3: Category rank (best of up to 2 categories, weighted)
  let categoryScore = 0;
  if (input.categoryRankings.length === 1) {
    categoryScore = computeCategoryRankScore(input.categoryRankings[0]);
  } else if (input.categoryRankings.length >= 2) {
    const scores = input.categoryRankings.map(computeCategoryRankScore);
    scores.sort((a, b) => b - a);
    categoryScore = 0.7 * scores[0] + 0.3 * scores[1];
  }

  // Component 4: Momentum (review acceleration, normalized per category)
  let momentumScore = 0;
  if (input.accMacro != null && maxAccMacroInCategory > 0) {
    // Clamp to [0, 1] range: negative acceleration = 0 momentum
    momentumScore = Math.max(0, Math.min(input.accMacro / maxAccMacroInCategory, 1));
  }

  // Weighted sum
  const powerRaw =
    POWER_WEIGHTS.rating * ratingScore +
    POWER_WEIGHTS.review * reviewScore +
    POWER_WEIGHTS.category * categoryScore +
    POWER_WEIGHTS.momentum * momentumScore;

  return {
    ratingScore: round4(ratingScore),
    reviewScore: round4(reviewScore),
    categoryScore: round4(categoryScore),
    momentumScore: round4(momentumScore),
    powerRaw: round4(powerRaw),
  };
}

/**
 * Compute a weighted aggregate power score across multiple categories.
 * Weight = category size (appCount), so larger categories contribute more.
 */
export function computeWeightedPowerScore(
  inputs: { powerScore: number; appCount: number }[],
): number {
  if (inputs.length === 0) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const { powerScore, appCount } of inputs) {
    const weight = Math.max(appCount, 1);
    weightedSum += powerScore * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
