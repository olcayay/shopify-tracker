/**
 * Event detection module.
 * Compares current vs previous scraper state and returns detected events.
 * Each function is pure: takes data in, returns events out.
 */
import { createLogger } from "@appranks/shared";

const log = createLogger("event-detector");

// ── Types ───────────────────────────────────────────────────────────

export type EventSeverity = "info" | "warning" | "critical";

export interface DetectedEvent {
  type: string;
  appId: number;
  platform: string;
  severity: EventSeverity;
  data: Record<string, unknown>;
}

export interface RankingSnapshot {
  keywordId: number;
  keywordSlug: string;
  keyword: string;
  position: number | null; // null = not ranked
}

export interface CategoryRankingSnapshot {
  categorySlug: string;
  categoryName: string;
  position: number;
}

export interface CompetitorSnapshot {
  appId: number;
  appSlug: string;
  appName: string;
  averageRating: number | null;
  ratingCount: number | null;
  isFeatured: boolean;
  pricingHint: string | null;
  /** Shared keyword positions: { keywordSlug: position } */
  keywordPositions: Record<string, number | null>;
}

export interface ReviewSnapshot {
  id: number;
  rating: number;
  reviewerName: string | null;
  content: string | null;
  reviewDate: string | null;
}

export interface AppMetrics {
  averageRating: number | null;
  ratingCount: number | null;
  reviewVelocity7d: number | null;
}

// ── Configurable thresholds ─────────────────────────────────────────

export interface EventThresholds {
  /** Minimum position change to trigger "significant_change" (default: 5) */
  significantRankChange: number;
  /** Minimum category position change to trigger alert (default: 3) */
  categoryRankChange: number;
  /** Review count thresholds for milestones */
  reviewMilestones: number[];
  /** Rating thresholds for milestones */
  ratingMilestones: number[];
  /** Min reviews in 24h for competitor review surge (default: 10) */
  competitorReviewSurge: number;
  /** Min review velocity (7d) increase to trigger spike (default: 3x) */
  reviewVelocityMultiplier: number;
}

export const DEFAULT_THRESHOLDS: EventThresholds = {
  significantRankChange: 5,
  categoryRankChange: 3,
  reviewMilestones: [100, 250, 500, 1000, 2500, 5000, 10000],
  ratingMilestones: [4.0, 4.5, 4.8],
  competitorReviewSurge: 10,
  reviewVelocityMultiplier: 3,
};

// ── Ranking events ──────────────────────────────────────────────────

