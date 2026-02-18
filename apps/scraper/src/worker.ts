import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import { Worker, type Job } from "bullmq";
import { createDb } from "@shopify-tracking/db";
import { createLogger } from "@shopify-tracking/shared";
import { QUEUE_NAME, getRedisConnection, type ScraperJobData } from "./queue.js";
import { CategoryScraper } from "./scrapers/category-scraper.js";
import { AppDetailsScraper } from "./scrapers/app-details-scraper.js";
import { KeywordScraper } from "./scrapers/keyword-scraper.js";
import { ReviewScraper } from "./scrapers/review-scraper.js";
import { HttpClient } from "./http-client.js";

const log = createLogger("worker");

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

async function processJob(job: Job<ScraperJobData>): Promise<void> {
  const { type, triggeredBy } = job.data;
  log.info("processing job", { jobId: job.id, type, triggeredBy });

  switch (type) {
    case "category": {
      const scraper = new CategoryScraper(db, { httpClient });
      if (job.data.slug) {
        await scraper.scrapeSingle(job.data.slug, triggeredBy);
        log.info("single category scrape completed", { slug: job.data.slug });
      } else {
        await scraper.crawl(triggeredBy);
      }
      break;
    }

    case "app_details": {
      const scraper = new AppDetailsScraper(db, httpClient);
      if (job.data.slug) {
        await scraper.scrapeApp(job.data.slug, undefined, triggeredBy);
        log.info("single app scrape completed", { slug: job.data.slug });
      } else {
        await scraper.scrapeTracked(triggeredBy);
      }
      break;
    }

    case "keyword_search": {
      const scraper = new KeywordScraper(db, httpClient);
      if (job.data.keyword) {
        // Single keyword scrape — find the keyword row and scrape it
        const { eq } = await import("drizzle-orm");
        const { trackedKeywords, scrapeRuns } = await import("@shopify-tracking/db");
        const [kw] = await db
          .select()
          .from(trackedKeywords)
          .where(eq(trackedKeywords.keyword, job.data.keyword))
          .limit(1);
        if (kw) {
          const [run] = await db
            .insert(scrapeRuns)
            .values({
              scraperType: "keyword_search",
              status: "running",
              startedAt: new Date(),
              triggeredBy,
            })
            .returning();
          await scraper.scrapeKeyword(kw.id, kw.keyword, run.id);
          await db
            .update(scrapeRuns)
            .set({ status: "completed", completedAt: new Date(), metadata: { items_scraped: 1, items_failed: 0 } })
            .where(eq(scrapeRuns.id, run.id));
          log.info("single keyword scrape completed", { keyword: kw.keyword });
        } else {
          log.warn("keyword not found for single scrape", { keyword: job.data.keyword });
        }
      } else {
        await scraper.scrapeAll(triggeredBy);
      }
      break;
    }

    case "reviews": {
      const scraper = new ReviewScraper(db, httpClient);
      if (job.data.slug) {
        await scraper.scrapeAppReviews(job.data.slug, "");
      } else {
        await scraper.scrapeTracked(triggeredBy);
      }
      break;
    }

    case "daily_digest": {
      const { getDigestRecipients, buildDigestForAccount } = await import("./email/digest-builder.js");
      const { buildDigestHtml, buildDigestSubject } = await import("./email/digest-template.js");
      const { sendMail } = await import("./email/mailer.js");
      const { eq: eqOp } = await import("drizzle-orm");
      const { users: usersTable } = await import("@shopify-tracking/db");

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
}

const worker = new Worker<ScraperJobData>(
  QUEUE_NAME,
  processJob,
  {
    connection: getRedisConnection(),
    concurrency: 1, // Only 1 scraper job at a time to respect rate limits
    limiter: {
      max: 1,
      duration: 5000, // At most 1 job per 5 seconds
    },
  }
);

worker.on("failed", (job, err) => {
  log.error("job failed", {
    jobId: job?.id,
    type: job?.data?.type,
    attempt: job?.attemptsMade,
    error: String(err),
  });
});

worker.on("error", (err) => {
  log.error("worker error", { error: String(err) });
});

log.info("worker started, waiting for jobs...");

// Graceful shutdown
const shutdown = async () => {
  log.info("shutting down worker...");
  await worker.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
