import { eq, and, sql, inArray, desc } from "drizzle-orm";
import type { Database } from "@appranks/db";
import {
  scrapeRuns,
  categories,
  categorySnapshots,
  apps,
  appSnapshots,
  appFieldChanges,
  appCategoryRankings,
  featuredAppSightings,
  categoryAdSightings,
  categoryParents,
} from "@appranks/db";
import {
  SEED_CATEGORY_SLUGS,
  MAX_CATEGORY_DEPTH,
  urls,
  createLogger,
  clampRating,
  clampCount,
  clampPosition,
  type CategoryNode,
  type PlatformId,
} from "@appranks/shared";
import { HttpClient } from "../http-client.js";
import {
  parseCategoryPage,
  hasNextPage,
} from "../parsers/category-parser.js";
import { parseFeaturedSections } from "../parsers/featured-parser.js";
import type { PlatformModule, NormalizedCategoryApp } from "../platforms/platform-module.js";
import { recordItemError } from "../utils/record-item-error.js";
import { runConcurrent } from "../utils/run-concurrent.js";

export interface ScrapePageOptions {
  pages?: "first" | "all" | number;
}

const log = createLogger("category-scraper");

export interface CategoryScraperOptions {
  maxDepth?: number;
  httpClient?: HttpClient;
  platformModule?: PlatformModule;
}

export class CategoryScraper {
  private db: Database;
  private httpClient: HttpClient;
  private maxDepth: number;
  private visited = new Set<string>();
  private singleMode = false;
  private featuredSightingsCount = 0;
  private categoryAdSightingsCount = 0;
  private platform: PlatformId;
  private platformModule?: PlatformModule;
  public jobId?: string;
  /** Resolved runtime config (code defaults + DB overrides). Set by process-job.ts. */
  public resolvedConfig?: import("../config-resolver.js").ResolvedScraperConfig;

  /** Read a config value with priority: resolved (DB) → platform constants → fallback. */
  private configValue<T>(key: string, fallback: T): T {
    const read = (src: unknown, path: string): unknown => {
      if (!src || typeof src !== "object") return undefined;
      let cursor: any = src;
      for (const part of path.split(".")) {
        if (cursor == null || typeof cursor !== "object") return undefined;
        cursor = cursor[part];
      }
      return cursor;
    };
    const resolved = read(this.resolvedConfig?.merged, key);
    if (resolved !== undefined) return resolved as T;
    const fromPlatform = read(this.platformModule?.constants as unknown, key);
    if (fromPlatform !== undefined) return fromPlatform as T;
    return fallback;
  }

  constructor(db: Database, options: CategoryScraperOptions = {}) {
    this.db = db;
    this.httpClient = options.httpClient || new HttpClient();
    this.platformModule = options.platformModule;
    this.platform = options.platformModule?.platformId ?? "shopify";
    this.maxDepth = options.maxDepth ?? (options.platformModule?.constants.maxCategoryDepth ?? MAX_CATEGORY_DEPTH);
  }

  private get seedCategories(): readonly string[] {
    return this.platformModule?.constants.seedCategories ?? SEED_CATEGORY_SLUGS;
  }

  private get isShopify(): boolean {
    return this.platform === "shopify";
  }

