import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import { createDb } from "@appranks/db";
import { trackedKeywords, keywordToSlug, apps } from "@appranks/db";
import { isPlatformId, PLATFORM_IDS, type PlatformId, createLogger } from "@appranks/shared";
import { CategoryScraper } from "./scrapers/category-scraper.js";
import { AppDetailsScraper } from "./scrapers/app-details-scraper.js";
import { KeywordScraper } from "./scrapers/keyword-scraper.js";
import { ReviewScraper } from "./scrapers/review-scraper.js";
import { HttpClient } from "./http-client.js";
import { BrowserClient } from "./browser-client.js";
import { getModule } from "./platforms/registry.js";

import { randomUUID } from "node:crypto";

const traceId = randomUUID().slice(0, 8); // Short trace ID for log correlation
const log = createLogger("cli");

// Parse --platform flag (can appear anywhere in args)
const platformArgIdx = process.argv.indexOf("--platform");
let platformArg: PlatformId = "shopify";
if (platformArgIdx !== -1 && process.argv[platformArgIdx + 1]) {
  const val = process.argv[platformArgIdx + 1];
  if (isPlatformId(val)) {
    platformArg = val;
  } else {
    log.error("Unknown platform", { platform: val, valid: PLATFORM_IDS.join(", ") });
    process.exit(1);
  }
  // Remove --platform and its value from argv so they don't interfere with positional args
  process.argv.splice(platformArgIdx, 2);
}

// Parse --force-fallback flag
const forceFallbackIdx = process.argv.indexOf("--force-fallback");
if (forceFallbackIdx !== -1) {
  process.env.FORCE_FALLBACK = "true";
  process.argv.splice(forceFallbackIdx, 1);
}

const command = process.argv[2];

