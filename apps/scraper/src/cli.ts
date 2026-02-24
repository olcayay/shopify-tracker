import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import { createDb } from "@shopify-tracking/db";
import { trackedKeywords, keywordToSlug, apps } from "@shopify-tracking/db";
import { CategoryScraper } from "./scrapers/category-scraper.js";
import { AppDetailsScraper } from "./scrapers/app-details-scraper.js";
import { KeywordScraper } from "./scrapers/keyword-scraper.js";
import { ReviewScraper } from "./scrapers/review-scraper.js";
import { HttpClient } from "./http-client.js";
const command = process.argv[2];

if (!command) {
  console.log("Usage: tsx src/cli.ts <command> [args]");
  console.log("Commands:");
  console.log("  categories              Crawl full category tree");
  console.log("  app <slug>              Scrape single app details");
  console.log("  app-tracked             Scrape all tracked apps");
  console.log("  keyword <keyword>       Scrape search results for keyword");
  console.log("  keyword-tracked         Scrape all tracked keywords");
  console.log("  reviews <slug>          Scrape reviews for an app");
  console.log("  reviews-tracked         Scrape reviews for all tracked apps");
  console.log("  featured                Scrape featured apps from homepage + categories");
  console.log("  track-app <slug>        Mark an app as tracked");
  console.log("  track-keyword <keyword> Add a keyword to tracking");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const db = createDb(databaseUrl);
const httpClient = new HttpClient({
  delayMs: parseInt(process.env.SCRAPER_DELAY_MS || "2000", 10),
  maxConcurrency: parseInt(process.env.SCRAPER_MAX_CONCURRENCY || "2", 10),
});

async function main() {
  switch (command) {
    case "categories": {
      const scraper = new CategoryScraper(db, { httpClient });
      const result = await scraper.crawl();
      console.log(
        `\nCategory tree crawl complete. ${JSON.stringify(result.tree.map((n) => n.title))}`
      );
      break;
    }

    case "app": {
      const slug = process.argv[3];
      if (!slug) {
        console.error("Usage: tsx src/cli.ts app <app-slug>");
        process.exit(1);
      }
      const scraper = new AppDetailsScraper(db, httpClient);
      await scraper.scrapeApp(slug);
      console.log(`\nApp "${slug}" scraped successfully.`);
      break;
    }

    case "app-tracked": {
      const scraper = new AppDetailsScraper(db, httpClient);
      await scraper.scrapeTracked();
      break;
    }

    case "keyword": {
      const keyword = process.argv[3];
      if (!keyword) {
        console.error("Usage: tsx src/cli.ts keyword <keyword>");
        process.exit(1);
      }
      // Ensure keyword is tracked
      const [kw] = await db
        .insert(trackedKeywords)
        .values({ keyword, slug: keywordToSlug(keyword) })
        .onConflictDoUpdate({
          target: trackedKeywords.keyword,
          set: { isActive: true, updatedAt: new Date() },
        })
        .returning();

      const scraper = new KeywordScraper(db, httpClient);
      await scraper.scrapeKeyword(kw.id, keyword, await createRun("keyword_search"));
      console.log(`\nKeyword "${keyword}" scraped successfully.`);
      break;
    }

    case "keyword-tracked": {
      const scraper = new KeywordScraper(db, httpClient);
      await scraper.scrapeAll();
      break;
    }

    case "reviews": {
      const slug = process.argv[3];
      if (!slug) {
        console.error("Usage: tsx src/cli.ts reviews <app-slug>");
        process.exit(1);
      }
      const scraper = new ReviewScraper(db, httpClient);
      const runId = await createRun("reviews");
      const count = await scraper.scrapeAppReviews(slug, runId);
      console.log(`\nScraped ${count} reviews for "${slug}".`);
      break;
    }

    case "reviews-tracked": {
      const scraper = new ReviewScraper(db, httpClient);
      await scraper.scrapeTracked();
      break;
    }

    case "track-app": {
      const slug = process.argv[3];
      if (!slug) {
        console.error("Usage: tsx src/cli.ts track-app <app-slug>");
        process.exit(1);
      }
      await db
        .insert(apps)
        .values({ slug, name: slug, isTracked: true })
        .onConflictDoUpdate({
          target: apps.slug,
          set: { isTracked: true, updatedAt: new Date() },
        });
      console.log(`App "${slug}" is now tracked.`);
      break;
    }

    case "track-keyword": {
      const keyword = process.argv[3];
      if (!keyword) {
        console.error("Usage: tsx src/cli.ts track-keyword <keyword>");
        process.exit(1);
      }
      await db
        .insert(trackedKeywords)
        .values({ keyword, slug: keywordToSlug(keyword) })
        .onConflictDoUpdate({
          target: trackedKeywords.keyword,
          set: { isActive: true, updatedAt: new Date() },
        });
      console.log(`Keyword "${keyword}" is now tracked.`);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }

  process.exit(0);
}

async function createRun(type: "category" | "app_details" | "keyword_search" | "reviews"): Promise<string> {
  const { scrapeRuns } = await import("@shopify-tracking/db");
  const [run] = await db
    .insert(scrapeRuns)
    .values({ scraperType: type, status: "running", createdAt: new Date(), startedAt: new Date() })
    .returning();
  return run.id;
}

main().catch((err) => {
  console.error("Fatal error:", String(err));
  process.exit(1);
});
