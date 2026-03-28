import type { KeywordOpportunityMetrics } from "@appranks/shared";

export interface SimpleApp {
  slug: string;
  name: string;
  iconUrl: string | null;
}

export const SCORE_DETAIL_COLUMNS = [
  { key: "_s_room", label: "Room", tooltip: "Room score (40% weight)\nHow crowded the top results are.\nHigher = fewer reviews in top 4 = more room.\n1 − (top 4 reviews / 20,000)" },
  { key: "_s_demand", label: "Demand", tooltip: "Demand score (25% weight)\nMarket size by total search results.\nHigher = more apps listed = stronger demand.\ntotal results / 1,000" },
  { key: "_s_maturity", label: "Maturity", tooltip: "Maturity score (10% weight)\nHow established the market is.\nHigher = fewer apps with 1000+ reviews.\n1 − (apps with 1000+ reviews / 12)" },
  { key: "_s_quality", label: "Quality", tooltip: "Quality score (25% weight)\nQuality gap in existing apps.\nHigher = fewer BFS apps & lower ratings.\nBased on BFS count and top 4 avg rating." },
  { key: "_fp_results", label: "Results", tooltip: "Total number of apps returned by Shopify search for this keyword." },
  { key: "_fp_rating", label: "Rating", tooltip: "Average rating of organic (non-sponsored) apps on the first page." },
  { key: "_fp_bfs", label: "BFS", tooltip: "Number of 'Built for Shopify' certified apps on the first page." },
  { key: "_fp_1000", label: "1000+", tooltip: "Number of first page apps with 1,000 or more reviews." },
  { key: "_fp_100", label: "100+", tooltip: "Number of first page apps with 100 or more reviews." },
  { key: "_c_top1", label: "Top 1", tooltip: "Review share of the #1 app.\nWhat % of first page reviews belong to the top app.\nHigh = the leader dominates." },
  { key: "_c_top4", label: "Top 4", tooltip: "Review share of top 4 apps.\nWhat % of first page reviews are held by the top 4.\nHigh = market dominated by few players." },
] as const;

export function getDetailValue(key: string, data: KeywordOpportunityMetrics): number | null {
  switch (key) {
    case "_s_room": return data.scores.room;
    case "_s_demand": return data.scores.demand;
    case "_s_maturity": return data.scores.maturity;
    case "_s_quality": return data.scores.quality;
    case "_fp_results": return data.stats.totalResults;
    case "_fp_rating": return data.stats.firstPageAvgRating;
    case "_fp_bfs": return data.stats.bfsCount;
    case "_fp_1000": return data.stats.count1000;
    case "_fp_100": return data.stats.count100;
    case "_c_top1": return data.stats.top1ReviewShare;
    case "_c_top4": return data.stats.top4ReviewShare;
    default: return null;
  }
}

export function formatDetailValue(key: string, value: number | null): string {
  if (value == null) return "\u2014";
  if (key.startsWith("_s_")) return `${Math.round(value * 100)}%`;
  if (key === "_fp_rating") return value.toFixed(1);
  if (key.startsWith("_c_")) return `${Math.round(value * 100)}%`;
  return String(value);
}

export function detailCellClass(key: string, value: number | null): string {
  if (value == null || !key.startsWith("_s_")) return "";
  const pct = Math.round(value * 100);
  if (pct >= 60) return "text-green-600 dark:text-green-400";
  if (pct >= 30) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}