  /**
   * Crawl the full category tree starting from the 6 seed categories.
   * Returns the complete tree as an array of root nodes.
   */
  async crawl(triggeredBy?: string, pageOptions?: ScrapePageOptions, queue?: string): Promise<{ tree: CategoryNode[]; discoveredSlugs: string[] }> {
    log.info("starting full category tree crawl");

    // Create scrape run
    const [run] = await this.db
      .insert(scrapeRuns)
      .values({
        scraperType: "category",
        platform: this.platform,
        status: "running",
        createdAt: new Date(),
        startedAt: new Date(),
        triggeredBy,
        queue,
        jobId: this.jobId ?? null,
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
      // Scrape homepage featured apps before category crawl (Shopify only)
      if (this.isShopify) {
        try {
          const homeHtml = await this.httpClient.fetchPage(urls.home());
          await this.recordFeaturedSightings(homeHtml, run.id, urls.home());
        } catch (error) {
          log.error("failed to scrape homepage featured apps", { error: String(error) });
        }
      }

      // Scrape API-based featured sections (Atlassian: Spotlight, Bestseller, Rising Star)
      if (this.platformModule?.fetchFeaturedSections) {
        try {
          const sections = await this.platformModule.fetchFeaturedSections();
          await this.recordNormalizedFeaturedSections(sections, run.id);
        } catch (error) {
          log.error("failed to scrape API-based featured sections", { platform: this.platform, error: String(error) });
        }
      }

      const concurrency = this.configValue("concurrentSeedCategories", 1);

      const processSeed = async (slug: string) => {
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
          await recordItemError(this.db, {
            scrapeRunId: run.id,
            itemIdentifier: slug,
            itemType: "category",
            url: this.platformModule ? undefined : urls.category(slug),
            error,
          });
        }
      };

      if (concurrency > 1) {
        // Process seed categories in parallel batches
        for (let i = 0; i < this.seedCategories.length; i += concurrency) {
          const batch = this.seedCategories.slice(i, i + concurrency);
          await Promise.all(batch.map(processSeed));
        }
      } else {
        // Sequential (default for most platforms)
        for (const slug of this.seedCategories) {
          await processSeed(slug);
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
  async scrapeSingle(slug: string, triggeredBy?: string, pageOptions?: ScrapePageOptions, queue?: string): Promise<string[]> {
    log.info("scraping single category", { slug });

    // Look up existing category info (filter by platform to avoid cross-platform slug collisions)
    const [existing] = await this.db
      .select({ parentSlug: categories.parentSlug, categoryLevel: categories.categoryLevel })
      .from(categories)
      .where(and(eq(categories.slug, slug), eq(categories.platform, this.platform)))
      .limit(1);

    const [run] = await this.db
      .insert(scrapeRuns)
      .values({
        scraperType: "category",
        platform: this.platform,
        status: "running",
        createdAt: new Date(),
        startedAt: new Date(),
        triggeredBy,
        queue,
        jobId: this.jobId ?? null,
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

    log.info("crawling category", { slug, depth, platform: this.platform });

    const discoveredSlugs: string[] = [];

    // Platform-specific fetch logic
    if (this.platformModule && !this.isShopify) {
      return this.crawlCategoryGeneric(slug, parentSlug, depth, runId, pageOptions);
    }

    // --- Shopify-specific fetch logic ---
    // Listing pages use /all suffix to avoid redirect issues (Shopify 302-redirects
    // /categories/{slug} to /categories/{slug}/all, but may drop ?page=N params).
    // Hub pages (level 0, some level 1) don't have /all URLs → use canonical URL.
    // Strategy: try /all first; on 404, fall back to canonical URL.
    const allUrl = urls.categoryAll(slug);
    const canonicalUrl = urls.category(slug);

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

    // Debug: check if HTML contains ad markers
    const hasAdUrl = html.includes("surface_type=category_ad") || html.includes("surface_type=search_ad");
    const hasAdText = html.includes("app developer paid to promote") || html.includes("This ad is based on");
    log.info("ad markers in HTML", { slug, hasAdUrl, hasAdText });

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
    const [upsertedCategory] = await this.db
      .insert(categories)
      .values({
        platform: this.platform,
        slug,
        title: pageData.title,
        url: canonicalUrl,
        parentSlug,
        categoryLevel: depth,
        description: pageData.description,
        isListingPage,
      })
      .onConflictDoUpdate({
        target: [categories.platform, categories.slug],
        set: {
          title: pageData.title,
          description: pageData.description,
          parentSlug,
          categoryLevel: depth,
          isListingPage,
          updatedAt: new Date(),
        },
      })
      .returning({ id: categories.id });

    const categoryId = upsertedCategory.id;

    // Track seen app slugs across all pages for deduplication
    const seenAppSlugs = new Set<string>();

    // Insert snapshot (skip for root categories with no app data)
    if (depth > 0 || pageData.first_page_apps.length > 0) {
      await this.db.insert(categorySnapshots).values({
        categoryId,
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

      let firstPageSlugMap: Map<string, number> | undefined;
      if (isListingPage) {
        // Record app rankings from first page (only for listing pages)
        firstPageSlugMap = await this.recordAppRankings(
          pageData.first_page_apps,
          slug,
          runId
        );
      } else {
        // Hub pages: still upsert app master records for discovery (without rankings)
        await this.ensureAppRecords(pageData.first_page_apps);
      }

      // Record category ad sightings for sponsored apps (both listing and hub pages)
      await this.recordCategoryAdSightings(pageData.first_page_apps, categoryId, runId, firstPageSlugMap);

      // Collect discovered slugs from first page (always, regardless of page type)
      for (const app of pageData.first_page_apps) {
        const appSlug = app.app_url.replace("https://apps.shopify.com/", "");
        if (appSlug) {
          discoveredSlugs.push(appSlug);
          seenAppSlugs.add(appSlug);
        }
      }
    }

    // Multi-page support: fetch additional pages sequentially (listing pages only, default 10 pages)
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
          const pageSlugMap = await this.recordAppRankings(newApps, slug, runId, totalAppsRecorded);
          await this.recordCategoryAdSightings(newApps, categoryId, runId, pageSlugMap);
          totalAppsRecorded += newApps.length;
          for (const app of newApps) {
            const appSlug = app.app_url.replace("https://apps.shopify.com/", "");
            if (appSlug) discoveredSlugs.push(appSlug);
          }

          const sampleApp = nextPageData.first_page_apps[0];
          log.info("category page scraped", {
            slug, page: currentPage,
            totalParsed: nextPageData.first_page_apps.length,
            newApps: newApps.length,
            sampleHasLogo: !!sampleApp?.logo_url,
            sampleHasRating: (sampleApp?.average_rating ?? 0) > 0,
            sampleHasPricing: !!sampleApp?.pricing_hint,
          });

          if (newApps.length === 0) {
            log.info("no new apps found, stopping pagination", { slug, page: currentPage });
            break;
          }
        }
      }
    }

    // Recurse into subcategories with limited parallelism (skip in single mode)
    const children: CategoryNode[] = [];
    if (!this.singleMode && depth < this.maxDepth) {
      const subResults: { node: CategoryNode | null; appSlugs: string[] }[] = [];
      await runConcurrent(pageData.subcategory_links, async (sub) => {
        const result = await this.crawlCategory(sub.slug, slug, depth + 1, runId, pageOptions);
        subResults.push(result);
      }, 3);
      for (const { node: childNode, appSlugs: childSlugs } of subResults) {
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
   * Generic category crawl using PlatformModule interface.
   * Used for non-Shopify platforms (Salesforce, etc.) that return JSON from API.
   */
  private async crawlCategoryGeneric(
    slug: string,
    parentSlug: string | null,
    depth: number,
    runId: string,
    pageOptions?: ScrapePageOptions
  ): Promise<{ node: CategoryNode | null; appSlugs: string[] }> {
    const mod = this.platformModule!;
    const discoveredSlugs: string[] = [];
    const canonicalUrl = mod.buildCategoryUrl(slug);

    let json: string;
    try {
      json = await mod.fetchCategoryPage(slug, 1);
    } catch (error) {
      log.error("failed to fetch category page", { slug, platform: this.platform, error: String(error) });
      return { node: null, appSlugs: [] };
    }

    const normalized = mod.parseCategoryPage(json, canonicalUrl);

    // Check if this slug is a curated featured section (not a real category)
    const isFeaturedSection = mod.constants.featuredSectionSlugs?.includes(slug) ?? false;

    if (isFeaturedSection) {
      // Record apps as featured_app_sightings instead of category rankings
      await this.recordFeaturedSightingsFromApps(normalized.apps, slug, normalized.title, runId);
      // Collect discovered slugs for detail scraping
      for (const app of normalized.apps) {
        if (app.slug) discoveredSlugs.push(app.slug);
      }
      log.info("featured section scraped", {
        slug, platform: this.platform, apps: normalized.apps.length,
      });
      return {
        node: {
          slug,
          url: canonicalUrl,
          data_source_url: canonicalUrl,
          title: normalized.title,
          breadcrumb: "",
          description: normalized.description,
          app_count: normalized.apps.length,
          first_page_metrics: null,
          first_page_apps: [],
          parent_slug: null,
          category_level: 0,
          children: [],
        },
        appSlugs: discoveredSlugs,
      };
    }

    // Hub pages have appCount === null (no direct rankings)
    const isListingPage = normalized.appCount !== null;

    // Upsert category master record
    const [upsertedCategory] = await this.db
      .insert(categories)
      .values({
        platform: this.platform,
        slug,
        title: normalized.title,
        url: canonicalUrl,
        parentSlug,
        categoryLevel: depth,
        description: normalized.description,
        isListingPage,
      })
      .onConflictDoUpdate({
        target: [categories.platform, categories.slug],
        set: {
          title: normalized.title,
          description: normalized.description,
          parentSlug,
          categoryLevel: depth,
          isListingPage,
          updatedAt: new Date(),
        },
      })
      .returning({ id: categories.id });

    const categoryId = upsertedCategory.id;
    const seenAppSlugs = new Set<string>();

    // Upsert into category_parents junction table if parent is known
    if (parentSlug) {
      const [parentRow] = await this.db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.slug, parentSlug), eq(categories.platform, this.platform)))
        .limit(1);
      if (parentRow) {
        await this.db
          .insert(categoryParents)
          .values({ categoryId, parentCategoryId: parentRow.id })
          .onConflictDoNothing();
      }
    }

    // Insert snapshot
    await this.db.insert(categorySnapshots).values({
      categoryId,
      scrapeRunId: runId,
      scrapedAt: new Date(),
      dataSourceUrl: canonicalUrl,
      appCount: normalized.appCount,
      firstPageMetrics: null,
      firstPageApps: [],
      breadcrumb: "",
    });

    // Only record rankings and ads for listing pages (not hub pages)
    if (isListingPage) {
      await this.recordNormalizedAppRankings(normalized.apps, slug, runId, 0);
      await this.recordNormalizedCategoryAdSightings(normalized.apps, categoryId, runId);
    }

    for (const app of normalized.apps) {
      if (app.slug && !seenAppSlugs.has(app.slug)) {
        discoveredSlugs.push(app.slug);
        seenAppSlugs.add(app.slug);
      }
    }

    // Multi-page support (listing pages only)
    if (isListingPage && pageOptions?.pages !== "first") {
      const maxPages = pageOptions?.pages === "all" ? 50
        : typeof pageOptions?.pages === "number" ? pageOptions.pages
        : mod.constants.defaultPagesPerCategory;

      let currentPage = 1;
      let lastHasNextPage = normalized.hasNextPage;
      let totalOrganicRecorded = normalized.apps.filter(a => !a.isSponsored).length;

      while (currentPage < maxPages && lastHasNextPage) {
        currentPage++;
        try {
          const pageJson = await mod.fetchCategoryPage(slug, currentPage);
          // Parse with organic offset for continuous positioning
          // Use platform-specific parser if available, otherwise generic
          let pageNormalized;
          if (this.platform === "salesforce") {
            const { parseSalesforceCategoryPage } = await import("../platforms/salesforce/parsers/category-parser.js");
            pageNormalized = parseSalesforceCategoryPage(pageJson, slug, currentPage, totalOrganicRecorded);
          } else {
            pageNormalized = mod.parseCategoryPage(pageJson, mod.buildCategoryUrl(slug));
          }

          // Deduplicate across pages
          const newApps = pageNormalized.apps.filter(app => {
            if (seenAppSlugs.has(app.slug)) return false;
            seenAppSlugs.add(app.slug);
            return true;
          });

          await this.recordNormalizedAppRankings(newApps, slug, runId, totalOrganicRecorded);
          await this.recordNormalizedCategoryAdSightings(newApps, categoryId, runId);
          totalOrganicRecorded += newApps.filter(a => !a.isSponsored).length;

          for (const app of newApps) {
            if (app.slug) discoveredSlugs.push(app.slug);
          }

          log.info("category page scraped", {
            slug, page: currentPage, platform: this.platform,
            totalParsed: pageNormalized.apps.length,
            newApps: newApps.length,
          });

          lastHasNextPage = pageNormalized.hasNextPage;
          if (newApps.length === 0) {
            log.info("no new apps found, stopping pagination", { slug, page: currentPage });
            break;
          }
        } catch (error) {
          log.warn("failed to fetch category page", { slug, page: currentPage, error: String(error) });
          break;
        }
      }
    }

    // No subcategory recursion for flat platforms (maxCategoryDepth: 0)
    const children: CategoryNode[] = [];
    if (!this.singleMode && depth < this.maxDepth) {
      for (const sub of normalized.subcategoryLinks) {
        // For multi-parent subcategories (e.g., Canva shared topics): if already visited,
        // just add the junction row for this additional parent without re-scraping.
        if (this.visited.has(sub.slug) && sub.parentSlug) {
          await this.upsertCategoryParent(sub.slug, sub.parentSlug);
          continue;
        }
        const { node: childNode, appSlugs: childSlugs } = await this.crawlCategory(
          sub.slug, sub.parentSlug || slug, depth + 1, runId, pageOptions
        );
        if (childNode) children.push(childNode);
        for (const s of childSlugs) discoveredSlugs.push(s);
      }
    }

    return {
      node: {
        slug,
        url: canonicalUrl,
        data_source_url: canonicalUrl,
        title: normalized.title,
        breadcrumb: "",
        description: normalized.description,
        app_count: normalized.appCount,
        first_page_metrics: null,
        first_page_apps: [],
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
   * Returns a slug→id map for reuse by downstream methods (ad sightings, etc.)
   */
  private async recordAppRankings(
    appList: { app_url: string; name: string; short_description?: string; is_built_for_shopify?: boolean; is_sponsored?: boolean; position?: number; logo_url?: string; average_rating?: number; rating_count?: number; pricing_hint?: string }[],
    categorySlug: string,
    runId: string,
    positionOffset = 0
  ): Promise<Map<string, number>> {
    if (appList.length === 0) return new Map();
    const now = new Date();
    const slugToIdMap = new Map<string, number>();

    // Prepare app values for batch upsert, dedup by slug to avoid
    // "ON CONFLICT DO UPDATE cannot affect row a second time" error
    const seenSlugs = new Set<string>();
    const appValues = appList.map(app => {
      const appSlug = app.app_url.replace("https://apps.shopify.com/", "");
      const subtitle = app.is_sponsored ? undefined : (app.short_description || undefined);
      const validRating = clampRating(app.average_rating);
      const hasRating = validRating != null && validRating > 0;
      const validCount = clampCount(app.rating_count);
      const hasCount = validCount != null && validCount > 0;
      return { appSlug, subtitle, validRating, hasRating, validCount, hasCount, app };
    }).filter(v => {
      if (seenSlugs.has(v.appSlug)) return false;
      seenSlugs.add(v.appSlug);
      return true;
    });

    // Batch upsert apps in chunks of 100
    // All rows must have identical column shapes for batch insert
    for (let c = 0; c < appValues.length; c += 100) {
      const chunk = appValues.slice(c, c + 100);
      const upsertedApps = await this.db
        .insert(apps)
        .values(chunk.map(v => ({
          platform: "shopify" as const,
          slug: v.appSlug,
          name: v.app.name,
          isBuiltForShopify: !!v.app.is_built_for_shopify,
          appCardSubtitle: v.subtitle ?? null,
          iconUrl: v.app.logo_url || null,
          averageRating: v.hasRating ? String(v.validRating) : null,
          ratingCount: v.hasCount ? v.validCount! : null,
          pricingHint: v.app.pricing_hint || null,
        })))
        .onConflictDoUpdate({
          target: [apps.platform, apps.slug],
          set: {
            name: sql`excluded.name`,
            isBuiltForShopify: sql`excluded.is_built_for_shopify`,
            appCardSubtitle: sql`excluded.app_card_subtitle`,
            iconUrl: sql`COALESCE(excluded.icon_url, ${apps.iconUrl})`,
            averageRating: sql`COALESCE(excluded.average_rating, ${apps.averageRating})`,
            ratingCount: sql`COALESCE(excluded.rating_count, ${apps.ratingCount})`,
            pricingHint: sql`COALESCE(excluded.pricing_hint, ${apps.pricingHint})`,
            updatedAt: now,
          },
        })
        .returning({ id: apps.id, slug: apps.slug });

      for (const row of upsertedApps) {
        slugToIdMap.set(row.slug, row.id);
      }
    }

    // Batch insert rankings in chunks
    const rankingValues: { appId: number; categorySlug: string; scrapeRunId: string; scrapedAt: Date; position: number }[] = [];
    for (let i = 0; i < appList.length; i++) {
      const app = appList[i];
      const appSlug = app.app_url.replace("https://apps.shopify.com/", "");
      const appId = slugToIdMap.get(appSlug);
      if (!appId) continue;
      const position = clampPosition(positionOffset + (app.position || i + 1));
      if (position != null) {
        rankingValues.push({ appId, categorySlug, scrapeRunId: runId, scrapedAt: now, position });
      }
    }
    for (let c = 0; c < rankingValues.length; c += 100) {
      const chunk = rankingValues.slice(c, c + 100);
      await this.db.insert(appCategoryRankings).values(chunk).onConflictDoNothing();
    }

    return slugToIdMap;
  }

  /**
   * Record category ad sightings for sponsored apps.
   * Uses slugToIdMap from recordAppRankings to avoid extra SELECT queries.
   */
  private async recordCategoryAdSightings(
    appList: { app_url: string; is_sponsored?: boolean }[],
    categoryId: number,
    runId: string,
    slugToIdMap?: Map<string, number>
  ): Promise<void> {
    const sponsoredApps = appList.filter((a) => a.is_sponsored);
    if (sponsoredApps.length === 0) return;

    log.info("recording category ad sightings", {
      categoryId,
      totalApps: appList.length,
      sponsoredCount: sponsoredApps.length,
      sponsoredSlugs: sponsoredApps.map((a) => a.app_url.replace("https://apps.shopify.com/", "")),
    });
    const todayStr = new Date().toISOString().slice(0, 10);

    // Resolve app IDs — use map if available, otherwise batch-fetch
    let resolvedMap = slugToIdMap;
    if (!resolvedMap || resolvedMap.size === 0) {
      resolvedMap = new Map();
      const slugs = sponsoredApps.map(a => a.app_url.replace("https://apps.shopify.com/", "")).filter(Boolean);
      if (slugs.length > 0) {
        const rows = await this.db.select({ id: apps.id, slug: apps.slug }).from(apps).where(inArray(apps.slug, slugs));
        for (const r of rows) resolvedMap.set(r.slug, r.id);
      }
    }

    // Batch insert ad sightings
    const sightingValues: { appId: number; categoryId: number; seenDate: string; firstSeenRunId: string; lastSeenRunId: string; timesSeenInDay: number }[] = [];
    for (const app of sponsoredApps) {
      const appSlug = app.app_url.replace("https://apps.shopify.com/", "");
      const appId = resolvedMap.get(appSlug);
      if (!appId) continue;
      sightingValues.push({ appId, categoryId, seenDate: todayStr, firstSeenRunId: runId, lastSeenRunId: runId, timesSeenInDay: 1 });
    }

    for (let c = 0; c < sightingValues.length; c += 100) {
      const chunk = sightingValues.slice(c, c + 100);
      await this.db
        .insert(categoryAdSightings)
        .values(chunk)
        .onConflictDoUpdate({
          target: [categoryAdSightings.appId, categoryAdSightings.categoryId, categoryAdSightings.seenDate],
          set: {
            lastSeenRunId: runId,
            timesSeenInDay: sql`${categoryAdSightings.timesSeenInDay} + 1`,
          },
        });
    }

    this.categoryAdSightingsCount += sightingValues.length;
  }

  /**
   * Upsert app master records without recording rankings.
   * Used for hub pages where apps are featured/recommended, not ranked.
   */
  private async ensureAppRecords(
    appList: { app_url: string; name: string; short_description?: string; is_built_for_shopify?: boolean; is_sponsored?: boolean; logo_url?: string; average_rating?: number; rating_count?: number; pricing_hint?: string }[]
  ): Promise<void> {
    if (appList.length === 0) return;
    const now = new Date();

    for (let c = 0; c < appList.length; c += 100) {
      const chunk = appList.slice(c, c + 100);
      await this.db
        .insert(apps)
        .values(chunk.map(app => {
          const appSlug = app.app_url.replace("https://apps.shopify.com/", "");
          const subtitle = app.is_sponsored ? undefined : (app.short_description || undefined);
          const validRating2 = clampRating(app.average_rating);
          const hasRating = validRating2 != null && validRating2 > 0;
          const validCount2 = clampCount(app.rating_count);
          const hasCount = validCount2 != null && validCount2 > 0;
          return {
            platform: "shopify" as const,
            slug: appSlug,
            name: app.name,
            isBuiltForShopify: !!app.is_built_for_shopify,
            appCardSubtitle: subtitle ?? null,
            iconUrl: app.logo_url || null,
            averageRating: hasRating ? String(validRating2) : null,
            ratingCount: hasCount ? validCount2! : null,
            pricingHint: app.pricing_hint || null,
          };
        }))
        .onConflictDoUpdate({
          target: [apps.platform, apps.slug],
          set: {
            name: sql`excluded.name`,
            isBuiltForShopify: sql`excluded.is_built_for_shopify`,
            appCardSubtitle: sql`excluded.app_card_subtitle`,
            iconUrl: sql`COALESCE(excluded.icon_url, ${apps.iconUrl})`,
            averageRating: sql`COALESCE(excluded.average_rating, ${apps.averageRating})`,
            ratingCount: sql`COALESCE(excluded.rating_count, ${apps.ratingCount})`,
            pricingHint: sql`COALESCE(excluded.pricing_hint, ${apps.pricingHint})`,
            updatedAt: now,
          },
        });
    }
  }

  /**
   * Record app rankings from NormalizedCategoryApp[] (used by generic/non-Shopify platforms).
   */
  private async recordNormalizedAppRankings(
    appList: NormalizedCategoryApp[],
    categorySlug: string,
    runId: string,
    positionOffset = 0
  ): Promise<void> {
    const now = new Date();

    for (let i = 0; i < appList.length; i++) {
      const app = appList[i];
      // Skip sponsored apps — they go to categoryAdSightings only
      if (app.isSponsored) continue;
      const subtitle = app.shortDescription || undefined;
      const validRating = clampRating(app.averageRating);
      const hasRating = validRating != null && validRating > 0;
      const validCount = clampCount(app.ratingCount);
      const hasCount = validCount != null && validCount > 0;

      // Extract extra metadata from listing (Atlassian: vendorName, totalInstalls)
      const extra = app.extra || {};
      const totalInstalls = (extra.totalInstalls ?? extra.installCount ?? extra.activeInstalls) as number | undefined;
      const vendorName = (extra.vendorName ?? extra.companyName) as string | undefined;

      const [upsertedApp] = await this.db
        .insert(apps)
        .values({
          platform: this.platform,
          slug: app.slug,
          name: app.name,
          appCardSubtitle: subtitle,
          ...(app.logoUrl && { iconUrl: app.logoUrl }),
          ...(hasRating && { averageRating: String(validRating) }),
          ...(hasCount && { ratingCount: validCount }),
          ...(app.pricingHint && { pricingHint: app.pricingHint }),
          ...(app.externalId && { externalId: app.externalId }),
          ...(totalInstalls != null && { activeInstalls: totalInstalls }),
          ...(app.badges.length > 0 && { badges: app.badges }),
        })
        .onConflictDoUpdate({
          target: [apps.platform, apps.slug],
          set: {
            name: app.name,
            ...(subtitle !== undefined && { appCardSubtitle: subtitle }),
            ...(app.logoUrl && { iconUrl: app.logoUrl }),
            ...(hasRating && { averageRating: String(validRating) }),
            ...(hasCount && { ratingCount: validCount }),
            ...(app.pricingHint && { pricingHint: app.pricingHint }),
            ...(app.externalId && { externalId: app.externalId }),
            ...(totalInstalls != null && { activeInstalls: totalInstalls }),
            ...(app.badges.length > 0 && { badges: app.badges }),
            updatedAt: now,
          },
        })
        .returning({ id: apps.id });

      const rawPosition = positionOffset + (app.position || i + 1);
      const position = clampPosition(rawPosition);
      if (position != null) {
        await this.db.insert(appCategoryRankings).values({
          appId: upsertedApp.id,
          categorySlug,
          scrapeRunId: runId,
          scrapedAt: now,
          position,
        }).onConflictDoNothing();
      } else {
        log.debug("position clamped to null, skipping ranking", { slug: app.slug, rawPosition, categorySlug });
      }

      // For non-Shopify platforms: ensure a snapshot exists with listing data
      // so dashboard can show developer/rating/pricing even without a detail scrape.
      // Platforms whose category API returns the tracked fields can also opt into
      // per-run refresh via `refreshSnapshotFromCategoryCard` (see Salesforce).
      const hasDescription = !!app.shortDescription;
      if (this.platform !== "shopify" && (hasRating || hasCount || vendorName || hasDescription || app.badges.length > 0 || (totalInstalls != null && totalInstalls > 0))) {
        await this.upsertSnapshotFromCategoryCard(upsertedApp.id, app, {
          hasRating,
          hasCount,
          vendorName,
          now,
          runId,
        });
      }
    }
  }

  /**
   * Insert a fresh appSnapshots row from a category card when appropriate.
   *
   * Default behaviour (flag off): insert only if no snapshot exists yet —
   * the historical "seed-minimal-snapshot" fallback used by most platforms
   * whose category cards lack the full tracked field set.
   *
   * Refresh behaviour (flag on, e.g. Salesforce): insert a new row whenever
   * a tracked field from the card differs from the latest snapshot or the
   * latest snapshot is older than `refreshSnapshotMaxAgeMs` (default 20h).
   * Also emits `appFieldChanges` entries for the drifted fields so history
   * stays consistent with the app-details path.
   */
  private async upsertSnapshotFromCategoryCard(
    appId: number,
    app: NormalizedCategoryApp,
    ctx: { hasRating: boolean; hasCount: boolean; vendorName?: string; now: Date; runId: string },
  ): Promise<void> {
    const { hasRating, hasCount, vendorName, now, runId } = ctx;
    const refresh = this.configValue<boolean>("refreshSnapshotFromCategoryCard", false);
    const maxAgeMs = this.configValue<number>(
      "refreshSnapshotMaxAgeMs",
      20 * 60 * 60 * 1000,
    );

    const [latestSnap] = await this.db
      .select({
        id: appSnapshots.id,
        scrapedAt: appSnapshots.scrapedAt,
        averageRating: appSnapshots.averageRating,
        ratingCount: appSnapshots.ratingCount,
        pricing: appSnapshots.pricing,
        appIntroduction: appSnapshots.appIntroduction,
        developer: appSnapshots.developer,
      })
      .from(appSnapshots)
      .where(eq(appSnapshots.appId, appId))
      .orderBy(desc(appSnapshots.scrapedAt))
      .limit(1);

    // Flag off → seed-once (historical behaviour).
    if (!refresh) {
      if (latestSnap) return;
    } else if (latestSnap) {
      // Flag on → skip only when nothing changed and snapshot is fresh.
      const ageMs = now.getTime() - new Date(latestSnap.scrapedAt).getTime();
      const nextRating = hasRating ? String(app.averageRating) : null;
      const nextCount = hasCount ? app.ratingCount : null;
      const nextPricing = app.pricingHint || "";
      const nextIntro = app.shortDescription || "";
      const nextDeveloperName = vendorName || null;
      const prevDeveloperName =
        latestSnap.developer && typeof latestSnap.developer === "object"
          ? ((latestSnap.developer as { name?: string }).name ?? null)
          : null;

      const drift: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
      if (nextRating !== latestSnap.averageRating) {
        drift.push({ field: "averageRating", oldValue: latestSnap.averageRating, newValue: nextRating });
      }
      if (nextCount !== latestSnap.ratingCount) {
        drift.push({
          field: "ratingCount",
          oldValue: latestSnap.ratingCount == null ? null : String(latestSnap.ratingCount),
          newValue: nextCount == null ? null : String(nextCount),
        });
      }
      if (nextPricing !== (latestSnap.pricing ?? "")) {
        drift.push({ field: "pricing", oldValue: latestSnap.pricing ?? null, newValue: nextPricing });
      }
      if (nextIntro !== (latestSnap.appIntroduction ?? "")) {
        drift.push({ field: "appIntroduction", oldValue: latestSnap.appIntroduction ?? null, newValue: nextIntro });
      }
      if (nextDeveloperName !== prevDeveloperName) {
        drift.push({ field: "developer", oldValue: prevDeveloperName, newValue: nextDeveloperName });
      }

      const stale = ageMs > maxAgeMs;
      if (drift.length === 0 && !stale) return;

      if (drift.length > 0) {
        await this.db.insert(appFieldChanges).values(
          drift.map((c) => ({
            appId,
            field: c.field,
            oldValue: c.oldValue,
            newValue: c.newValue,
            scrapeRunId: runId,
          })),
        );
      }
    }

    await this.db.insert(appSnapshots).values({
      appId,
      scrapeRunId: runId,
      scrapedAt: now,
      averageRating: hasRating ? String(app.averageRating) : null,
      ratingCount: hasCount ? app.ratingCount : null,
      pricing: app.pricingHint || "",
      appIntroduction: app.shortDescription || "",
      appDetails: "",
      seoTitle: "",
      seoMetaDescription: "",
      features: [],
      developer: vendorName ? { name: vendorName, url: "" } : null,
      demoStoreUrl: null,
      languages: [],
      integrations: [],
      categories: [],
      pricingPlans: [],
      support: null,
    });
  }

  /**
   * Record category ad sightings from NormalizedCategoryApp[] (used by generic/non-Shopify platforms).
   */
  private async recordNormalizedCategoryAdSightings(
    appList: NormalizedCategoryApp[],
    categoryId: number,
    runId: string
  ): Promise<void> {
    const todayStr = new Date().toISOString().slice(0, 10);

    for (const app of appList) {
      if (!app.isSponsored) continue;

      const [appRecord] = await this.db
        .select({ id: apps.id })
        .from(apps)
        .where(eq(apps.slug, app.slug))
        .limit(1);

      if (!appRecord) continue;

      await this.db
        .insert(categoryAdSightings)
        .values({
          appId: appRecord.id,
          categoryId,
          seenDate: todayStr,
          firstSeenRunId: runId,
          lastSeenRunId: runId,
          timesSeenInDay: 1,
        })
        .onConflictDoUpdate({
          target: [
            categoryAdSightings.appId,
            categoryAdSightings.categoryId,
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
    const now = new Date();

    // Collect all unique apps across sections for batch upsert
    const allFeaturedApps = sections.flatMap(s => s.apps);
    if (allFeaturedApps.length === 0) return;

    // Deduplicate apps by slug before batch upsert (same app can appear in multiple sections)
    const uniqueAppsMap = new Map<string, typeof allFeaturedApps[0]>();
    for (const app of allFeaturedApps) {
      if (!uniqueAppsMap.has(app.slug)) uniqueAppsMap.set(app.slug, app);
    }
    const uniqueApps = [...uniqueAppsMap.values()];

    // Batch upsert app master records
    const slugToIdMap = new Map<string, number>();
    for (let c = 0; c < uniqueApps.length; c += 100) {
      const chunk = uniqueApps.slice(c, c + 100);
      const upserted = await this.db
        .insert(apps)
        .values(chunk.map(app => ({
          platform: "shopify" as const,
          slug: app.slug,
          name: app.name,
          iconUrl: app.iconUrl || null,
        })))
        .onConflictDoUpdate({
          target: [apps.platform, apps.slug],
          set: {
            name: sql`excluded.name`,
            iconUrl: sql`COALESCE(excluded.icon_url, ${apps.iconUrl})`,
            updatedAt: now,
          },
        })
        .returning({ id: apps.id, slug: apps.slug });
      for (const r of upserted) slugToIdMap.set(r.slug, r.id);
    }

    // Deduplicate sightings by conflict key before batch insert
    // PostgreSQL cannot update the same row twice in a single INSERT
    const sightingKey = (v: { appId: number; sectionHandle: string; surfaceDetail: string }) =>
      `${v.appId}:${v.sectionHandle}:${v.surfaceDetail}`;
    const seenSightings = new Set<string>();
    const sightingValues: { appId: number; surface: string; surfaceDetail: string; sectionHandle: string; sectionTitle: string; position: number | null; seenDate: string; firstSeenRunId: string; lastSeenRunId: string; timesSeenInDay: number }[] = [];
    for (const section of sections) {
      for (const app of section.apps) {
        const appId = slugToIdMap.get(app.slug);
        if (!appId) continue;
        const key = sightingKey({ appId, sectionHandle: section.sectionHandle, surfaceDetail: section.surfaceDetail });
        if (seenSightings.has(key)) continue;
        seenSightings.add(key);
        sightingValues.push({
          appId, surface: section.surface, surfaceDetail: section.surfaceDetail,
          sectionHandle: section.sectionHandle, sectionTitle: section.sectionTitle,
          position: app.position, seenDate: todayStr, firstSeenRunId: runId,
          lastSeenRunId: runId, timesSeenInDay: 1,
        });
      }
    }

    for (let c = 0; c < sightingValues.length; c += 100) {
      const chunk = sightingValues.slice(c, c + 100);
      await this.db
        .insert(featuredAppSightings)
        .values(chunk)
        .onConflictDoUpdate({
          target: [featuredAppSightings.appId, featuredAppSightings.sectionHandle, featuredAppSightings.surfaceDetail, featuredAppSightings.seenDate],
          set: {
            lastSeenRunId: runId,
            position: sql`excluded.position`,
            sectionTitle: sql`excluded.section_title`,
            timesSeenInDay: sql`${featuredAppSightings.timesSeenInDay} + 1`,
          },
        });
    }

    this.featuredSightingsCount += sightingValues.length;

    log.info("recorded featured sightings", {
      url: pageUrl,
      sections: sections.length,
      sightings: sightingValues.length,
    });
  }

  /**
   * Record apps from a curated/featured section page as featured_app_sightings.
   * Used for non-Shopify platforms where entire pages are curated lists
   * (e.g., Google Workspace "Popular Apps", "Top Rated").
   */
  private async recordFeaturedSightingsFromApps(
    appList: NormalizedCategoryApp[],
    sectionSlug: string,
    sectionTitle: string,
    runId: string,
  ): Promise<void> {
    const todayStr = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < appList.length; i++) {
      const app = appList[i];

      // Upsert app master record
      const [upsertedApp] = await this.db
        .insert(apps)
        .values({
          platform: this.platform,
          slug: app.slug,
          name: app.name,
          ...(app.logoUrl && { iconUrl: app.logoUrl }),
          ...(app.averageRating > 0 && { averageRating: String(app.averageRating) }),
          ...(app.ratingCount > 0 && { ratingCount: app.ratingCount }),
        })
        .onConflictDoUpdate({
          target: [apps.platform, apps.slug],
          set: {
            name: app.name,
            ...(app.logoUrl && { iconUrl: app.logoUrl }),
            ...(app.averageRating > 0 && { averageRating: String(app.averageRating) }),
            ...(app.ratingCount > 0 && { ratingCount: app.ratingCount }),
            updatedAt: new Date(),
          },
        })
        .returning({ id: apps.id });

      // Upsert featured sighting
      await this.db
        .insert(featuredAppSightings)
        .values({
          appId: upsertedApp.id,
          surface: "home",
          surfaceDetail: sectionSlug,
          sectionHandle: sectionSlug,
          sectionTitle,
          position: app.position || i + 1,
          seenDate: todayStr,
          firstSeenRunId: runId,
          lastSeenRunId: runId,
          timesSeenInDay: 1,
        })
        .onConflictDoUpdate({
          target: [
            featuredAppSightings.appId,
            featuredAppSightings.sectionHandle,
            featuredAppSightings.surfaceDetail,
            featuredAppSightings.seenDate,
          ],
          set: {
            lastSeenRunId: runId,
            position: app.position || i + 1,
            sectionTitle,
            timesSeenInDay: sql`${featuredAppSightings.timesSeenInDay} + 1`,
          },
        });

      this.featuredSightingsCount++;
    }

    log.info("recorded featured sightings from curated section", {
      sectionSlug, sectionTitle, apps: appList.length, platform: this.platform,
    });
  }

  /**
   * Record featured sightings from pre-fetched NormalizedFeaturedSection[].
   * Used for API-based platforms (e.g., Atlassian) where featured sections
   * are fetched via dedicated API endpoints, not parsed from HTML.
   */
  private async recordNormalizedFeaturedSections(
    sections: import("../platforms/platform-module.js").NormalizedFeaturedSection[],
    runId: string,
  ): Promise<void> {
    const todayStr = new Date().toISOString().slice(0, 10);

    for (const section of sections) {
      for (const app of section.apps) {
        // Upsert app master record
        const [upsertedApp] = await this.db
          .insert(apps)
          .values({
            platform: this.platform,
            slug: app.slug,
            name: app.name,
            ...(app.iconUrl && { iconUrl: app.iconUrl }),
          })
          .onConflictDoUpdate({
            target: [apps.platform, apps.slug],
            set: {
              name: app.name,
              ...(app.iconUrl ? { iconUrl: app.iconUrl } : {}),
              updatedAt: new Date(),
            },
          })
          .returning({ id: apps.id });

        // Upsert featured sighting
        await this.db
          .insert(featuredAppSightings)
          .values({
            appId: upsertedApp.id,
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
              featuredAppSightings.appId,
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

    log.info("recorded API-based featured sightings", {
      platform: this.platform,
      sections: sections.length,
      totalApps: sections.reduce((sum, s) => sum + s.apps.length, 0),
    });
  }

  /**
   * Upsert a category_parents junction row for a child→parent relationship.
   * Used when a subcategory has already been visited but needs an additional parent link.
   */
  private async upsertCategoryParent(childSlug: string, parentSlug: string): Promise<void> {
    const [childRow] = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.slug, childSlug), eq(categories.platform, this.platform)))
      .limit(1);
    const [parentRow] = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.slug, parentSlug), eq(categories.platform, this.platform)))
      .limit(1);
    if (childRow && parentRow) {
      await this.db
        .insert(categoryParents)
        .values({ categoryId: childRow.id, parentCategoryId: parentRow.id })
        .onConflictDoNothing();
      log.info("added additional parent link", { child: childSlug, parent: parentSlug });
    }
  }

  private countNodes(node: CategoryNode): number {
    return 1 + node.children.reduce((sum, c) => sum + this.countNodes(c), 0);
  }
}
