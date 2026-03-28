export type ScraperType =
  | "category"
  | "app_details"
  | "keyword_search"
  | "keyword_suggestions"
  | "reviews"
  | "daily_digest"
  | "featured_apps"
  | "compute_app_scores"
  | "compute_similarity_scores"
  | "compute_review_metrics"
  | "backfill_categories";

export type ScrapeRunStatus = "pending" | "running" | "completed" | "failed";

export interface ScrapeRunMetadata {
  items_scraped?: number;
  items_failed?: number;
  duration_ms?: number;
  [key: string]: unknown;
}
