import type { Job } from "bullmq";
import { createDb, scrapeRuns, platformVisibility, featureFlags } from "@appranks/db";
import { eq, and, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createLogger, isPlatformId, getPlatform, needsBrowser, platformFeatureFlagSlug, type PlatformId } from "@appranks/shared";
import { enqueueScraperJob, type ScraperJobData, type ScraperJobType } from "./queue.js";
import { CategoryScraper } from "./scrapers/category-scraper.js";
import { AppDetailsScraper } from "./scrapers/app-details-scraper.js";
import { KeywordScraper } from "./scrapers/keyword-scraper.js";
import { KeywordSuggestionScraper } from "./scrapers/keyword-suggestion-scraper.js";
import { ReviewScraper } from "./scrapers/review-scraper.js";
import { HttpClient } from "./http-client.js";
import { BrowserClient } from "./browser-client.js";
import { getModule, getPlatformConstants } from "./platforms/registry.js";
import { resolveConfig } from "./config-resolver.js";
import { FallbackTracker } from "./utils/fallback-tracker.js";
import { createLinearErrorTask } from "./utils/create-linear-error-task.js";
import { recordSuccess, recordFailure, getCircuitState } from "./circuit-breaker.js";
import { afterKeywordScrape, afterCategoryScrape, afterReviewScrape } from "./events/post-scrape-events.js";
import {
  HTTP_DEFAULT_DELAY_MS,
  HTTP_DEFAULT_MAX_CONCURRENCY,
  JOB_TIMEOUT_CATEGORY_MS,
  JOB_TIMEOUT_KEYWORD_SEARCH_MS,
  JOB_TIMEOUT_REVIEWS_MS,
  JOB_TIMEOUT_APP_DETAILS_MS,
  JOB_TIMEOUT_APP_DETAILS_ALL_MS,
  JOB_TIMEOUT_KEYWORD_SUGGESTIONS_MS,
  JOB_TIMEOUT_COMPUTE_MS,
  JOB_TIMEOUT_DAILY_DIGEST_MS,
  JOB_TIMEOUT_DEFAULT_MS,
} from "./constants.js";

const log = createLogger("worker");

export function initWorkerDeps() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  // Worker uses a smaller pool than API to avoid saturating DB connections.
  // API pool: max 10 (fast queries for dashboard).
  // Worker pool: max 10, longer statement timeout for scraping operations.
  // Needs headroom for 8+ concurrent app scrapes per platform.
  const db = createDb(databaseUrl, {
    max: 10,
    statementTimeout: 60000, // 60s for heavy scraping queries
  });
  return { db };
}

