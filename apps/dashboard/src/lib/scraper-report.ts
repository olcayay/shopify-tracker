const SCRAPER_TYPE_FILE_MAP: Record<string, string> = {
  app_details: "app-details-scraper.ts",
  keyword_search: "keyword-scraper.ts",
  reviews: "review-scraper.ts",
  category: "category-scraper.ts",
};

export interface RunInfo {
  id?: string;
  platform?: string;
  scraperType?: string;
  status?: string;
  triggeredBy?: string;
  queue?: string;
  jobId?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  error?: string | null;
  metadata?: {
    duration_ms?: number;
    items_scraped?: number;
    items_failed?: number;
    fallback_used?: boolean;
    fallback_count?: number;
    fallback_contexts?: string[];
  };
  schedule?: string;
}

export interface ItemError {
  itemIdentifier: string;
  itemType: string;
  url?: string | null;
  errorMessage: string;
  stackTrace?: string | null;
  createdAt?: string;
}

function buildRunSection(run: RunInfo): string[] {
  const lines = [
    "--- Run ---",
    `Run ID:       ${run.id || "N/A"}`,
    `Platform:     ${run.platform || "unknown"}`,
    `Scraper Type: ${run.scraperType || "unknown"}`,
    `Status:       ${run.status || "unknown"}`,
  ];
  if (run.triggeredBy) lines.push(`Triggered By: ${run.triggeredBy}`);
  if (run.queue) lines.push(`Queue:        ${run.queue}`);
  if (run.jobId) lines.push(`Job ID:       ${run.jobId}`);
  lines.push(
    `Started:      ${run.startedAt || "N/A"}`,
    `Completed:    ${run.completedAt || "N/A"}`,
    `Duration:     ${run.metadata?.duration_ms ? `${run.metadata.duration_ms}ms` : "N/A"}`,
    `Items:        ${run.metadata?.items_scraped ?? 0} scraped, ${run.metadata?.items_failed ?? 0} failed`,
  );
  if (run.metadata?.fallback_used) {
    lines.push(
      `Fallback:     Yes (${run.metadata.fallback_count || 0} fallback${run.metadata.fallback_count !== 1 ? "s" : ""})`,
    );
    if (run.metadata.fallback_contexts?.length) {
      lines.push(`Contexts:     ${run.metadata.fallback_contexts.join(", ")}`);
    }
  }
  if (run.schedule) lines.push(`Schedule:     ${run.schedule}`);
  const file = SCRAPER_TYPE_FILE_MAP[run.scraperType || ""];
  if (file) lines.push(`Scraper File: apps/scraper/src/scrapers/${file}`);
  return lines;
}

function buildItemErrorSection(err: ItemError, index: number, total: number): string[] {
  const lines = [
    `--- Failed Item ${index + 1}/${total} ---`,
    `Identifier:   ${err.itemIdentifier}`,
    `Type:         ${err.itemType}`,
    `URL:          ${err.url || "N/A"}`,
  ];
  if (err.createdAt) lines.push(`Error Time:   ${err.createdAt}`);
  lines.push(`Error:        ${err.errorMessage}`);
  if (err.stackTrace) lines.push("Stack Trace:", err.stackTrace);
  return lines;
}

/** Build a report for a single item error */
export function buildItemReport(run: RunInfo, error: ItemError): string {
  const lines = ["=== SCRAPE ITEM ERROR REPORT ===", "", ...buildRunSection(run)];
  lines.push("", ...buildItemErrorSection(error, 0, 1));
  return lines.join("\n");
}

/** Build a report for an entire run with all item errors */
export function buildRunReport(run: RunInfo, itemErrors?: ItemError[]): string {
  const lines = ["=== SCRAPE RUN ERROR REPORT ===", "", ...buildRunSection(run)];
  if (run.error) lines.push("", "--- Run Error ---", run.error);
  if (itemErrors && itemErrors.length > 0) {
    lines.push("");
    for (let i = 0; i < itemErrors.length; i++) {
      lines.push(...buildItemErrorSection(itemErrors[i], i, itemErrors.length), "");
    }
  }
  return lines.join("\n");
}

/** Build a report focused on fallback usage */
export function buildFallbackReport(run: RunInfo): string {
  const lines = ["=== SCRAPER FALLBACK REPORT ===", "", ...buildRunSection(run)];
  if (run.error) lines.push("", "--- Run Error ---", run.error);
  return lines.join("\n");
}