if (!command) {
  log.info("Usage: tsx src/cli.ts [--platform shopify|salesforce] <command> [args]");
  log.info("Commands:");
  log.info("  categories              Crawl full category tree");
  log.info("  app <slug>              Scrape single app details");
  log.info("  app-tracked             Scrape all tracked apps");
  log.info("  app-all                 Scrape all discovered apps");
  log.info("  keyword <keyword>       Scrape search results for keyword");
  log.info("  keyword-tracked         Scrape all tracked keywords");
  log.info("  reviews <slug>          Scrape reviews for an app");
  log.info("  reviews-tracked         Scrape reviews for all tracked apps");
  log.info("  featured                Scrape featured apps from homepage + categories");
  log.info("  track-app <slug>        Mark an app as tracked");
  log.info("  track-keyword <keyword> Add a keyword to tracking");
  log.info("Options:");
  log.info("  --platform <id>         Platform to scrape (default: shopify)");
  log.info("  --force-fallback        Force fallback scraping methods (for testing)");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  log.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const isSmokeTest = process.env.SMOKE_TEST === "1";

// CLI uses minimal pool (single-threaded, no need for 10 connections)
const db = createDb(databaseUrl, { max: isSmokeTest ? 1 : 3 });

// Smoke test: no delays, minimal retries (fast path)
const httpClient = new HttpClient({
  delayMs: isSmokeTest ? 0 : parseInt(process.env.SCRAPER_DELAY_MS || "2000", 10),
  maxConcurrency: parseInt(process.env.SCRAPER_MAX_CONCURRENCY || "2", 10),
  maxRetries: isSmokeTest ? 1 : undefined,
});

// Track active run ID for cleanup on signal/timeout
let activeRunId: string | null = null;

// Cleanup orphaned runs on process termination (timeout, SIGTERM, etc.)
async function cleanupOnExit(signal: string) {
  if (activeRunId) {
    log.warn("process terminated, marking run as failed", { signal, runId: activeRunId });
    try {
      const { scrapeRuns } = await import("@appranks/db");
      const { eq } = await import("drizzle-orm");
      await db.update(scrapeRuns).set({
        status: "failed",
        error: `process terminated: ${signal}`,
        completedAt: new Date(),
      }).where(eq(scrapeRuns.id, activeRunId));
    } catch {}
  }
  process.exit(signal === "SIGTERM" ? 143 : 130);
}
process.on("SIGTERM", () => cleanupOnExit("SIGTERM"));
process.on("SIGINT", () => cleanupOnExit("SIGINT"));

async function main() {
  const t0 = Date.now();
  log.info("Platform selected", { platform: platformArg, smokeTest: isSmokeTest, traceId });
  if (process.env.FORCE_FALLBACK === "true") {
    log.info("Mode: FORCE_FALLBACK (using secondary scraping methods)");
  }

  // Lazy browser client: created for all platforms but only launches browser on first use.
  // This enables fallback scraping for HTTP-primary platforms at zero startup cost.
  const browserClient = new BrowserClient();

  // Get platform module
  let platformModule;
  try {
    platformModule = getModule(platformArg, httpClient, browserClient);
  } catch {
    // Fall back to no module for unimplemented platforms
  }

  try {
  switch (command) {
    case "categories": {
      const slug = process.argv[3];
      const pagesIdx = process.argv.indexOf("--pages");
      const pagesArg = pagesIdx !== -1 ? process.argv[pagesIdx + 1] : undefined;
      const pageOptions = pagesArg
        ? { pages: pagesArg === "all" ? "all" as const : pagesArg === "first" ? "first" as const : parseInt(pagesArg, 10) }
        : undefined;
      const scraper = new CategoryScraper(db, { httpClient, platformModule });
      if (slug) {
        const discovered = await scraper.scrapeSingle(slug, triggeredBy, pageOptions);
        log.info("Single category scrape complete", { discoveredApps: discovered.length });
      } else {
        const result = await scraper.crawl(triggeredBy, pageOptions);
        log.info("Category tree crawl complete", { categories: result.tree.map((n) => n.title) });
      }
      break;
    }

    case "app": {
      const slug = process.argv[3];
      if (!slug) {
        log.error("Usage: tsx src/cli.ts app <app-slug>");
        process.exit(1);
      }
      const forceFlag = process.argv.includes("--force");
      const scraper = new AppDetailsScraper(db, httpClient, platformModule);
      await scraper.scrapeApp(slug, undefined, triggeredBy, undefined, forceFlag);
      log.info("App scraped successfully", { slug });
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
      await scraper.scrapeAll(triggeredBy, undefined, forceAll);
      break;
    }

    case "keyword": {
      const keyword = process.argv[3];
      if (!keyword) {
        log.error("Usage: tsx src/cli.ts keyword <keyword>");
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
      log.info("Keyword scraped successfully", { keyword });
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
        log.error("Usage: tsx src/cli.ts reviews <app-slug>");
        process.exit(1);
      }
      const scraper = new ReviewScraper(db, httpClient, platformArg, platformModule);
      const runId = await createRun("reviews");
      try {
        const count = await scraper.scrapeAppReviews(slug, runId);
        await completeRun(runId);
        log.info("Reviews scraped", { slug, count });
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

    case "featured": {
      if (!platformModule?.fetchFeaturedSections) {
        log.info("Platform has no featured sections support", { platform: platformArg });
        break;
      }
      const sections = await platformModule.fetchFeaturedSections();
      const totalApps = sections.reduce((sum, s) => sum + s.apps.length, 0);
      log.info("Featured sections found", { sections: sections.length, totalApps });
      for (const s of sections) {
        log.info("Section", { title: s.sectionTitle, apps: s.apps.length });
      }
      break;
    }

    case "track-app": {
      const slug = process.argv[3];
      if (!slug) {
        log.error("Usage: tsx src/cli.ts track-app <app-slug>");
        process.exit(1);
      }
      await db
        .insert(apps)
        .values({ platform: platformArg, slug, name: slug, isTracked: true })
        .onConflictDoUpdate({
          target: [apps.platform, apps.slug],
          set: { isTracked: true, updatedAt: new Date() },
        });
      log.info("App is now tracked", { slug, platform: platformArg });
      break;
    }

    case "track-keyword": {
      const keyword = process.argv[3];
      if (!keyword) {
        log.error("Usage: tsx src/cli.ts track-keyword <keyword>");
        process.exit(1);
      }
      await db
        .insert(trackedKeywords)
        .values({ keyword, slug: keywordToSlug(keyword), platform: platformArg })
        .onConflictDoUpdate({
          target: [trackedKeywords.platform, trackedKeywords.keyword],
          set: { isActive: true, updatedAt: new Date() },
        });
      log.info("Keyword is now tracked", { keyword, platform: platformArg });
      break;
    }

    default:
      log.error("Unknown command", { command });
      process.exit(1);
  }
  } finally {
    // Always close browsers to prevent zombie Chromium processes
    await browserClient.close().catch(() => {});
    if (platformModule && "closeBrowser" in platformModule && typeof (platformModule as any).closeBrowser === "function") {
      await (platformModule as any).closeBrowser().catch(() => {});
    }
  }

  log.info("cli:total_timing", { command, platform: platformArg, totalMs: Date.now() - t0, traceId });
  process.exit(0);
}

const triggeredBy = isSmokeTest ? "smoke-test" : "cli";

async function createRun(type: "category" | "app_details" | "keyword_search" | "reviews"): Promise<string> {
  const { scrapeRuns } = await import("@appranks/db");
  const [run] = await db
    .insert(scrapeRuns)
    .values({ scraperType: type, status: "running", platform: platformArg, createdAt: new Date(), startedAt: new Date(), triggeredBy })
    .returning();
  activeRunId = run.id;
  return run.id;
}

async function completeRun(runId: string, error?: string): Promise<void> {
  activeRunId = null;
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
  log.error("Fatal error", { error: String(err) });
  process.exit(1);
});
