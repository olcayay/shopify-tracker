import "dotenv/config";
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
      await scraper.crawl();
      break;
    }

    case "app_details": {
      const scraper = new AppDetailsScraper(db, httpClient);
      await scraper.scrapeTracked();
      break;
    }

    case "keyword_search": {
      const scraper = new KeywordScraper(db, httpClient);
      await scraper.scrapeAll();
      break;
    }

    case "reviews": {
      const scraper = new ReviewScraper(db, httpClient);
      await scraper.scrapeTracked();
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
