import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import { createDb } from "@appranks/db";
import { trackedKeywords, keywordToSlug, apps } from "@appranks/db";
import { isPlatformId, type PlatformId } from "@appranks/shared";
import { CategoryScraper } from "./scrapers/category-scraper.js";
import { AppDetailsScraper } from "./scrapers/app-details-scraper.js";
import { KeywordScraper } from "./scrapers/keyword-scraper.js";
import { ReviewScraper } from "./scrapers/review-scraper.js";
import { HttpClient } from "./http-client.js";
import { BrowserClient } from "./browser-client.js";
import { getModule } from "./platforms/registry.js";

// Parse --platform flag (can appear anywhere in args)
const platformArgIdx = process.argv.indexOf("--platform");
let platformArg: PlatformId = "shopify";
if (platformArgIdx !== -1 && process.argv[platformArgIdx + 1]) {
  const val = process.argv[platformArgIdx + 1];
  if (isPlatformId(val)) {
    platformArg = val;
  } else {
    console.error(`Unknown platform: ${val}. Valid: shopify, salesforce, canva, wix, wordpress, google_workspace, atlassian, zoom`);
    process.exit(1);
  }
  // Remove --platform and its value from argv so they don't interfere with positional args
  process.argv.splice(platformArgIdx, 2);
}

const command = process.argv[2];

if (!command) {
  console.log("Usage: tsx src/cli.ts [--platform shopify|salesforce] <command> [args]");
  console.log("Commands:");
  console.log("  categories              Crawl full category tree");
  console.log("  app <slug>              Scrape single app details");
  console.log("  app-tracked             Scrape all tracked apps");
  console.log("  app-all                 Scrape all discovered apps");
  console.log("  keyword <keyword>       Scrape search results for keyword");
  console.log("  keyword-tracked         Scrape all tracked keywords");
  console.log("  reviews <slug>          Scrape reviews for an app");
  console.log("  reviews-tracked         Scrape reviews for all tracked apps");
  console.log("  featured                Scrape featured apps from homepage + categories");
  console.log("  track-app <slug>        Mark an app as tracked");
  console.log("  track-keyword <keyword> Add a keyword to tracking");
  console.log("\nOptions:");
  console.log("  --platform <id>         Platform to scrape (default: shopify)");
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
  console.log(`Platform: ${platformArg}`);

  // Create browser client for platforms that need SPA rendering
  let browserClient: BrowserClient | undefined;
  if (platformArg === "salesforce" || platformArg === "canva" || platformArg === "google_workspace") {
    browserClient = new BrowserClient();
  }

  // Get platform module
  let platformModule;
  try {
    platformModule = getModule(platformArg, httpClient, browserClient);
  } catch {
    // Fall back to no module for unimplemented platforms
  }

  switch (command) {
    case "categories": {
      const slug = process.argv[3];
      const scraper = new CategoryScraper(db, { httpClient, platformModule });
      if (slug) {
        const discovered = await scraper.scrapeSingle(slug, "cli");
        console.log(`\nSingle category scrape complete. Discovered ${discovered.length} apps.`);
      } else {
        const result = await scraper.crawl();
        console.log(
          `\nCategory tree crawl complete. ${JSON.stringify(result.tree.map((n) => n.title))}`
        );
      }
      break;
    }

    case "app": {
      const slug = process.argv[3];
      if (!slug) {
        console.error("Usage: tsx src/cli.ts app <app-slug>");
        process.exit(1);
      }
      const forceFlag = process.argv.includes("--force");
      const scraper = new AppDetailsScraper(db, httpClient, platformModule);
      await scraper.scrapeApp(slug, undefined, "cli", undefined, forceFlag);
      console.log(`\nApp "${slug}" scraped successfully.`);
      break;
    }

    case "app-tracked": {
      const scraper = new AppDetailsScraper(db, httpClient, platformModule);
      await scraper.scrapeTracked();
      break;
    }

    case "app-all": {
      const forceAll = process.argv.includes("--force");
      const scraper = new AppDetailsScraper(db, httpClient, platformModule);
      await scraper.scrapeAll("cli", undefined, forceAll);
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
        .values({ keyword, slug: keywordToSlug(keyword), platform: platformArg })
        .onConflictDoUpdate({
          target: [trackedKeywords.platform, trackedKeywords.keyword],
          set: { isActive: true, updatedAt: new Date() },
        })
        .returning();

      const scraper = new KeywordScraper(db, httpClient, platformModule);
      const runId = await createRun("keyword_search");
      try {
        await scraper.scrapeKeyword(kw.id, keyword, runId);
        await completeRun(runId);
      } catch (err) {
        await completeRun(runId, String(err));
        throw err;
      }
      console.log(`\nKeyword "${keyword}" scraped successfully.`);
      break;
    }

    case "keyword-tracked": {
      const scraper = new KeywordScraper(db, httpClient, platformModule);
      await scraper.scrapeAll();
      break;
    }

    case "reviews": {
      const slug = process.argv[3];
      if (!slug) {
        console.error("Usage: tsx src/cli.ts reviews <app-slug>");
        process.exit(1);
      }
      const scraper = new ReviewScraper(db, httpClient, platformArg, platformModule);
      const runId = await createRun("reviews");
      try {
        const count = await scraper.scrapeAppReviews(slug, runId);
        await completeRun(runId);
        console.log(`\nScraped ${count} reviews for "${slug}".`);
      } catch (err) {
        await completeRun(runId, String(err));
        throw err;
      }
      break;
    }

    case "reviews-tracked": {
      const scraper = new ReviewScraper(db, httpClient, platformArg, platformModule);
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
        .values({ platform: platformArg, slug, name: slug, isTracked: true })
        .onConflictDoUpdate({
          target: [apps.platform, apps.slug],
          set: { isTracked: true, updatedAt: new Date() },
        });
      console.log(`App "${slug}" is now tracked on ${platformArg}.`);
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
        .values({ keyword, slug: keywordToSlug(keyword), platform: platformArg })
        .onConflictDoUpdate({
          target: [trackedKeywords.platform, trackedKeywords.keyword],
          set: { isActive: true, updatedAt: new Date() },
        });
      console.log(`Keyword "${keyword}" is now tracked on ${platformArg}.`);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }

  if (browserClient) await browserClient.close();
  process.exit(0);
}

async function createRun(type: "category" | "app_details" | "keyword_search" | "reviews"): Promise<string> {
  const { scrapeRuns } = await import("@appranks/db");
  const [run] = await db
    .insert(scrapeRuns)
    .values({ scraperType: type, status: "running", platform: platformArg, createdAt: new Date(), startedAt: new Date() })
    .returning();
  return run.id;
}

async function completeRun(runId: string, error?: string): Promise<void> {
  const { scrapeRuns } = await import("@appranks/db");
  const { eq } = await import("drizzle-orm");
  await db
    .update(scrapeRuns)
    .set({
      status: error ? "failed" : "completed",
      completedAt: new Date(),
      ...(error ? { error } : {}),
    })
    .where(eq(scrapeRuns.id, runId));
}

main().catch((err) => {
  console.error("Fatal error:", String(err));
  process.exit(1);
});