export function checkRankingAlerts(
  appId: number,
  appSlug: string,
  appName: string,
  platform: string,
  current: RankingSnapshot[],
  previous: RankingSnapshot[],
  thresholds: EventThresholds = DEFAULT_THRESHOLDS
): DetectedEvent[] {
  const events: DetectedEvent[] = [];
  const prevMap = new Map(previous.map((r) => [r.keywordId, r]));

  for (const cur of current) {
    const prev = prevMap.get(cur.keywordId);

    // New keyword ranking (wasn't tracked before)
    if (!prev) {
      if (cur.position !== null) {
        events.push({
          type: "keyword_new_ranking",
          appId,
          platform,
          severity: "info",
          data: {
            appSlug, appName,
            keyword: cur.keyword, keywordSlug: cur.keywordSlug,
            position: cur.position,
          },
        });
      }
      continue;
    }

    const oldPos = prev.position;
    const newPos = cur.position;

    // Dropped out of results
    if (oldPos !== null && newPos === null) {
      events.push({
        type: "ranking_dropped_out",
        appId,
        platform,
        severity: "warning",
        data: {
          appSlug, appName,
          keyword: cur.keyword, keywordSlug: cur.keywordSlug,
          previousPosition: oldPos,
        },
      });
      continue;
    }

    // New entry (was null, now ranked)
    if (oldPos === null && newPos !== null) {
      events.push({
        type: "ranking_new_entry",
        appId,
        platform,
        severity: "info",
        data: {
          appSlug, appName,
          keyword: cur.keyword, keywordSlug: cur.keywordSlug,
          position: newPos,
        },
      });
      // Also check if entered top 3
      if (newPos <= 3) {
        events.push({
          type: "ranking_top3_entry",
          appId,
          platform,
          severity: "critical",
          data: {
            appSlug, appName,
            keyword: cur.keyword, keywordSlug: cur.keywordSlug,
            position: newPos,
          },
        });
      }
      continue;
    }

    if (oldPos === null || newPos === null) continue;

    const change = oldPos - newPos; // positive = improved

    // Top 3 entry
    if (oldPos > 3 && newPos <= 3) {
      events.push({
        type: "ranking_top3_entry",
        appId,
        platform,
        severity: "critical",
        data: {
          appSlug, appName,
          keyword: cur.keyword, keywordSlug: cur.keywordSlug,
          position: newPos, previousPosition: oldPos, change,
        },
      });
    }

    // Top 3 exit
    if (oldPos <= 3 && newPos > 3) {
      events.push({
        type: "ranking_top3_exit",
        appId,
        platform,
        severity: "warning",
        data: {
          appSlug, appName,
          keyword: cur.keyword, keywordSlug: cur.keywordSlug,
          position: newPos, previousPosition: oldPos, change,
        },
      });
    }

    // Significant change
    if (Math.abs(change) >= thresholds.significantRankChange) {
      events.push({
        type: "ranking_significant_change",
        appId,
        platform,
        severity: Math.abs(change) >= 10 ? "warning" : "info",
        data: {
          appSlug, appName,
          keyword: cur.keyword, keywordSlug: cur.keywordSlug,
          position: newPos, previousPosition: oldPos, change,
        },
      });
    }

    // Position gained / lost (for keyword-specific events)
    if (change > 0) {
      events.push({
        type: "keyword_position_gained",
        appId,
        platform,
        severity: "info",
        data: {
          appSlug, appName,
          keyword: cur.keyword, keywordSlug: cur.keywordSlug,
          position: newPos, previousPosition: oldPos, change,
        },
      });
    } else if (change < 0) {
      events.push({
        type: "keyword_position_lost",
        appId,
        platform,
        severity: "info",
        data: {
          appSlug, appName,
          keyword: cur.keyword, keywordSlug: cur.keywordSlug,
          position: newPos, previousPosition: oldPos, change,
        },
      });
    }
  }

  return events;
}

// ── Category ranking events ─────────────────────────────────────────

export function checkCategoryAlerts(
  appId: number,
  appSlug: string,
  appName: string,
  platform: string,
  current: CategoryRankingSnapshot[],
  previous: CategoryRankingSnapshot[],
  thresholds: EventThresholds = DEFAULT_THRESHOLDS
): DetectedEvent[] {
  const events: DetectedEvent[] = [];
  const prevMap = new Map(previous.map((r) => [r.categorySlug, r]));

  for (const cur of current) {
    const prev = prevMap.get(cur.categorySlug);
    if (!prev) continue;

    const change = prev.position - cur.position;
    if (Math.abs(change) >= thresholds.categoryRankChange) {
      events.push({
        type: "ranking_category_change",
        appId,
        platform,
        severity: Math.abs(change) >= 10 ? "warning" : "info",
        data: {
          appSlug, appName,
          categoryName: cur.categoryName, categorySlug: cur.categorySlug,
          position: cur.position, previousPosition: prev.position, change,
        },
      });
    }
  }

  return events;
}

// ── Competitor events ───────────────────────────────────────────────

