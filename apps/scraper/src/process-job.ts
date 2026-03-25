import type { Job } from "bullmq";
import { createDb, scrapeRuns } from "@appranks/db";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createLogger, isPlatformId, getPlatform, type PlatformId } from "@appranks/shared";
import { enqueueScraperJob, type ScraperJobData } from "./queue.js";
import { CategoryScraper } from "./scrapers/category-scraper.js";
import { AppDetailsScraper } from "./scrapers/app-details-scraper.js";
import { KeywordScraper } from "./scrapers/keyword-scraper.js";
import { KeywordSuggestionScraper } from "./scrapers/keyword-suggestion-scraper.js";
import { ReviewScraper } from "./scrapers/review-scraper.js";
import { HttpClient } from "./http-client.js";
import { BrowserClient } from "./browser-client.js";
import { getModule } from "./platforms/registry.js";

const log = createLogger("worker");

export function initWorkerDeps() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const db = createDb(databaseUrl);
  const httpClient = new HttpClient({
    delayMs: parseInt(process.env.SCRAPER_DELAY_MS || "2000", 10),
    maxConcurrency: parseInt(process.env.SCRAPER_MAX_CONCURRENCY || "2", 10),
  });

  return { db, httpClient };
}

export async function runMigrations(db: ReturnType<typeof createDb>, label?: string) {
  const migrationsFolder = new URL("../../../packages/db/src/migrations", import.meta.url).pathname;
  const ctx = label || "worker";
  log.info(`[${ctx}] running database migrations`, { migrationsFolder });
  try {
    await migrate(db, { migrationsFolder });
    log.info(`[${ctx}] database migrations complete`);
  } catch (err) {
    log.error(`[${ctx}] migration failed`, { error: String(err), stack: (err as Error).stack });
  }
}

const JOB_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes — hard limit per job

