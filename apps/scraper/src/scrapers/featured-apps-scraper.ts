import { eq, sql } from "drizzle-orm";
import type { Database } from "@shopify-tracking/db";
import { scrapeRuns, apps, categories, featuredAppSightings } from "@shopify-tracking/db";
import { urls, createLogger } from "@shopify-tracking/shared";
import { HttpClient } from "../http-client.js";
import { parseFeaturedSections } from "../parsers/featured-parser.js";

const log = createLogger("featured-apps-scraper");

export class FeaturedAppsScraper {
  private db: Database;
  private httpClient: HttpClient;

  constructor(db: Database, httpClient?: HttpClient) {
    this.db = db;
    this.httpClient = httpClient || new HttpClient();
  }

  /** Scrape featured apps from homepage + all L1/L2 category pages */
  async scrapeAll(triggeredBy?: string): Promise<void> {
    log.info("starting featured apps scrape");

    const [run] = await this.db
      .insert(scrapeRuns)
      .values({
        scraperType: "featured_apps",
        status: "running",
        startedAt: new Date(),
        triggeredBy,
      })
      .returning();

    const startTime = Date.now();
    let pagesScraped = 0;
    let sightingsRecorded = 0;
    let pagesFailed = 0;

    try {
      // 1. Scrape homepage
      try {
        const count = await this.scrapePage(urls.home(), run.id);
        sightingsRecorded += count;
        pagesScraped++;
      } catch (error) {
        log.error("failed to scrape homepage", { error: String(error) });
        pagesFailed++;
      }

      // 2. Scrape all L1 + L2 category pages
      const allCategories = await this.db
        .select({ slug: categories.slug, categoryLevel: categories.categoryLevel })
        .from(categories)
        .where(sql`${categories.categoryLevel} <= 2`);

      log.info("scraping category pages", { count: allCategories.length });

      for (const cat of allCategories) {
        try {
          const count = await this.scrapePage(urls.category(cat.slug), run.id);
          sightingsRecorded += count;
          pagesScraped++;
        } catch (error) {
          log.error("failed to scrape category", { slug: cat.slug, error: String(error) });
          pagesFailed++;
        }
      }

      await this.db
        .update(scrapeRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          metadata: {
            pages_scraped: pagesScraped,
            pages_failed: pagesFailed,
            sightings_recorded: sightingsRecorded,
            duration_ms: Date.now() - startTime,
          },
        })
        .where(eq(scrapeRuns.id, run.id));

      log.info("featured apps scrape completed", {
        pagesScraped,
        pagesFailed,
        sightingsRecorded,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      await this.db
        .update(scrapeRuns)
        .set({
          status: "failed",
          completedAt: new Date(),
          error: String(error),
          metadata: { duration_ms: Date.now() - startTime },
        })
        .where(eq(scrapeRuns.id, run.id));
      throw error;
    }
  }

  /** Scrape a single page for featured sections */
  async scrapePage(url: string, runId: string): Promise<number> {
    const html = await this.httpClient.fetchPage(url);
    const sections = parseFeaturedSections(html);

    if (sections.length === 0) {
      log.debug("no featured sections found", { url });
      return 0;
    }

    // Fix Shopify's occasional wrong handles on category L2 pages:
    // The main section (h2 "Recommended ...") sometimes has a handle from a
    // different category due to a Shopify bug. Use the URL slug as truth.
    const urlSlug = url.match(/\/categories\/(.+?)(?:\?|$)/)?.[1];
    if (urlSlug) {
      const mainSection = sections.find(
        (s) =>
          s.sectionTitle.toLowerCase().startsWith("recommended") ||
          s.sectionHandle === urlSlug
      );
      if (mainSection && mainSection.sectionHandle !== urlSlug) {
        log.warn("correcting mismatched section handle from URL", {
          url,
          oldHandle: mainSection.sectionHandle,
          newHandle: urlSlug,
        });
        mainSection.sectionHandle = urlSlug;
        mainSection.surfaceDetail = urlSlug;
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    let count = 0;

    for (const section of sections) {
      for (const app of section.apps) {
        // Upsert app master record
        await this.db
          .insert(apps)
          .values({
            slug: app.slug,
            name: app.name,
            iconUrl: app.iconUrl || null,
          })
          .onConflictDoUpdate({
            target: apps.slug,
            set: {
              name: app.name,
              ...(app.iconUrl ? { iconUrl: app.iconUrl } : {}),
              updatedAt: new Date(),
            },
          });

        // Upsert featured sighting
        await this.db
          .insert(featuredAppSightings)
          .values({
            appSlug: app.slug,
            surface: section.surface,
            surfaceDetail: section.surfaceDetail,
            sectionHandle: section.sectionHandle,
            sectionTitle: section.sectionTitle,
            position: app.position,
            seenDate: todayStr,
            firstSeenRunId: runId,
            lastSeenRunId: runId,
            timesSeenInDay: 1,
          })
          .onConflictDoUpdate({
            target: [
              featuredAppSightings.appSlug,
              featuredAppSightings.sectionHandle,
              featuredAppSightings.surfaceDetail,
              featuredAppSightings.seenDate,
            ],
            set: {
              lastSeenRunId: runId,
              position: app.position,
              sectionTitle: section.sectionTitle,
              timesSeenInDay: sql`${featuredAppSightings.timesSeenInDay} + 1`,
            },
          });

        count++;
      }
    }

    log.info("recorded featured sightings", {
      url,
      sections: sections.length,
      sightings: count,
    });

    return count;
  }
}