export function checkCompetitorMoves(
  trackedAppId: number,
  trackedAppSlug: string,
  trackedAppName: string,
  platform: string,
  currentCompetitors: CompetitorSnapshot[],
  previousCompetitors: CompetitorSnapshot[],
  trackedAppKeywordPositions: Record<string, number | null>,
  thresholds: EventThresholds = DEFAULT_THRESHOLDS
): DetectedEvent[] {
  const events: DetectedEvent[] = [];
  const prevMap = new Map(previousCompetitors.map((c) => [c.appId, c]));

  for (const comp of currentCompetitors) {
    const prev = prevMap.get(comp.appId);

    // Overtake detection: competitor now ranks above tracked app on shared keywords
    for (const [kwSlug, compPos] of Object.entries(comp.keywordPositions)) {
      if (compPos === null) continue;
      const trackedPos = trackedAppKeywordPositions[kwSlug];
      if (trackedPos === null || trackedPos === undefined) continue;

      const prevCompPos = prev?.keywordPositions[kwSlug];
      // Competitor was below (or not ranked) and is now above
      if ((prevCompPos === null || prevCompPos === undefined || prevCompPos > trackedPos) && compPos < trackedPos) {
        events.push({
          type: "competitor_overtook",
          appId: trackedAppId,
          platform,
          severity: "warning",
          data: {
            appSlug: trackedAppSlug, appName: trackedAppName,
            competitorName: comp.appName, competitorSlug: comp.appSlug,
            keywordSlug: kwSlug,
            competitorPosition: compPos, trackedPosition: trackedPos,
          },
        });
      }
    }

    if (!prev) continue;

    // Featured placement
    if (!prev.isFeatured && comp.isFeatured) {
      events.push({
        type: "competitor_featured",
        appId: trackedAppId,
        platform,
        severity: "info",
        data: {
          appSlug: trackedAppSlug, appName: trackedAppName,
          competitorName: comp.appName, competitorSlug: comp.appSlug,
        },
      });
    }

    // Review surge
    const prevCount = prev.ratingCount ?? 0;
    const curCount = comp.ratingCount ?? 0;
    if (curCount - prevCount >= thresholds.competitorReviewSurge) {
      events.push({
        type: "competitor_review_surge",
        appId: trackedAppId,
        platform,
        severity: "info",
        data: {
          appSlug: trackedAppSlug, appName: trackedAppName,
          competitorName: comp.appName, competitorSlug: comp.appSlug,
          reviewCount: curCount, previousReviewCount: prevCount,
          newReviews: curCount - prevCount,
        },
      });
    }

    // Pricing change
    if (prev.pricingHint !== null && comp.pricingHint !== prev.pricingHint) {
      events.push({
        type: "competitor_pricing_change",
        appId: trackedAppId,
        platform,
        severity: "info",
        data: {
          appSlug: trackedAppSlug, appName: trackedAppName,
          competitorName: comp.appName, competitorSlug: comp.appSlug,
          oldPricing: prev.pricingHint, newPricing: comp.pricingHint,
        },
      });
    }
  }

  return events;
}

// ── Review events ───────────────────────────────────────────────────

export function checkNewReviews(
  appId: number,
  appSlug: string,
  appName: string,
  platform: string,
  currentReviews: ReviewSnapshot[],
  previousReviewIds: Set<number>,
  currentMetrics: AppMetrics | null,
  previousMetrics: AppMetrics | null,
  thresholds: EventThresholds = DEFAULT_THRESHOLDS
): DetectedEvent[] {
  const events: DetectedEvent[] = [];

  // New individual reviews
  for (const review of currentReviews) {
    if (previousReviewIds.has(review.id)) continue;

    if (review.rating >= 4) {
      events.push({
        type: "review_new_positive",
        appId,
        platform,
        severity: "info",
        data: {
          appSlug, appName,
          rating: review.rating,
          reviewerName: review.reviewerName,
          content: review.content?.slice(0, 200),
        },
      });
    } else if (review.rating <= 2) {
      events.push({
        type: "review_new_negative",
        appId,
        platform,
        severity: "warning",
        data: {
          appSlug, appName,
          rating: review.rating,
          reviewerName: review.reviewerName,
          content: review.content?.slice(0, 200),
        },
      });
    }
  }

  // Review velocity spike
  if (currentMetrics && previousMetrics) {
    const curV = currentMetrics.reviewVelocity7d ?? 0;
    const prevV = previousMetrics.reviewVelocity7d ?? 0;
    if (prevV > 0 && curV >= prevV * thresholds.reviewVelocityMultiplier) {
      events.push({
        type: "review_velocity_spike",
        appId,
        platform,
        severity: "warning",
        data: {
          appSlug, appName,
          currentVelocity: curV, previousVelocity: prevV,
          multiplier: Math.round((curV / prevV) * 10) / 10,
        },
      });
    }
  }

  return events;
}

