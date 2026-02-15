export type ScraperType = "category" | "app_details" | "keyword_search" | "reviews";

export type ScrapeRunStatus = "pending" | "running" | "completed" | "failed";

export interface ScrapeRunMetadata {
  items_scraped?: number;
  items_failed?: number;
  duration_ms?: number;
  [key: string]: unknown;
}