export function createProcessJob(db: ReturnType<typeof createDb>, httpClient: HttpClient, queueName?: string) {
  const cascadeOpts = queueName ? { queue: queueName as "interactive" | "background" } : undefined;

  return async function processJob(job: Job<ScraperJobData>): Promise<void> {
    const { type, triggeredBy } = job.data;
    const platform: PlatformId = (job.data.platform && isPlatformId(job.data.platform)) ? job.data.platform as PlatformId : "shopify";
    log.info("processing job", { jobId: job.id, type, triggeredBy, platform });

    const opts = job.data.options;
    const pageOptions = opts?.pages !== undefined ? { pages: opts.pages } : undefined;

    // Create browser client for platforms that need SPA rendering
    let browserClient: BrowserClient | undefined;
    if (platform === "salesforce" && type === "app_details") {
      browserClient = new BrowserClient();
    }
    if (platform === "canva" || platform === "google_workspace" || platform === "zoho" || platform === "zendesk" || platform === "hubspot") {
      browserClient = new BrowserClient();
    }

    // Get platform module
    let platformModule;
    try {
      platformModule = getModule(platform, httpClient, browserClient);
    } catch {
      // Fall back to no module (Shopify default behavior)
    }

    // Job-level timeout to prevent hanging indefinitely
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`job timed out after ${JOB_TIMEOUT_MS / 1000}s`)), JOB_TIMEOUT_MS);
    });

    try {
    await Promise.race([timeoutPromise, (async () => {
    switch (type) {
      case "category": {
        const scraper = new CategoryScraper(db, { httpClient, platformModule });
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
          for (const slug of uniqueSlugs) {
            await enqueueScraperJob({
              type: "app_details",
              slug,
              platform,
              triggeredBy: `${triggeredBy}:cascade`,
              options: cascadeReviews ? { scrapeReviews: true } : undefined,
            }, cascadeOpts);
          }
          log.info("cascaded app_details jobs", { count: uniqueSlugs.length });
        }
        break;
      }

      case "app_details": {
        const scraper = new AppDetailsScraper(db, httpClient, platformModule);
        scraper.jobId = job.id;
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
            for (const app of trackedApps) {
              await enqueueScraperJob({
                type: "reviews",
                slug: app.slug,
                platform,
                triggeredBy: `${triggeredBy}:cascade`,
              }, cascadeOpts);
            }
            log.info("cascaded reviews jobs", { count: trackedApps.length });
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
          for (const slug of uniqueSlugs) {
            await enqueueScraperJob({
              type: "app_details",
              slug,
              platform,
              triggeredBy: `${triggeredBy}:cascade`,
              options: cascadeReviews ? { scrapeReviews: true } : undefined,
            }, cascadeOpts);
          }
          log.info("cascaded app_details jobs", { count: uniqueSlugs.length });
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
        const { getDigestRecipients, buildDigestForAccount } = await import("./email/digest-builder.js");
        const { buildDigestHtml, buildDigestSubject } = await import("./email/digest-template.js");
        const { sendMail } = await import("./email/mailer.js");
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
            break;
          }

          const data = await buildDigestForAccount(db, targetUser.accountId);
          if (!data) {
            log.info("no digest data for user's account", { userId: targetUser.id, accountId: targetUser.accountId });
            break;
          }

          const html = buildDigestHtml(data);
          const subject = buildDigestSubject(data);
          await sendMail(targetUser.email, subject, html);
          await db.update(usersTable).set({ lastDigestSentAt: new Date() }).where(eqOp(usersTable.id, targetUser.id));
          log.info("manual digest sent", { email: targetUser.email });
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
            break;
          }

          const data = await buildDigestForAccount(db, job.data.accountId);
          if (!data) {
            log.info("no digest data for account", { accountId: job.data.accountId });
            break;
          }

          const html = buildDigestHtml(data);
          const subject = buildDigestSubject(data);
          let sent = 0;
          for (const u of accountUsers) {
            try {
              await sendMail(u.email, subject, html);
              await db.update(usersTable).set({ lastDigestSentAt: new Date() }).where(eqOp(usersTable.id, u.id));
              sent++;
            } catch (err) {
              log.error("failed to send account digest", { email: u.email, error: String(err) });
            }
          }
          log.info("account digest completed", { accountId: job.data.accountId, sent, total: accountUsers.length });
          break;
        }

        // Bulk digest for all eligible users
        const recipients = await getDigestRecipients(db);
        log.info("digest recipients found", { count: recipients.length });

        // Group recipients by account
        const byAccount = new Map<string, typeof recipients>();
        for (const r of recipients) {
          const list = byAccount.get(r.accountId) || [];
          list.push(r);
          byAccount.set(r.accountId, list);
        }

        let sent = 0;
        let skipped = 0;
        for (const [accountId, accountUsers] of byAccount) {
          const data = await buildDigestForAccount(db, accountId);
          if (!data) {
            skipped++;
            continue;
          }
          const html = buildDigestHtml(data);
          const subject = buildDigestSubject(data);
          for (const user of accountUsers) {
            try {
              await sendMail(user.email, subject, html);
              await db.update(usersTable).set({ lastDigestSentAt: new Date() }).where(eqOp(usersTable.email, user.email));
              sent++;
            } catch (err) {
              log.error("failed to send digest", { email: user.email, error: String(err) });
            }
          }
        }
        log.info("digest completed", { sent, skipped, totalAccounts: byAccount.size });
        break;
      }

      default:
        throw new Error(`Unknown scraper type: ${type}`);
    }

    log.info("job completed", { jobId: job.id, type });
    })()]);
    } finally {
      // Always close browsers — even on error/timeout — to prevent resource leaks
      if (browserClient) await browserClient.close().catch(() => {});
      if (platformModule && "closeBrowser" in platformModule && typeof (platformModule as any).closeBrowser === "function") {
        await (platformModule as any).closeBrowser().catch(() => {});
      }
    }
  };
}