// ── Milestone events ────────────────────────────────────────────────

export function detectMilestones(
  appId: number,
  appSlug: string,
  appName: string,
  platform: string,
  currentMetrics: AppMetrics,
  previousMetrics: AppMetrics | null,
  currentRankings: RankingSnapshot[],
  thresholds: EventThresholds = DEFAULT_THRESHOLDS
): DetectedEvent[] {
  const events: DetectedEvent[] = [];

  // Review count milestones
  if (previousMetrics) {
    const prevCount = previousMetrics.ratingCount ?? 0;
    const curCount = currentMetrics.ratingCount ?? 0;
    for (const milestone of thresholds.reviewMilestones) {
      if (prevCount < milestone && curCount >= milestone) {
        events.push({
          type: "review_milestone",
          appId,
          platform,
          severity: "info",
          data: { appSlug, appName, milestone, reviewCount: curCount },
        });
      }
    }

    // Rating milestones (crossing upward)
    const prevRating = previousMetrics.averageRating ?? 0;
    const curRating = currentMetrics.averageRating ?? 0;
    for (const milestone of thresholds.ratingMilestones) {
      if (prevRating < milestone && curRating >= milestone) {
        events.push({
          type: "rating_milestone",
          appId,
          platform,
          severity: "info",
          data: { appSlug, appName, milestone, rating: curRating, previousRating: prevRating },
        });
      }
    }
  }

  // Rank #1 detection
  for (const ranking of currentRankings) {
    if (ranking.position === 1) {
      events.push({
        type: "ranking_top1",
        appId,
        platform,
        severity: "critical",
        data: {
          appSlug, appName,
          keyword: ranking.keyword, keywordSlug: ranking.keywordSlug,
        },
      });
    }
  }

  return events;
}

// ── Featured events ─────────────────────────────────────────────────

export interface FeaturedSnapshot {
  surface: string;
  sectionHandle: string;
  position: number;
}

export function checkFeaturedChanges(
  appId: number,
  appSlug: string,
  appName: string,
  platform: string,
  current: FeaturedSnapshot[],
  previous: FeaturedSnapshot[]
): DetectedEvent[] {
  const events: DetectedEvent[] = [];
  const prevSet = new Set(previous.map((f) => `${f.surface}:${f.sectionHandle}`));
  const curSet = new Set(current.map((f) => `${f.surface}:${f.sectionHandle}`));

  // New placements
  for (const feat of current) {
    const key = `${feat.surface}:${feat.sectionHandle}`;
    if (!prevSet.has(key)) {
      events.push({
        type: "featured_new_placement",
        appId,
        platform,
        severity: "info",
        data: {
          appSlug, appName,
          surfaceName: feat.surface,
          sectionHandle: feat.sectionHandle,
          position: feat.position,
        },
      });
    }
  }

  // Removed placements
  for (const feat of previous) {
    const key = `${feat.surface}:${feat.sectionHandle}`;
    if (!curSet.has(key)) {
      events.push({
        type: "featured_removed",
        appId,
        platform,
        severity: "warning",
        data: {
          appSlug, appName,
          surfaceName: feat.surface,
          sectionHandle: feat.sectionHandle,
        },
      });
    }
  }

  return events;
}
