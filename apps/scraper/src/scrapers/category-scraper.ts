import { eq, sql } from "drizzle-orm";
import type { Database } from "@shopify-tracking/db";
import {
  scrapeRuns,
  categories,
  categorySnapshots,
  apps,
  appCategoryRankings,
  featuredAppSightings,
  categoryAdSightings,
} from "@shopify-tracking/db";
import {
  SEED_CATEGORY_SLUGS,
  MAX_CATEGORY_DEPTH,
  urls,
  createLogger,
  type CategoryNode,
} from "@shopify-tracking/shared";
import { HttpClient } from "../http-client.js";
import {
  parseCategoryPage,
  hasNextPage,
} from "../parsers/category-parser.js";
import { parseFeaturedSections } from "../parsers/featured-parser.js";

export interface ScrapePageOptions {
  pages?: "first" | "all" | number;
}

const log = createLogger("category-scraper");

export interface CategoryScraperOptions {
  maxDepth?: number;
  httpClient?: HttpClient;
}

export class CategoryScraper {
  private db: Database;
  private httpClient: HttpClient;
  private maxDepth: number;
  private visited = new Set<string>();
  private singleMode = false;
  private featuredSightingsCount = 0;
  private categoryAdSightingsCount = 0;

  constructor(db: Database, options: CategoryScraperOptions = {}) {
    this.db = db;
    this.httpClient = options.httpClient || new HttpClient();
    this.maxDepth = options.maxDepth ?? MAX_CATEGORY_DEPTH;
  }

  /**
   * Crawl the full category tree starting from the 6 seed categories.
   * Returns the complete tree as an array of root nodes.
   */
  async crawl(triggeredBy?: string, pageOptions?: ScrapePageOptions): Promise<{ tree: CategoryNode[]; discoveredSlugs: string[] }> {
    log.info("starting full category tree crawl");

    // Create scrape run
    const [run] = await this.db
      .insert(scrapeRuns)
      .values({
        scraperType: "category",
        status: "running",
        createdAt: new Date(),
        startedAt: new Date(),
        triggeredBy,
      })
      .returning();

    const startTime = Date.now();
    const tree: CategoryNode[] = [];
    const allDiscoveredSlugs = new Set<string>();
    let itemsScraped = 0;
    let itemsFailed = 0;
    this.featuredSightingsCount = 0;
    this.categoryAdSightingsCount = 0;

    try {
      // Scrape homepage featured apps before category crawl
      try {
        const homeHtml = await this.httpClient.fetchPage(urls.home());
        await this.recordFeaturedSightings(homeHtml, run.id, urls.home());
      } catch (error) {
        log.error("failed to scrape homepage featured apps", { error: String(error) });
      }

      for (const slug of SEED_CATEGORY_SLUGS) {
        try {
          const { node, appSlugs } = await this.crawlCategory(slug, null, 0, run.id, pageOptions);
          if (node) {
            tree.push(node);
            itemsScraped += this.countNodes(node);
          }
          for (const s of appSlugs) allDiscoveredSlugs.add(s);
        } catch (error) {
          log.error("failed to crawl root category", { slug, error: String(error) });
          itemsFailed++;
        }
      }

      // Mark run as completed
      await this.db
        .update(scrapeRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          metadata: {
            items_scraped: itemsScraped,
            items_failed: itemsFailed,
            featured_sightings: this.featuredSightingsCount,
            category_ad_sightings: this.categoryAdSightingsCount,
            duration_ms: Date.now() - startTime,
          },
        })
        .where(eq(scrapeRuns.id, run.id));

      log.info("crawl completed", { itemsScraped, itemsFailed, featuredSightings: this.featuredSightingsCount, categoryAdSightings: this.categoryAdSightingsCount, discoveredApps: allDiscoveredSlugs.size, durationMs: Date.now() - startTime });
    } catch (error) {
      await this.db
        .update(scrapeRuns)
        .set({
          status: "failed",
          completedAt: new Date(),
          error: String(error),
          metadata: {
            items_scraped: itemsScraped,
            items_failed: itemsFailed,
            duration_ms: Date.now() - startTime,
          },
        })
        .where(eq(scrapeRuns.id, run.id));

      throw error;
    }

