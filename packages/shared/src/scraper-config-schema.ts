/**
 * Registry of tunable scraper config knobs per scraper_type.
 *
 * Single source of truth for:
 *  - UI form generation in the Scraper Management page
 *  - Zod validation on config override PATCH (Phase 2)
 *  - `defaultFrom` lookup used by the resolver to assemble code defaults
 *
 * Phase 1 scope: `app_details` only. Other types are added in Phase 3 (PLA-1042).
 */
/**
 * Scraper job types that can carry tunable config. Kept local to this file so
 * `@appranks/shared` stays independent of `@appranks/scraper`. Must match
 * `ScraperConfigType` in `apps/scraper/src/queue.ts` — any new tunable type added
 * there should be added here too.
 */
export type ScraperConfigType =
  | "category"
  | "app_details"
  | "keyword_search"
  | "keyword_suggestions"
  | "reviews";

export type KnobType = "number" | "ms" | "boolean" | "string" | "string[]";

export interface KnobDef {
  /** Input editor type */
  type: KnobType;
  /** Inclusive lower bound (for number / ms) */
  min?: number;
  /** Inclusive upper bound (for number / ms) */
  max?: number;
  /** Human-readable help text displayed under the field */
  description: string;
  /** Which default table to read from when the knob is not overridden */
  defaultFrom: "platform" | "global";
  /**
   * Dot path into the default source.
   *  - For `defaultFrom: "platform"` → path within `PlatformConstants` (e.g. `"rateLimit.minDelayMs"`)
   *  - For `defaultFrom: "global"` → name of an exported constant in `apps/scraper/src/constants.ts`
   *    (e.g. `"JOB_TIMEOUT_APP_DETAILS_MS"`)
   */
  path: string;
}

/**
 * Phase 1: only `app_details` knobs. Phase 3 extends this to every scraper type.
 * Keys in each inner record match the flattened override key stored in DB JSON.
 * Dotted keys (e.g. "rateLimit.minDelayMs") encode nested paths.
 */
