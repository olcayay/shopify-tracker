import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { scrapeRuns, apps, appSnapshots, appFieldChanges, similarAppSightings, categories } from "@appranks/db";
import { urls, createLogger } from "@appranks/shared";

const log = createLogger("app-details-scraper");
import { HttpClient } from "../http-client.js";
import { parseAppPage, parseSimilarApps } from "../parsers/app-parser.js";

export class AppDetailsScraper {
  private db: Database;
  private httpClient: HttpClient;

  constructor(db: Database, httpClient?: HttpClient) {
    this.db = db;
    this.httpClient = httpClient || new HttpClient();
  }

  /** Scrape details for all tracked apps */
  async scrapeTracked(triggeredBy?: string, queue?: string): Promise<void> {
    const trackedApps = await this.db
      .select({ id: apps.id, slug: apps.slug, name: apps.name })
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
        createdAt: new Date(),
        startedAt: new Date(),
        triggeredBy,
        queue,
      })
      .returning();

    const startTime = Date.now();
    let itemsScraped = 0;
    let itemsFailed = 0;

    for (const app of trackedApps) {
      try {
        await this.scrapeApp(app.slug, run.id, triggeredBy);
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
  async scrapeApp(slug: string, runId?: string, triggeredBy?: string, queue?: string): Promise<void> {
    log.info("scraping app", { slug });

    // Look up the app's integer ID (or create if needed later)
    const [existingApp] = await this.db
      .select({ id: apps.id })
      .from(apps)
      .where(eq(apps.slug, slug))
      .limit(1);

    // Skip if already scraped within 12 hours
    if (existingApp) {
      const [recentSnapshot] = await this.db
        .select({ scrapedAt: appSnapshots.scrapedAt })
        .from(appSnapshots)
        .where(eq(appSnapshots.appId, existingApp.id))
        .orderBy(desc(appSnapshots.scrapedAt))
        .limit(1);

      if (recentSnapshot) {
        const hoursSince = (Date.now() - recentSnapshot.scrapedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 12) {
          log.info("skipping recently scraped app", { slug, hoursSince: hoursSince.toFixed(1) });
          return;
        }
      }
    }

    // Create run if not provided (standalone mode)
    const isStandalone = !runId;
    const startTime = Date.now();
    if (!runId) {
      const [run] = await this.db
        .insert(scrapeRuns)
        .values({
          scraperType: "app_details",
          status: "running",
          startedAt: new Date(),
          triggeredBy,
          queue,
        })
        .returning();
      runId = run.id;
    }

    try {
      const html = await this.httpClient.fetchPage(urls.app(slug));
      const details = parseAppPage(html, slug);

      // Change detection: compare against current state
      const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];

      const [currentApp] = await this.db
        .select({ name: apps.name })
        .from(apps)
        .where(eq(apps.slug, slug));

      if (currentApp && currentApp.name !== details.app_name) {
        changes.push({ field: "name", oldValue: currentApp.name, newValue: details.app_name });
      }

      // Get previous snapshot by app ID if we have one
      let prevSnapshot: {
        appIntroduction: string;
        appDetails: string;
        features: string[];
        seoTitle: string;
        seoMetaDescription: string;
      } | undefined;

      if (existingApp) {
        const [snap] = await this.db
          .select({
            appIntroduction: appSnapshots.appIntroduction,
            appDetails: appSnapshots.appDetails,
            features: appSnapshots.features,
            seoTitle: appSnapshots.seoTitle,
            seoMetaDescription: appSnapshots.seoMetaDescription,
          })
          .from(appSnapshots)
          .where(eq(appSnapshots.appId, existingApp.id))
          .orderBy(desc(appSnapshots.scrapedAt))
          .limit(1);

        prevSnapshot = snap;
      }

      if (prevSnapshot) {
        const fieldMap: Record<string, [string, string]> = {
          appIntroduction: [prevSnapshot.appIntroduction, details.app_introduction],
          appDetails: [prevSnapshot.appDetails, details.app_details],
          seoTitle: [prevSnapshot.seoTitle, details.seo_title],
          seoMetaDescription: [prevSnapshot.seoMetaDescription, details.seo_meta_description],
        };
        for (const [field, [oldVal, newVal]] of Object.entries(fieldMap)) {
          if (oldVal !== newVal) {
            changes.push({ field, oldValue: oldVal, newValue: newVal });
          }
        }
        const oldFeatures = JSON.stringify(prevSnapshot.features);
        const newFeatures = JSON.stringify(details.features);
        if (oldFeatures !== newFeatures) {
          changes.push({ field: "features", oldValue: oldFeatures, newValue: newFeatures });
        }
      }

      // Upsert app master record
      const [upsertedApp] = await this.db
        .insert(apps)
        .values({
          platform: "shopify",
          slug,
          name: details.app_name,
          isTracked: true,
          launchedDate: details.launched_date,
          iconUrl: details.icon_url,
        })
        .onConflictDoUpdate({
          target: [apps.platform, apps.slug],
          set: {
            name: details.app_name,
            launchedDate: details.launched_date,
            iconUrl: details.icon_url,
            updatedAt: new Date(),
          },
        })
        .returning({ id: apps.id });

      const appId = upsertedApp.id;

      if (changes.length > 0) {
        await this.db.insert(appFieldChanges).values(
          changes.map((c) => ({
            appId,
            field: c.field,
            oldValue: c.oldValue,
            newValue: c.newValue,
            scrapeRunId: runId!,
          }))
        );
        log.info("detected field changes", { slug, fields: changes.map((c) => c.field) });
      }

      // Insert snapshot
      await this.db.insert(appSnapshots).values({
        appId,
        scrapeRunId: runId,
        scrapedAt: new Date(),
        appIntroduction: details.app_introduction,
        appDetails: details.app_details,
        seoTitle: details.seo_title,
        seoMetaDescription: details.seo_meta_description,
        features: details.features,
        pricing: details.pricing,
        averageRating: details.average_rating?.toString() ?? null,
        ratingCount: details.rating_count,
        developer: details.developer,
        demoStoreUrl: details.demo_store_url,
        languages: details.languages,
        integrations: details.integrations,
        categories: details.categories,
        pricingPlans: details.pricing_plans,
        support: details.support,
      });

      // Register missing categories from snapshot data
      if (details.categories.length > 0) {
        for (const cat of details.categories) {
          const slugMatch = cat.url.match(/\/categories\/([^/]+)/);
          if (!slugMatch) continue;
          const catSlug = slugMatch[1];
          await this.db
            .insert(categories)
            .values({
              platform: "shopify",
              slug: catSlug,
              title: cat.title,
              url: cat.url,
              parentSlug: null,
              categoryLevel: 0,
              isTracked: false,
              isListingPage: true,
            })
            .onConflictDoNothing({ target: [categories.platform, categories.slug] });
        }
      }

      // Record similar apps ("More apps like this")
      const similarApps = parseSimilarApps(html);
      if (similarApps.length > 0) {
        const todayStr = new Date().toISOString().slice(0, 10);
        for (const similar of similarApps) {
          // Ensure similar app exists in apps table
          const [upsertedSimilar] = await this.db
            .insert(apps)
            .values({
              platform: "shopify",
              slug: similar.slug,
              name: similar.name,
              iconUrl: similar.icon_url || null,
            })
            .onConflictDoUpdate({
              target: [apps.platform, apps.slug],
              set: {
                name: similar.name,
                iconUrl: similar.icon_url || undefined,
                updatedAt: new Date(),
              },
            })
            .returning({ id: apps.id });

          // Upsert sighting (one per appId + similarAppId + date)
          await this.db
            .insert(similarAppSightings)
            .values({
              appId,
              similarAppId: upsertedSimilar.id,
              position: similar.position ?? null,
              seenDate: todayStr,
              firstSeenRunId: runId!,
              lastSeenRunId: runId!,
              timesSeenInDay: 1,
            })
            .onConflictDoUpdate({
              target: [
                similarAppSightings.appId,
                similarAppSightings.similarAppId,
                similarAppSightings.seenDate,
              ],
              set: {
                lastSeenRunId: runId!,
                position: similar.position ?? null,
                timesSeenInDay: sql`${similarAppSightings.timesSeenInDay} + 1`,
              },
            });
        }
        log.info("recorded similar apps", { slug, count: similarApps.length });
      }

      // Complete the run in standalone mode
      if (isStandalone) {
        await this.db
          .update(scrapeRuns)
          .set({
            status: "completed",
            completedAt: new Date(),
            metadata: {
              items_scraped: 1,
              items_failed: 0,
              duration_ms: Date.now() - startTime,
            },
          })
          .where(eq(scrapeRuns.id, runId));
      }
    } catch (error) {
      if (isStandalone) {
        await this.db
          .update(scrapeRuns)
          .set({
            status: "failed",
            completedAt: new Date(),
            error: String(error),
            metadata: { duration_ms: Date.now() - startTime },
          })
          .where(eq(scrapeRuns.id, runId));
      }
      throw error;
    }
  }
}