    return { tree, discoveredSlugs: [...allDiscoveredSlugs] };
  }

  /**
   * Scrape a single category (no recursion into subcategories).
   */
  async scrapeSingle(slug: string, triggeredBy?: string, pageOptions?: ScrapePageOptions): Promise<string[]> {
    log.info("scraping single category", { slug });

    // Look up existing category info
    const [existing] = await this.db
      .select({ parentSlug: categories.parentSlug, categoryLevel: categories.categoryLevel })
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    const [run] = await this.db
      .insert(scrapeRuns)
      .values({
        scraperType: "category",
        status: "running",
        createdAt: new Date(),
        startedAt: new Date(),
        triggeredBy,
      })
      .returning();

    const startTime = Date.now();
    this.singleMode = true;
    let discoveredSlugs: string[] = [];
    try {
      const depth = existing?.categoryLevel ?? 1;
      const result = await this.crawlCategory(slug, existing?.parentSlug ?? null, depth, run.id, pageOptions);
      discoveredSlugs = result.appSlugs;
      await this.db
        .update(scrapeRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          metadata: { items_scraped: 1, items_failed: 0, duration_ms: Date.now() - startTime },
        })
        .where(eq(scrapeRuns.id, run.id));
      log.info("single category scrape completed", { slug, discoveredApps: discoveredSlugs.length, categoryAdSightings: this.categoryAdSightingsCount, durationMs: Date.now() - startTime });
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
    } finally {
      this.singleMode = false;
    }
    return discoveredSlugs;
  }

  private async crawlCategory(
    slug: string,
    parentSlug: string | null,
    depth: number,
    runId: string,
    pageOptions?: ScrapePageOptions
  ): Promise<{ node: CategoryNode | null; appSlugs: string[] }> {
    if (this.visited.has(slug)) return { node: null, appSlugs: [] };
    this.visited.add(slug);

    log.info("crawling category", { slug, depth });

    // Listing pages use /all suffix to avoid redirect issues (Shopify 302-redirects
    // /categories/{slug} to /categories/{slug}/all, but may drop ?page=N params).
    // Hub pages (level 0, some level 1) don't have /all URLs → use canonical URL.
    // Strategy: try /all first; on 404, fall back to canonical URL.
    const allUrl = urls.categoryAll(slug);
    const canonicalUrl = urls.category(slug);
    const discoveredSlugs: string[] = [];

    let dataSourceUrl: string;
    let html: string;

    try {
      html = await this.httpClient.fetchPage(allUrl);
      dataSourceUrl = allUrl;
    } catch (error) {
      // /all URL failed (hub pages return 404) → try canonical URL
      try {
        html = await this.httpClient.fetchPage(canonicalUrl);
        dataSourceUrl = canonicalUrl;
      } catch (error2) {
        log.error("failed to fetch category page", { url: canonicalUrl, error: String(error2) });
        return { node: null, appSlugs: [] };
      }
    }

    const pageData = parseCategoryPage(html, dataSourceUrl);

    // Parse featured sections from this page (only L0-L2 have featured content)
    if (depth <= 2) {
      try {
        await this.recordFeaturedSightings(html, runId, dataSourceUrl);
      } catch (error) {
        log.warn("failed to parse featured sections", { slug, error: String(error) });
      }
    }

    // Detect listing page: hub pages never have "N apps" count text
    const isListingPage = pageData.app_count !== null;

    // Upsert category master record (store canonical URL without /all)
    await this.db
      .insert(categories)
      .values({
        slug,
        title: pageData.title,
        url: canonicalUrl,
        parentSlug,
        categoryLevel: depth,
        description: pageData.description,
        isListingPage,
      })
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          title: pageData.title,
          description: pageData.description,
          parentSlug,
          categoryLevel: depth,
          isListingPage,
          updatedAt: new Date(),
        },
      });

    // Track seen app slugs across all pages for deduplication
    const seenAppSlugs = new Set<string>();

    // Insert snapshot (skip for root categories with no app data)
    if (depth > 0 || pageData.first_page_apps.length > 0) {
      await this.db.insert(categorySnapshots).values({
        categorySlug: slug,
        scrapeRunId: runId,
        scrapedAt: new Date(),
        dataSourceUrl,
        appCount: pageData.app_count,
        firstPageMetrics: pageData.first_page_metrics,
        // Listing pages: app data lives in app_category_rankings
        // Hub pages: store featured apps here (they're NOT rankings)
        firstPageApps: isListingPage ? [] : pageData.first_page_apps,
        breadcrumb: pageData.breadcrumb,
      });

      if (isListingPage) {
        // Record app rankings from first page (only for listing pages)
        await this.recordAppRankings(
          pageData.first_page_apps,
          slug,
          runId
        );
      } else {
        // Hub pages: still upsert app master records for discovery (without rankings)
        await this.ensureAppRecords(pageData.first_page_apps);
      }

      // Record category ad sightings for sponsored apps (both listing and hub pages)
      await this.recordCategoryAdSightings(pageData.first_page_apps, slug, runId);

      // Collect discovered slugs from first page (always, regardless of page type)
      for (const app of pageData.first_page_apps) {
        const appSlug = app.app_url.replace("https://apps.shopify.com/", "");
        if (appSlug) {
          discoveredSlugs.push(appSlug);
          seenAppSlugs.add(appSlug);
        }
      }
    }

    // Multi-page support: fetch additional pages (listing pages only, default 10 pages)
    if (isListingPage && depth > 0 && pageOptions?.pages !== "first") {
      const maxPages = pageOptions?.pages === "all" ? 50
        : typeof pageOptions?.pages === "number" ? pageOptions.pages
        : 10;

      if (maxPages > 1) {
        let currentPage = 1;
        let currentHtml = html;
        let totalAppsRecorded = pageData.first_page_apps.length;

        while (currentPage < maxPages && hasNextPage(currentHtml)) {
          currentPage++;
          // Use /all?page=N directly to avoid redirect issues
          // (Shopify 302-redirects /categories/{slug}?page=N and may drop the page param)
          const pageUrl = urls.categoryAll(slug, currentPage);
          try {
            currentHtml = await this.httpClient.fetchPage(pageUrl);
          } catch (error) {
            log.warn("failed to fetch category page", { slug, page: currentPage, error: String(error) });
            break;
          }

          const nextPageData = parseCategoryPage(currentHtml, pageUrl);

          // Deduplicate across pages (sponsored apps can appear on multiple pages)
          const newApps = nextPageData.first_page_apps.filter(app => {
            const appSlug = app.app_url.replace("https://apps.shopify.com/", "");
            if (seenAppSlugs.has(appSlug)) return false;
            seenAppSlugs.add(appSlug);
            return true;
          });

          // Record additional page app rankings with global position offset
          await this.recordAppRankings(newApps, slug, runId, totalAppsRecorded);
          await this.recordCategoryAdSightings(newApps, slug, runId);
          totalAppsRecorded += newApps.length;
          for (const app of newApps) {
            const appSlug = app.app_url.replace("https://apps.shopify.com/", "");
            if (appSlug) discoveredSlugs.push(appSlug);
          }

          // Debug logging — helps diagnose data extraction issues per page
          const sampleApp = nextPageData.first_page_apps[0];
          log.info("category page scraped", {
            slug, page: currentPage,
            totalParsed: nextPageData.first_page_apps.length,
            newApps: newApps.length,
            sampleHasLogo: !!sampleApp?.logo_url,
            sampleHasRating: (sampleApp?.average_rating ?? 0) > 0,
            sampleHasPricing: !!sampleApp?.pricing_hint,
          });

          // If page returned 0 new apps, we've likely hit the end or a loop
          if (newApps.length === 0) {
            log.info("no new apps found, stopping pagination", { slug, page: currentPage });
            break;
          }
        }
      }
    }

    // Recurse into subcategories (skip in single mode)
    const children: CategoryNode[] = [];
    if (!this.singleMode && depth < this.maxDepth) {
      for (const sub of pageData.subcategory_links) {
        const { node: childNode, appSlugs: childSlugs } = await this.crawlCategory(
          sub.slug,
          slug,
          depth + 1,
          runId,
          pageOptions
        );
        if (childNode) children.push(childNode);
        for (const s of childSlugs) discoveredSlugs.push(s);
      }
    }

    return {
      node: {
        slug,
        url: canonicalUrl,
        data_source_url: dataSourceUrl,
        title: pageData.title,
        breadcrumb: pageData.breadcrumb,
        description: pageData.description,
        app_count: depth === 0 ? null : pageData.app_count,
        first_page_metrics: depth === 0 ? null : pageData.first_page_metrics,
        first_page_apps: depth === 0 ? [] : pageData.first_page_apps,
        parent_slug: parentSlug,
        category_level: depth,
        children,
      },
      appSlugs: discoveredSlugs,
    };
  }

  /**
   * Ensure each app from first_page_apps exists in the apps table,
   * then record their category ranking positions.
   */
  private async recordAppRankings(
    appList: { app_url: string; name: string; short_description?: string; is_built_for_shopify?: boolean; is_sponsored?: boolean; position?: number; logo_url?: string; average_rating?: number; rating_count?: number; pricing_hint?: string }[],
    categorySlug: string,
    runId: string,
    positionOffset = 0
  ): Promise<void> {
    const now = new Date();

    for (let i = 0; i < appList.length; i++) {
      const app = appList[i];
      const appSlug = app.app_url.replace(
        "https://apps.shopify.com/",
        ""
      );

      // Sponsored listings show ad boilerplate instead of real subtitle — skip subtitle update
      const subtitle = app.is_sponsored ? undefined : (app.short_description || undefined);

      // Only write rating/count if genuinely > 0 (0 means parser extraction failed, don't overwrite valid data)
      const hasRating = app.average_rating != null && app.average_rating > 0;
      const hasCount = app.rating_count != null && app.rating_count > 0;

      // Upsert app master record with all listing data
      await this.db
        .insert(apps)
        .values({
          slug: appSlug,
          name: app.name,
          isBuiltForShopify: !!app.is_built_for_shopify,
          appCardSubtitle: subtitle,
          ...(app.logo_url && { iconUrl: app.logo_url }),
          ...(hasRating && { averageRating: String(app.average_rating) }),
          ...(hasCount && { ratingCount: app.rating_count }),
          ...(app.pricing_hint && { pricingHint: app.pricing_hint }),
        })
        .onConflictDoUpdate({
          target: apps.slug,
          set: {
            name: app.name,
            isBuiltForShopify: !!app.is_built_for_shopify,
            ...(subtitle !== undefined && { appCardSubtitle: subtitle }),
            ...(app.logo_url && { iconUrl: sql`COALESCE(${apps.iconUrl}, ${app.logo_url})` }),
            ...(hasRating && { averageRating: String(app.average_rating) }),
            ...(hasCount && { ratingCount: app.rating_count }),
            ...(app.pricing_hint && { pricingHint: app.pricing_hint }),
            updatedAt: now,
          },
        });

      // Record ranking with global position across pages
      await this.db.insert(appCategoryRankings).values({
        appSlug,
        categorySlug,
        scrapeRunId: runId,
        scrapedAt: now,
        position: positionOffset + (app.position || i + 1),
      });
    }
  }

  /**
   * Record category ad sightings for sponsored apps.
   */
  private async recordCategoryAdSightings(
    appList: { app_url: string; is_sponsored?: boolean }[],
    categorySlug: string,
    runId: string
  ): Promise<void> {
    const sponsoredApps = appList.filter((a) => a.is_sponsored);
    log.info("recording category ad sightings", {
      categorySlug,
      totalApps: appList.length,
      sponsoredCount: sponsoredApps.length,
      sponsoredSlugs: sponsoredApps.map((a) => a.app_url.replace("https://apps.shopify.com/", "")),
    });
    const todayStr = new Date().toISOString().slice(0, 10);

    for (const app of appList) {
      if (!app.is_sponsored) continue;
      const appSlug = app.app_url.replace("https://apps.shopify.com/", "");
      if (!appSlug) continue;

      await this.db
        .insert(categoryAdSightings)
        .values({
          appSlug,
          categorySlug,
          seenDate: todayStr,
          firstSeenRunId: runId,
          lastSeenRunId: runId,
          timesSeenInDay: 1,
        })
        .onConflictDoUpdate({
          target: [
            categoryAdSightings.appSlug,
            categoryAdSightings.categorySlug,
            categoryAdSightings.seenDate,
          ],
          set: {
            lastSeenRunId: runId,
            timesSeenInDay: sql`${categoryAdSightings.timesSeenInDay} + 1`,
          },
        });

      this.categoryAdSightingsCount++;
    }
  }

  /**
   * Upsert app master records without recording rankings.
   * Used for hub pages where apps are featured/recommended, not ranked.
   */
  private async ensureAppRecords(
    appList: { app_url: string; name: string; short_description?: string; is_built_for_shopify?: boolean; is_sponsored?: boolean; logo_url?: string; average_rating?: number; rating_count?: number; pricing_hint?: string }[]
  ): Promise<void> {
    const now = new Date();
    for (const app of appList) {
      const appSlug = app.app_url.replace("https://apps.shopify.com/", "");
      const subtitle = app.is_sponsored ? undefined : (app.short_description || undefined);
      const hasRating = app.average_rating != null && app.average_rating > 0;
      const hasCount = app.rating_count != null && app.rating_count > 0;

      await this.db
        .insert(apps)
        .values({
          slug: appSlug,
          name: app.name,
          isBuiltForShopify: !!app.is_built_for_shopify,
          appCardSubtitle: subtitle,
          ...(app.logo_url && { iconUrl: app.logo_url }),
          ...(hasRating && { averageRating: String(app.average_rating) }),
          ...(hasCount && { ratingCount: app.rating_count }),
          ...(app.pricing_hint && { pricingHint: app.pricing_hint }),
        })
        .onConflictDoUpdate({
          target: apps.slug,
          set: {
            name: app.name,
            isBuiltForShopify: !!app.is_built_for_shopify,
            ...(subtitle !== undefined && { appCardSubtitle: subtitle }),
            ...(app.logo_url && { iconUrl: sql`COALESCE(${apps.iconUrl}, ${app.logo_url})` }),
            ...(hasRating && { averageRating: String(app.average_rating) }),
            ...(hasCount && { ratingCount: app.rating_count }),
            ...(app.pricing_hint && { pricingHint: app.pricing_hint }),
            updatedAt: now,
          },
        });
    }
  }

  /**
   * Parse featured sections from HTML and record sightings.
   * Ported from FeaturedAppsScraper.scrapePage().
   */
  private async recordFeaturedSightings(html: string, runId: string, pageUrl: string): Promise<void> {
    const sections = parseFeaturedSections(html);
    if (sections.length === 0) return;

    // Fix Shopify's occasional wrong handles on category L2 pages:
    // The main section (h2 "Recommended ...") sometimes has a handle from a
    // different category due to a Shopify bug. Use the URL slug as truth.
    const urlSlug = pageUrl.match(/\/categories\/(.+?)(?:\?|\/|$)/)?.[1];
    if (urlSlug) {
      const mainSection = sections.find(
        (s) =>
          s.sectionTitle.toLowerCase().startsWith("recommended") ||
          s.sectionHandle === urlSlug
      );
      if (mainSection && mainSection.sectionHandle !== urlSlug) {
        log.warn("correcting mismatched section handle from URL", {
          url: pageUrl,
          oldHandle: mainSection.sectionHandle,
          newHandle: urlSlug,
        });
        mainSection.sectionHandle = urlSlug;
        mainSection.surfaceDetail = urlSlug;
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);

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

        this.featuredSightingsCount++;
      }
    }

    log.info("recorded featured sightings", {
      url: pageUrl,
      sections: sections.length,
      sightings: sections.reduce((sum, s) => sum + s.apps.length, 0),
    });
  }

  private countNodes(node: CategoryNode): number {
    return 1 + node.children.reduce((sum, c) => sum + this.countNodes(c), 0);
  }
}