export async function runMigrations(db: ReturnType<typeof createDb>, label?: string) {
  const migrationsFolder = new URL("../../../packages/db/src/migrations", import.meta.url).pathname;
  const ctx = label || "worker";
  log.info(`[${ctx}] running database migrations`, { migrationsFolder });
  try {
    // Pre-migration: add enum values outside of transaction
    // (ALTER TYPE ... ADD VALUE cannot run inside a transaction block)
    try {
      await db.execute(sql`ALTER TYPE scraper_type ADD VALUE IF NOT EXISTS 'compute_similarity_scores'`);
    } catch (e: any) {
      if (!e.message?.includes("already exists")) {
        log.warn(`[${ctx}] pre-migration enum error`, { error: e.message });
      }
    }

    await migrate(db, { migrationsFolder });
    log.info(`[${ctx}] database migrations complete`);
  } catch (err) {
    log.error(`[${ctx}] migration failed`, { error: String(err), stack: (err as Error).stack });
  }

  // Post-migration verification: ensure critical tables/columns exist
  try {
    const checks = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name='accounts') as has_accounts,
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name='users') as has_users,
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name='apps') as has_apps,
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name='password_reset_tokens') as has_password_reset,
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name='email_verification_tokens') as has_email_verify,
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name='account_activity_log') as has_activity_log,
        (SELECT count(*)::int FROM information_schema.columns WHERE table_name='accounts' AND column_name='past_due_since') as has_past_due_col,
        (SELECT count(*)::int FROM information_schema.columns WHERE table_name='accounts' AND column_name='stripe_customer_id') as has_stripe_col,
        (SELECT count(*)::int FROM information_schema.columns WHERE table_name='users' AND column_name='email_verified_at') as has_email_verified_col,
        (SELECT count(*)::int FROM information_schema.columns WHERE table_name='refresh_tokens' AND column_name='user_agent_hash') as has_ua_hash_col
    `);
    const row = (checks as any[])[0];
    const failures: string[] = [];
    if (!row?.has_accounts) failures.push("accounts table");
    if (!row?.has_users) failures.push("users table");
    if (!row?.has_apps) failures.push("apps table");
    if (!row?.has_password_reset) failures.push("password_reset_tokens table");
    if (!row?.has_email_verify) failures.push("email_verification_tokens table");
    if (!row?.has_activity_log) failures.push("account_activity_log table");
    if (!row?.has_past_due_col) failures.push("accounts.past_due_since column");
    if (!row?.has_stripe_col) failures.push("accounts.stripe_customer_id column");
    if (!row?.has_email_verified_col) failures.push("users.email_verified_at column");
    if (!row?.has_ua_hash_col) failures.push("refresh_tokens.user_agent_hash column");

    if (failures.length > 0) {
      log.error(`[${ctx}] POST-MIGRATION CHECK FAILED — missing: ${failures.join(", ")}`, { failures });
    } else {
      log.info(`[${ctx}] post-migration verification passed — all critical tables and columns present`);
    }
  } catch (err) {
    log.error(`[${ctx}] post-migration verification query failed`, { error: String(err) });
  }
}

/**
 * Redact secret-shaped keys from `options` before emitting in `job:config`
 * (PLA-1068). Strict allow-list of known-safe keys for app_details + friends;
 * anything else is dropped if its name suggests a credential.
 */
const SECRET_KEY_PATTERN = /(token|secret|key|password|auth|cookie|bearer)/i;
export function redactJobOptions(opts: unknown): Record<string, unknown> | null {
  if (!opts || typeof opts !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(opts as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERN.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (v == null || typeof v !== "object") {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = `[array len=${v.length}]`;
    } else {
      out[k] = redactJobOptions(v);
    }
  }
  return out;
}

/** Per-type timeout map (milliseconds) */
const JOB_TIMEOUT_MAP: Partial<Record<ScraperJobType, number>> & { default: number } = {
  category: JOB_TIMEOUT_CATEGORY_MS,
  keyword_search: JOB_TIMEOUT_KEYWORD_SEARCH_MS,
  reviews: JOB_TIMEOUT_REVIEWS_MS,
  app_details: JOB_TIMEOUT_APP_DETAILS_MS,
  keyword_suggestions: JOB_TIMEOUT_KEYWORD_SUGGESTIONS_MS,
  compute_review_metrics: JOB_TIMEOUT_COMPUTE_MS,
  compute_similarity_scores: JOB_TIMEOUT_COMPUTE_MS,
  compute_app_scores: JOB_TIMEOUT_COMPUTE_MS,
  backfill_categories: JOB_TIMEOUT_COMPUTE_MS,
  daily_digest: JOB_TIMEOUT_DAILY_DIGEST_MS,
  data_cleanup: JOB_TIMEOUT_COMPUTE_MS,
  default: JOB_TIMEOUT_DEFAULT_MS,
};

export function createProcessJob(db: ReturnType<typeof createDb>, queueName?: string) {
  const cascadeOpts = queueName ? { queue: queueName as "interactive" | "background" } : undefined;

  return async function processJob(job: Job<ScraperJobData>): Promise<void> {
    const { type, triggeredBy, requestId } = job.data;
    const platform: PlatformId = (job.data.platform && isPlatformId(job.data.platform)) ? job.data.platform as PlatformId : "shopify";
    const jobStartTime = Date.now();
    const traceId = String(job.id).slice(0, 8);
    log.info("processing job", { jobId: job.id, traceId, type, triggeredBy, platform, ...(requestId && { requestId }) });

    // Check if scraper is enabled for this platform
    const visRows = await db.select().from(platformVisibility).where(eq(platformVisibility.platform, platform));
    if (visRows.length > 0 && visRows[0].scraperEnabled === false) {
      log.warn("scraper disabled for platform, skipping job", { jobId: job.id, platform, type });
      return;
    }

    // Check if platform feature flag is globally enabled
    const flagSlug = platformFeatureFlagSlug(platform);
    const [flag] = await db.select({ isEnabled: featureFlags.isEnabled }).from(featureFlags).where(eq(featureFlags.slug, flagSlug)).limit(1);
    if (flag && !flag.isEnabled) {
      log.warn("platform feature flag disabled, skipping job", { jobId: job.id, platform, type, flagSlug });
      return;
    }

    const opts = job.data.options;
    const pageOptions = opts?.pages !== undefined ? { pages: opts.pages } : undefined;

    // Resolve runtime config: code defaults + DB overrides (per-type scope).
    // Phase 1 only merges real overrides for `app_details`; other types return
    // plain code defaults (schema registry has no entries for them yet).
    const resolvedConfig = await resolveConfig(db, platform, type).catch(() => null);
    if (resolvedConfig && resolvedConfig.enabled === false) {
      log.warn("scraper config disabled for (platform, type), skipping job", {
        jobId: job.id, platform, type,
      });
      return;
    }
    // Per-job HttpClient — use resolved rate limits when available, else platform constants
    const platformConstants = resolvedConfig?.merged ?? getPlatformConstants(platform);
    // Use keyword-specific delay if available and this is a keyword search job
    const isKeywordJob = type === "keyword_search";
    const baseDelayMs = isKeywordJob && platformConstants?.keywordDelayMs
      ? platformConstants.keywordDelayMs
      : (platformConstants?.rateLimit?.minDelayMs ?? HTTP_DEFAULT_DELAY_MS);
    const httpClient = new HttpClient({
      delayMs: parseInt(process.env.SCRAPER_DELAY_MS || String(baseDelayMs), 10),
      maxConcurrency: parseInt(process.env.SCRAPER_MAX_CONCURRENCY || String(platformConstants?.httpMaxConcurrency ?? HTTP_DEFAULT_MAX_CONCURRENCY), 10),
      platform,
    });

    // Create browser client for platforms that need SPA rendering.
    // bulk_via_category scope (PLA-1048) is HTTP-only by design — skip the browser.
    let browserClient: BrowserClient | undefined;
    const bulkViaCategory = type === "app_details" && opts?.scope === "bulk_via_category";
    if (needsBrowser(platform, type) && !bulkViaCategory) {
      browserClient = new BrowserClient();
    }

    // Per-job fallback tracker
    const tracker = new FallbackTracker();

    // Get platform module
    let platformModule;
    try {
      platformModule = getModule(platform, httpClient, browserClient, tracker);
    } catch {
      // Fall back to no module (Shopify default behavior)
    }

    // Emit a single structured log line capturing the resolved runtime config
    // for this job (PLA-1068). Pair with `processing job` so retro-inspection
    // of slow/failed runs can correlate behaviour with the exact knobs in
    // effect — concurrency, fetch mode, circuit state, worker identity,
    // image SHA. Best-effort: never block the job on the circuit lookup.
    try {
      const circuit = await getCircuitState(platform).catch(() => null);
      log.info("job:config", {
        jobId: job.id,
        traceId,
        type,
        platform,
        queue: queueName ?? null,
        triggeredBy,
        scope: opts?.scope ?? null,
        force: opts?.force ?? null,
        options: redactJobOptions(opts),
        platformConstants: {
          appDetailsConcurrency: platformConstants?.appDetailsConcurrency ?? null,
          appDetailsConcurrencyBulk: platformConstants?.appDetailsConcurrencyBulk ?? null,
          concurrentSeedCategories: platformConstants?.concurrentSeedCategories ?? null,
          keywordConcurrency: platformConstants?.keywordConcurrency ?? null,
          appDetailFetchMode: platformConstants?.appDetailFetchMode ?? null,
          refreshSnapshotFromCategoryCard: platformConstants?.refreshSnapshotFromCategoryCard ?? null,
          rateLimit: platformConstants?.rateLimit ?? null,
          httpMaxConcurrency: platformConstants?.httpMaxConcurrency ?? null,
        },
        circuit: circuit ? {
          state: circuit.state,
          failures: circuit.failures,
          openedAt: circuit.openedAt,
          usingFallback: circuit.usingFallback,
        } : null,
        usesBrowser: !!browserClient,
        configSource: resolvedConfig ? "scraper_configs+constants" : "constants",
        workerId: process.env.HOSTNAME ?? "unknown",
        gitSha: process.env.GIT_SHA ?? "unknown",
        nodeVersion: process.version,
      });
    } catch (err) {
      log.warn("job:config emit failed (non-fatal)", { jobId: job.id, error: String(err) });
    }

    // Job-level timeout to prevent hanging indefinitely
    const timeoutMs = (type === "app_details" && (opts?.scope === "all" || opts?.scope === "bulk_via_category" || opts?.scope === "all_with_full_details"))
      ? JOB_TIMEOUT_APP_DETAILS_ALL_MS
      : (JOB_TIMEOUT_MAP[type] ?? JOB_TIMEOUT_MAP.default);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`job timed out after ${timeoutMs / 1000}s`)), timeoutMs);
    });

    try {
    await Promise.race([timeoutPromise, (async () => {
    switch (type) {
      case "category": {
        const scraper = new CategoryScraper(db, { httpClient, platformModule });
        scraper.resolvedConfig = resolvedConfig ?? undefined;
        scraper.jobId = job.id;
        let discoveredSlugs: string[] = [];
        if (job.data.slug) {
          discoveredSlugs = await scraper.scrapeSingle(job.data.slug, triggeredBy, pageOptions, queueName);
          log.info("single category scrape completed", { slug: job.data.slug, discoveredApps: discoveredSlugs.length });
        } else {
          const result = await scraper.crawl(triggeredBy, pageOptions, queueName);
          discoveredSlugs = result.discoveredSlugs;
        }

        // Cascade: enqueue app_details jobs for discovered apps
        if (opts?.scrapeAppDetails && discoveredSlugs.length > 0) {
          const cascadeReviews = opts.scrapeReviews && getPlatform(platform).hasReviews;
          const uniqueSlugs = [...new Set(discoveredSlugs)];
          let enqueued = 0;
          let failed = 0;
          for (const slug of uniqueSlugs) {
            try {
              await enqueueScraperJob({
                type: "app_details",
                slug,
                platform,
                triggeredBy: `${triggeredBy}:cascade`,
                options: cascadeReviews ? { scrapeReviews: true } : undefined,
              }, cascadeOpts);
              enqueued++;
            } catch (err) {
              failed++;
              log.warn("cascade enqueue failed", { slug, error: String(err) });
            }
          }
          log.info("cascaded app_details jobs", { enqueued, failed, total: uniqueSlugs.length });
          if (failed > 0) {
            log.warn("partial cascade enqueue", { type: "app_details", enqueued, failed, total: uniqueSlugs.length });
          }
        }

        // Event detection: category ranking changes (skip in smoke tests)
        if (triggeredBy !== "smoke-test") {
          try { await afterCategoryScrape(db, platform, job.id!); } catch {}
        }

        break;
      }

      case "app_details": {
        const scraper = new AppDetailsScraper(db, httpClient, platformModule);
        scraper.jobId = job.id;
        scraper.resolvedConfig = resolvedConfig ?? undefined;
        if (job.data.slug) {
          await scraper.scrapeApp(job.data.slug, undefined, triggeredBy, queueName, opts?.force);
          log.info("single app scrape completed", { slug: job.data.slug });

          // Cascade: enqueue review job (only for platforms with review support)
          if (opts?.scrapeReviews && getPlatform(platform).hasReviews) {
            await enqueueScraperJob({
              type: "reviews",
              slug: job.data.slug,
              platform,
              triggeredBy: `${triggeredBy}:cascade`,
            }, cascadeOpts);
            log.info("cascaded reviews job", { slug: job.data.slug });
          }
        } else if (opts?.scope === "bulk_via_category") {
          await scraper.scrapeAllViaCategoryApi(triggeredBy, queueName, opts?.force ?? false);
        } else if (opts?.scope === "all_with_full_details") {
          await scraper.scrapeAllWithFullDetails(triggeredBy, queueName, opts?.force ?? false);
        } else if (opts?.scope === "all") {
          await scraper.scrapeAll(triggeredBy, queueName, opts?.force ?? false);
        } else {
          const isManual = triggeredBy && triggeredBy !== "scheduler";
          await scraper.scrapeTracked(triggeredBy, queueName, isManual || opts?.force);

          // Cascade: enqueue review jobs for all tracked apps (only for platforms with review support)
          if (opts?.scrapeReviews && getPlatform(platform).hasReviews) {
            const { eq: eqOp, and: andOp } = await import("drizzle-orm");
            const { apps: appsTable } = await import("@appranks/db");
            const trackedApps = await db
              .select({ slug: appsTable.slug })
              .from(appsTable)
              .where(andOp(eqOp(appsTable.isTracked, true), eqOp(appsTable.platform, platform)));
            let enqueued = 0;
            let failed = 0;
            for (const app of trackedApps) {
              try {
                await enqueueScraperJob({
                  type: "reviews",
                  slug: app.slug,
                  platform,
                  triggeredBy: `${triggeredBy}:cascade`,
                }, cascadeOpts);
                enqueued++;
              } catch (err) {
                failed++;
                log.warn("cascade enqueue failed", { slug: app.slug, error: String(err) });
              }
            }
            log.info("cascaded reviews jobs", { enqueued, failed, total: trackedApps.length });
            if (failed > 0) {
              log.warn("partial cascade enqueue", { type: "reviews", enqueued, failed, total: trackedApps.length });
            }
          }
        }

        // Cascade: recompute similarity scores (app snapshot data may have changed)
        await enqueueScraperJob({
          type: "compute_similarity_scores",
          platform,
          triggeredBy: `${triggeredBy}:cascade`,
        }, cascadeOpts);
        log.info("cascaded compute_similarity_scores job");
        break;
      }

      case "keyword_search": {
        const scraper = new KeywordScraper(db, httpClient, platformModule);
        scraper.resolvedConfig = resolvedConfig ?? undefined;
        scraper.jobId = job.id;
        let discoveredSlugs: string[] = [];
        if (job.data.keyword) {
          // Single keyword scrape — find the keyword row and scrape it
          const { eq } = await import("drizzle-orm");
          const { trackedKeywords, scrapeRuns } = await import("@appranks/db");
          const { and: andOp } = await import("drizzle-orm");
          const [kw] = await db
            .select()
            .from(trackedKeywords)
            .where(andOp(eq(trackedKeywords.keyword, job.data.keyword), eq(trackedKeywords.platform, platform)))
            .limit(1);
          if (kw) {
            const [run] = await db
              .insert(scrapeRuns)
              .values({
                scraperType: "keyword_search",
                status: "running",
                platform,
                createdAt: new Date(),
                startedAt: new Date(),
                triggeredBy,
                queue: queueName,
                jobId: job.id,
              })
              .returning();
            discoveredSlugs = await scraper.scrapeKeyword(kw.id, kw.keyword, run.id, pageOptions);
            await db
              .update(scrapeRuns)
              .set({ status: "completed", completedAt: new Date(), metadata: { items_scraped: 1, items_failed: 0 } })
              .where(eq(scrapeRuns.id, run.id));
            log.info("single keyword scrape completed", { keyword: kw.keyword, discoveredApps: discoveredSlugs.length });
          } else {
            log.warn("keyword not found for single scrape", { keyword: job.data.keyword });
          }
        } else {
          discoveredSlugs = await scraper.scrapeAll(triggeredBy, pageOptions, queueName);
        }

        // Cascade: enqueue app_details jobs for discovered apps
        if (opts?.scrapeAppDetails && discoveredSlugs.length > 0) {
          const cascadeReviews = opts.scrapeReviews && getPlatform(platform).hasReviews;
          const uniqueSlugs = [...new Set(discoveredSlugs)];
          let enqueued = 0;
          let failed = 0;
          for (const slug of uniqueSlugs) {
            try {
              await enqueueScraperJob({
                type: "app_details",
                slug,
                platform,
                triggeredBy: `${triggeredBy}:cascade`,
                options: cascadeReviews ? { scrapeReviews: true } : undefined,
              }, cascadeOpts);
              enqueued++;
            } catch (err) {
              failed++;
              log.warn("cascade enqueue failed", { slug, error: String(err) });
            }
          }
          log.info("cascaded app_details jobs", { enqueued, failed, total: uniqueSlugs.length });
          if (failed > 0) {
            log.warn("partial cascade enqueue", { type: "app_details", enqueued, failed, total: uniqueSlugs.length });
          }
        }

        // Cascade: enqueue keyword_suggestions job
        await enqueueScraperJob({
          type: "keyword_suggestions",
          keyword: job.data.keyword,
          platform,
          triggeredBy: `${triggeredBy}:cascade`,
        }, cascadeOpts);
        log.info("cascaded keyword_suggestions job");

        // Cascade: recompute similarity scores (keyword rankings may have changed)
        await enqueueScraperJob({
          type: "compute_similarity_scores",
          platform,
          triggeredBy: `${triggeredBy}:cascade`,
        }, cascadeOpts);
        log.info("cascaded compute_similarity_scores job");

        // Event detection: keyword ranking changes (skip in smoke tests)
        if (triggeredBy !== "smoke-test") {
          try { await afterKeywordScrape(db, platform, job.id!); } catch {}
        }

        break;
      }

      case "keyword_suggestions": {
        const suggestionScraper = new KeywordSuggestionScraper(db, httpClient, platformModule);
        suggestionScraper.jobId = job.id;
        if (job.data.keyword) {
          // Single keyword suggestion scrape
          const { eq, and: andOp2 } = await import("drizzle-orm");
          const { trackedKeywords, scrapeRuns } = await import("@appranks/db");
          const [kw] = await db
            .select()
            .from(trackedKeywords)
            .where(andOp2(eq(trackedKeywords.keyword, job.data.keyword), eq(trackedKeywords.platform, platform)))
            .limit(1);
          if (kw) {
            const [run] = await db
              .insert(scrapeRuns)
              .values({
                scraperType: "keyword_suggestions",
                platform,
                status: "running",
                createdAt: new Date(),
                startedAt: new Date(),
                triggeredBy,
                queue: queueName,
                jobId: job.id,
              })
              .returning();
            await suggestionScraper.scrapeSuggestions(kw.id, kw.keyword, run.id);
            await db
              .update(scrapeRuns)
              .set({ status: "completed", completedAt: new Date(), metadata: { items_scraped: 1, items_failed: 0 } })
              .where(eq(scrapeRuns.id, run.id));
            log.info("single keyword suggestion scrape completed", { keyword: kw.keyword });
          } else {
            log.warn("keyword not found for suggestion scrape", { keyword: job.data.keyword });
          }
        } else {
          await suggestionScraper.scrapeAll(triggeredBy, queueName);
        }
        break;
      }

      case "reviews": {
        if (!getPlatform(platform).hasReviews) {
          log.info("skipping reviews job — platform has no review support", { platform });
          break;
        }
        const scraper = new ReviewScraper(db, httpClient, platform, platformModule);
        scraper.jobId = job.id;
        if (job.data.slug) {
          const startTime = Date.now();
          const [run] = await db
            .insert(scrapeRuns)
            .values({
              scraperType: "reviews",
              status: "running",
              platform,
              createdAt: new Date(),
              startedAt: new Date(),
              triggeredBy,
              queue: queueName,
              jobId: job.id,
            })
            .returning();
          try {
            const newReviews = await scraper.scrapeAppReviews(job.data.slug, run.id);
            await db
              .update(scrapeRuns)
              .set({
                status: "completed",
                completedAt: new Date(),
                metadata: { items_scraped: 1, items_failed: 0, new_reviews: newReviews, duration_ms: Date.now() - startTime },
              })
              .where(eq(scrapeRuns.id, run.id));
          } catch (err) {
            await db
              .update(scrapeRuns)
              .set({ status: "failed", completedAt: new Date(), error: String(err) })
              .where(eq(scrapeRuns.id, run.id));
            throw err;
          }
        } else {
          await scraper.scrapeTracked(triggeredBy, queueName);
        }
        // Always recompute review metrics after reviews are scraped
        const { computeReviewMetrics } = await import("./jobs/compute-review-metrics.js");
        await computeReviewMetrics(db, `${triggeredBy}:reviews`, queueName, platform, job.id);
        break;
      }

      case "compute_review_metrics": {
        const { computeReviewMetrics } = await import("./jobs/compute-review-metrics.js");
        await computeReviewMetrics(db, triggeredBy, queueName, platform, job.id);
        break;
      }

      case "compute_similarity_scores": {
        const { computeSimilarityScores } = await import("./jobs/compute-similarity-scores.js");
        await computeSimilarityScores(db, triggeredBy, queueName, platform, job.id);
        break;
      }

      case "backfill_categories": {
        const { backfillCategories } = await import("./jobs/backfill-categories.js");
        await backfillCategories(db, triggeredBy, queueName, platform, job.id);
        break;
      }

      case "compute_app_scores": {
        const { computeAppScores } = await import("./jobs/compute-app-scores.js");
        await computeAppScores(db, triggeredBy, queueName, platform, job.id);
        break;
      }

      case "daily_digest": {
        const { getDigestRecipients, buildDigestForAccount, splitDigestByPlatform } = await import("./email/digest-builder.js");
        const { buildDigestHtml, buildDigestSubject } = await import("./email/digest-template.js");
        const { sendEmail } = await import("./email/pipeline.js");
        const { logSkippedEmail } = await import("./email/email-logger.js");
        const { eq: eqOp } = await import("drizzle-orm");
        const { users: usersTable } = await import("@appranks/db");

        // Single-user digest (manual trigger from admin)
        if (job.data.userId) {
          const [targetUser] = await db
            .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, accountId: usersTable.accountId })
            .from(usersTable)
            .where(eqOp(usersTable.id, job.data.userId));

          if (!targetUser) {
            log.warn("user not found for manual digest", { userId: job.data.userId });
            await logSkippedEmail(db, {
              emailType: "daily_digest",
              userId: job.data.userId,
              recipientEmail: "unknown",
              subject: "[Skipped] Daily Digest",
              skipReason: `User not found (ID: ${job.data.userId})`,
              dataSnapshot: { triggeredBy: job.data.triggeredBy },
            });
            break;
          }

          const data = await buildDigestForAccount(db, targetUser.accountId, undefined, targetUser.id);
          if (!data) {
            log.info("no digest data for user's account", { userId: targetUser.id, accountId: targetUser.accountId });
            await logSkippedEmail(db, {
              emailType: "daily_digest",
              userId: targetUser.id,
              accountId: targetUser.accountId,
              recipientEmail: targetUser.email,
              recipientName: targetUser.name,
              subject: "[Skipped] Daily Digest",
              skipReason: "No digest data: account has no tracked keywords or no ranking changes",
              dataSnapshot: { accountId: targetUser.accountId, triggeredBy: job.data.triggeredBy },
            });
            break;
          }

          // Split into per-platform digests and send one email per platform
          const userPlatformDigests = splitDigestByPlatform(data);
          for (const platformData of userPlatformDigests) {
            const html = buildDigestHtml(platformData);
            const subject = buildDigestSubject(platformData);
            await sendEmail({
              db,
              emailType: "daily_digest",
              userId: targetUser.id,
              accountId: targetUser.accountId,
              recipientEmail: targetUser.email,
              recipientName: targetUser.name,
              subject,
              htmlBody: html,
              dataSnapshot: { accountId: targetUser.accountId, platform: platformData.platform, digestDate: new Date().toISOString() },
            });
          }
          await db.update(usersTable).set({ lastDigestSentAt: new Date() }).where(eqOp(usersTable.id, targetUser.id));
          log.info("manual digest sent", { email: targetUser.email, platforms: userPlatformDigests.length });
          break;
        }

        // Account-level digest (manual trigger from admin — all users in account)
        if (job.data.accountId) {
          const accountUsers = await db
            .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
            .from(usersTable)
            .where(eqOp(usersTable.accountId, job.data.accountId));

          if (accountUsers.length === 0) {
            log.warn("no users found for account digest", { accountId: job.data.accountId });
            await logSkippedEmail(db, {
              emailType: "daily_digest",
              accountId: job.data.accountId,
              recipientEmail: "unknown",
              subject: "[Skipped] Daily Digest",
              skipReason: `No users found for account (ID: ${job.data.accountId})`,
              dataSnapshot: { triggeredBy: job.data.triggeredBy },
            });
            break;
          }

          const data = await buildDigestForAccount(db, job.data.accountId);
          if (!data) {
            log.info("no digest data for account", { accountId: job.data.accountId });
            await logSkippedEmail(db, {
              emailType: "daily_digest",
              accountId: job.data.accountId,
              recipientEmail: accountUsers.map((u) => u.email).join(", "),
              subject: "[Skipped] Daily Digest",
              skipReason: "No digest data: account has no tracked keywords or no ranking changes",
              dataSnapshot: { accountId: job.data.accountId, triggeredBy: job.data.triggeredBy },
            });
            break;
          }

          // Split into per-platform digests
          const acctPlatformDigests = splitDigestByPlatform(data);
          let sent = 0;
          for (const u of accountUsers) {
            for (const platformData of acctPlatformDigests) {
              try {
                const html = buildDigestHtml(platformData);
                const subject = buildDigestSubject(platformData);
                await sendEmail({
                  db,
                  emailType: "daily_digest",
                  userId: u.id,
                  accountId: job.data.accountId,
                  recipientEmail: u.email,
                  recipientName: u.name,
                  subject,
                  htmlBody: html,
                  dataSnapshot: { accountId: job.data.accountId, platform: platformData.platform, digestDate: new Date().toISOString() },
                });
                sent++;
              } catch (err) {
                log.error("failed to send account digest", { email: u.email, platform: platformData.platform, error: String(err) });
              }
            }
            await db.update(usersTable).set({ lastDigestSentAt: new Date() }).where(eqOp(usersTable.id, u.id));
          }
          log.info("account digest completed", { accountId: job.data.accountId, sent, total: accountUsers.length, platforms: acctPlatformDigests.length });
          break;
        }

        // Timezone-aware bulk digest: runs every 15 min, sends only to users
        // whose local time is in the delivery window (8:00-8:14 AM local)
        const { isInDeliveryWindow, alreadySentToday } = await import("./email/timezone.js");
        const now = new Date();
        const allRecipients = await getDigestRecipients(db);

        // Filter to users in their delivery window who haven't received today's digest
        const recipients = allRecipients.filter((r) =>
          isInDeliveryWindow(now, r.timezone) &&
          !alreadySentToday(r.lastDigestSentAt, now, r.timezone)
        );

        log.info("digest recipients in delivery window", {
          eligible: allRecipients.length,
          inWindow: recipients.length,
        });

        if (recipients.length === 0) break;

        // Group recipients by account
        const byAccount = new Map<string, typeof recipients>();
        for (const r of recipients) {
          const list = byAccount.get(r.accountId) || [];
          list.push(r);
          byAccount.set(r.accountId, list);
        }

        // Helper: send per-platform digests for a user given their combined digest data
        async function sendPerPlatformDigests(
          userData: Awaited<ReturnType<typeof buildDigestForAccount>>,
          user: { userId: string; email: string; name: string },
          accountId: string,
        ): Promise<number> {
          if (!userData) return 0;
          const perPlatform = splitDigestByPlatform(userData);
          let count = 0;
          for (const platformData of perPlatform) {
            try {
              const html = buildDigestHtml(platformData);
              const subject = buildDigestSubject(platformData);
              await sendEmail({
                db,
                emailType: "daily_digest",
                userId: user.userId,
                accountId,
                recipientEmail: user.email,
                recipientName: user.name,
                subject,
                htmlBody: html,
                dataSnapshot: { accountId, platform: platformData.platform, digestDate: new Date().toISOString() },
              });
              count++;
            } catch (err) {
              log.error("failed to send digest", { email: user.email, platform: platformData.platform, error: String(err) });
            }
          }
          return count;
        }

        let sent = 0;
        let skipped = 0;
        const digestStartMs = Date.now();
        for (const [accountId, accountUsers] of byAccount) {
          const accountStartMs = Date.now();
          // Use the first user's timezone for date boundaries
          const tz = accountUsers[0].timezone;

          for (const user of accountUsers) {
            const data = await buildDigestForAccount(db, accountId, tz, user.userId);
            if (!data) {
              skipped++;
              continue;
            }
            const emailsSent = await sendPerPlatformDigests(data, user, accountId);
            if (emailsSent > 0) {
              await db.update(usersTable).set({ lastDigestSentAt: new Date() }).where(eqOp(usersTable.email, user.email));
              sent += emailsSent;
            } else {
              skipped++;
            }
          }
          log.info("account digest processed", {
            accountId,
            users: accountUsers.length,
            elapsedMs: Date.now() - accountStartMs,
          });
        }
        const totalElapsedMs = Date.now() - digestStartMs;
        log.info("digest completed", { sent, skipped, totalAccounts: byAccount.size, elapsedMs: totalElapsedMs });
        break;
      }

      case "weekly_summary": {
        const { getWeeklyRecipients, buildWeeklyForAccount } = await import("./email/weekly-builder.js");
        const { buildWeeklyHtml, buildWeeklySubject } = await import("./email/weekly-template.js");
        const { sendEmail: sendWeeklyEmail } = await import("./email/pipeline.js");

        const weeklyRecipients = await getWeeklyRecipients(db);
        const byAcct = new Map<string, typeof weeklyRecipients>();
        for (const r of weeklyRecipients) {
          const list = byAcct.get(r.accountId) || [];
          list.push(r);
          byAcct.set(r.accountId, list);
        }

        let wSent = 0;
        let wSkipped = 0;
        for (const [acctId, acctUsers] of byAcct) {
          const tz = acctUsers[0].timezone;
          for (const user of acctUsers) {
            const weeklyData = await buildWeeklyForAccount(db, acctId, tz, user.userId);
            if (!weeklyData) { wSkipped++; continue; }

            const html = buildWeeklyHtml(weeklyData);
            const subject = buildWeeklySubject(weeklyData);
            try {
              await sendWeeklyEmail({
                db,
                emailType: "weekly_summary",
                userId: user.userId,
                accountId: acctId,
                recipientEmail: user.email,
                recipientName: user.name,
                subject,
                htmlBody: html,
                dataSnapshot: { accountId: acctId, weekDate: new Date().toISOString() },
              });
              wSent++;
            } catch (err) {
              log.error("failed to send weekly summary", { email: user.email, error: String(err) });
            }
          }
        }
        log.info("weekly summary completed", { sent: wSent, skipped: wSkipped });
        break;
      }

      case "data_cleanup": {
        const { dataCleanup } = await import("./jobs/data-cleanup.js");
        await dataCleanup(db, job.id);
        break;
      }

      default:
        throw new Error(`Unknown scraper type: ${type}`);
    }

    // Merge fallback metadata into the job's scrape_runs
    if (tracker.fallbackUsed && job.id) {
      try {
        await db.update(scrapeRuns)
          .set({ metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(tracker.toMetadata())}::jsonb` })
          .where(eq(scrapeRuns.jobId, job.id));
      } catch (fbErr) {
        log.warn("failed to merge fallback metadata", { jobId: job.id, error: String(fbErr) });
      }
    }

    log.info("job completed", { jobId: job.id, traceId, type, platform, durationMs: Date.now() - jobStartTime });

    // Record success for circuit breaker
    await recordSuccess(platform).catch(() => {});

    // Create Linear task for any item errors (fire-and-forget)
    createLinearErrorTask(db, job.id, platform, type).catch((err) => {
      log.warn("failed to create Linear error task", { error: String(err) });
    });
    })()]);
    } catch (error) {
      log.error("job failed", { jobId: job.id, traceId, type, platform, durationMs: Date.now() - jobStartTime, error: String(error) });

      // Record failure for circuit breaker
      await recordFailure(platform).catch(() => {});
      // Failsafe: mark any still-running scrape_runs for this job as failed
      if (job.id) {
        try {
          await db.update(scrapeRuns).set({
            status: "failed",
            completedAt: new Date(),
            error: `job-level failure: ${String(error)}`,
          }).where(and(eq(scrapeRuns.jobId, job.id), eq(scrapeRuns.status, "running")));
        } catch (dbErr) {
          log.error("failed to mark scrape_runs as failed", { jobId: job.id, error: String(dbErr) });
        }

        // Create Linear task for any item errors (fire-and-forget)
        createLinearErrorTask(db, job.id, platform, type).catch((err) => {
          log.warn("failed to create Linear error task", { error: String(err) });
        });
      }
      throw error;
    } finally {
      // Always close browsers — even on error/timeout — to prevent resource leaks
      if (browserClient) await browserClient.close().catch(() => {});
      if (platformModule && "closeBrowser" in platformModule && typeof (platformModule as any).closeBrowser === "function") {
        await (platformModule as any).closeBrowser().catch(() => {});
      }
    }
  };
}