export const SCRAPER_CONFIG_SCHEMA: Partial<Record<ScraperConfigType, Record<string, KnobDef>>> = {
  app_details: {
    appDetailsConcurrency: {
      type: "number",
      min: 1,
      max: 20,
      description: "Concurrent app scrapes for the tracked-cron path",
      defaultFrom: "platform",
      path: "appDetailsConcurrency",
    },
    appDetailsConcurrencyBulk: {
      type: "number",
      min: 1,
      max: 10,
      description: "Concurrent app scrapes for scope=all bulk runs (separate from tracked to keep cron fast)",
      defaultFrom: "platform",
      path: "appDetailsConcurrencyBulk",
    },
    httpMaxConcurrency: {
      type: "number",
      min: 1,
      max: 20,
      description: "Max simultaneous HTTP requests across the HttpClient instance",
      defaultFrom: "platform",
      path: "httpMaxConcurrency",
    },
    "rateLimit.minDelayMs": {
      type: "ms",
      min: 0,
      max: 10_000,
      description: "Minimum delay between HTTP requests (effective RPS ≈ concurrency / delay)",
      defaultFrom: "platform",
      path: "rateLimit.minDelayMs",
    },
    "rateLimit.maxDelayMs": {
      type: "ms",
      min: 0,
      max: 30_000,
      description: "Adaptive delay ceiling under 429 pressure",
      defaultFrom: "platform",
      path: "rateLimit.maxDelayMs",
    },
    jobTimeoutMs: {
      type: "ms",
      min: 60_000,
      max: 24 * 3_600_000,
      description: "Hard timeout for tracked-cron app_details jobs",
      defaultFrom: "global",
      path: "JOB_TIMEOUT_APP_DETAILS_MS",
    },
    jobTimeoutAllMs: {
      type: "ms",
      min: 60_000,
      max: 24 * 3_600_000,
      description: "Hard timeout for scope=all bulk app_details jobs",
      defaultFrom: "global",
      path: "JOB_TIMEOUT_APP_DETAILS_ALL_MS",
    },
    httpMaxCumulativeBackoffMs: {
      type: "ms",
      min: 10_000,
      max: 600_000,
      description: "Cumulative 429 backoff budget before HttpClient bails a request",
      defaultFrom: "global",
      path: "HTTP_MAX_CUMULATIVE_BACKOFF_MS",
    },
  },
  category: {
    concurrentSeedCategories: {
      type: "number",
      min: 1,
      max: 10,
      description: "Seed categories crawled in parallel (3 levels of parallelism total, capped by HttpClient)",
      defaultFrom: "platform",
      path: "concurrentSeedCategories",
    },
    maxCategoryDepth: {
      type: "number",
      min: 1,
      max: 10,
      description: "Recursion depth for category tree crawl",
      defaultFrom: "platform",
      path: "maxCategoryDepth",
    },
    defaultPagesPerCategory: {
      type: "number",
      min: 1,
      max: 50,
      description: "Pages to scrape per category when `pages` is unspecified",
      defaultFrom: "platform",
      path: "defaultPagesPerCategory",
    },
    httpMaxConcurrency: {
      type: "number",
      min: 1,
      max: 20,
      description: "Max simultaneous HTTP requests",
      defaultFrom: "platform",
      path: "httpMaxConcurrency",
    },
    "rateLimit.minDelayMs": {
      type: "ms",
      min: 0,
      max: 10_000,
      description: "Minimum delay between category HTTP requests",
      defaultFrom: "platform",
      path: "rateLimit.minDelayMs",
    },
    jobTimeoutMs: {
      type: "ms",
      min: 60_000,
      max: 24 * 3_600_000,
      description: "Hard timeout for category jobs",
      defaultFrom: "global",
      path: "JOB_TIMEOUT_CATEGORY_MS",
    },
  },
  keyword_search: {
    keywordConcurrency: {
      type: "number",
      min: 1,
      max: 10,
      description: "Keywords scraped in parallel; lower values reduce deadlocks on popular-app upserts",
      defaultFrom: "platform",
      path: "keywordConcurrency",
    },
    keywordDelayMs: {
      type: "ms",
      min: 0,
      max: 10_000,
      description: "HTTP delay override for the search endpoint (falls back to rateLimit.minDelayMs when undefined)",
      defaultFrom: "platform",
      path: "keywordDelayMs",
    },
    httpMaxConcurrency: {
      type: "number",
      min: 1,
      max: 20,
      description: "Max simultaneous HTTP requests",
      defaultFrom: "platform",
      path: "httpMaxConcurrency",
    },
    "rateLimit.minDelayMs": {
      type: "ms",
      min: 0,
      max: 10_000,
      description: "Minimum delay between keyword HTTP requests (used when keywordDelayMs is unset)",
      defaultFrom: "platform",
      path: "rateLimit.minDelayMs",
    },
    jobTimeoutMs: {
      type: "ms",
      min: 60_000,
      max: 24 * 3_600_000,
      description: "Hard timeout for keyword_search jobs",
      defaultFrom: "global",
      path: "JOB_TIMEOUT_KEYWORD_SEARCH_MS",
    },
  },
  keyword_suggestions: {
    httpMaxConcurrency: {
      type: "number",
      min: 1,
      max: 20,
      description: "Max simultaneous HTTP requests",
      defaultFrom: "platform",
      path: "httpMaxConcurrency",
    },
    "rateLimit.minDelayMs": {
      type: "ms",
      min: 0,
      max: 10_000,
      description: "Minimum delay between suggestion API calls",
      defaultFrom: "platform",
      path: "rateLimit.minDelayMs",
    },
    jobTimeoutMs: {
      type: "ms",
      min: 60_000,
      max: 24 * 3_600_000,
      description: "Hard timeout for keyword_suggestions jobs",
      defaultFrom: "global",
      path: "JOB_TIMEOUT_KEYWORD_SUGGESTIONS_MS",
    },
  },
  reviews: {
    httpMaxConcurrency: {
      type: "number",
      min: 1,
      max: 20,
      description: "Max simultaneous HTTP requests",
      defaultFrom: "platform",
      path: "httpMaxConcurrency",
    },
    "rateLimit.minDelayMs": {
      type: "ms",
      min: 0,
      max: 10_000,
      description: "Minimum delay between review page fetches",
      defaultFrom: "platform",
      path: "rateLimit.minDelayMs",
    },
    "rateLimit.maxDelayMs": {
      type: "ms",
      min: 0,
      max: 30_000,
      description: "Adaptive delay ceiling under 429 pressure",
      defaultFrom: "platform",
      path: "rateLimit.maxDelayMs",
    },
    jobTimeoutMs: {
      type: "ms",
      min: 60_000,
      max: 24 * 3_600_000,
      description: "Hard timeout for review jobs",
      defaultFrom: "global",
      path: "JOB_TIMEOUT_REVIEWS_MS",
    },
  },
};

/** All scraper types that currently have at least one registered knob. */
export function getManagedScraperTypes(): ScraperConfigType[] {
  return Object.keys(SCRAPER_CONFIG_SCHEMA) as ScraperConfigType[];
}

/** Returns `true` if the given key is a registered knob for the scraper type. */
export function isKnownKnob(scraperType: ScraperConfigType, key: string): boolean {
  const typeSchema = SCRAPER_CONFIG_SCHEMA[scraperType];
  return typeSchema != null && key in typeSchema;
}
