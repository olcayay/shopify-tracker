import { eq } from "drizzle-orm";
import type { Database } from "@shopify-tracking/db";
import { scrapeRuns, apps, appSnapshots } from "@shopify-tracking/db";
import { urls, createLogger } from "@shopify-tracking/shared";

const log = createLogger("app-details-scraper");
import { HttpClient } from "../http-client.js";
import { parseAppPage } from "../parsers/app-parser.js";

export class AppDetailsScraper {
  private db: Database;
  private httpClient: HttpClient;

  constructor(db: Database, httpClient?: HttpClient) {
    this.db = db;
    this.httpClient = httpClient || new HttpClient();
  }

  /** Scrape details for all tracked apps */
  async scrapeTracked(triggeredBy?: string): Promise<void> {
    const trackedApps = await this.db
      .select({ slug: apps.slug, name: apps.name })
      .from(apps)
      .where(eq(apps.isTracked, true));

    if (trackedApps.length === 0) {
      log.info("no tracked apps found");
      return;
    }

    log.info("scraping tracked apps", { count: trackedApps.length });

    const [run] = await this.db
      .insert(scrapeRuns)
      .values({
        scraperType: "app_details",
        status: "running",
        startedAt: new Date(),
        triggeredBy,
      })
      .returning();

    const startTime = Date.now();
    let itemsScraped = 0;
    let itemsFailed = 0;

    for (const app of trackedApps) {
      try {
        await this.scrapeApp(app.slug, run.id);
        itemsScraped++;
      } catch (error) {
        log.error("failed to scrape app", { slug: app.slug, error: String(error) });
        itemsFailed++;
      }
    }

    await this.db
      .update(scrapeRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        metadata: {
          items_scraped: itemsScraped,
          items_failed: itemsFailed,
          duration_ms: Date.now() - startTime,
        },
      })
      .where(eq(scrapeRuns.id, run.id));

    log.info("scraping complete", { itemsScraped, itemsFailed, durationMs: Date.now() - startTime });
  }

  /** Scrape a single app by slug */
  async scrapeApp(slug: string, runId?: string, triggeredBy?: string): Promise<void> {
    log.info("scraping app", { slug });

    // Create run if not provided
    if (!runId) {
      const [run] = await this.db
        .insert(scrapeRuns)
        .values({
          scraperType: "app_details",
          status: "running",
          startedAt: new Date(),
          triggeredBy,
        })
        .returning();
      runId = run.id;
    }

    const html = await this.httpClient.fetchPage(urls.app(slug));
    const details = parseAppPage(html, slug);

    // Upsert app master record
    await this.db
      .insert(apps)
      .values({ slug, name: details.app_name, isTracked: true })
      .onConflictDoUpdate({
        target: apps.slug,
        set: { name: details.app_name, updatedAt: new Date() },
      });

    // Insert snapshot
    await this.db.insert(appSnapshots).values({
      appSlug: slug,
      scrapeRunId: runId,
      scrapedAt: new Date(),
      title: details.title,
      description: details.description,
      pricing: details.pricing,
      averageRating: details.average_rating?.toString() ?? null,
      ratingCount: details.rating_count,
      developer: details.developer,
      demoStoreUrl: details.demo_store_url,
      languages: details.languages,
      worksWith: details.works_with,
      categories: details.categories,
      pricingTiers: details.pricing_tiers,
    });
  }
}
