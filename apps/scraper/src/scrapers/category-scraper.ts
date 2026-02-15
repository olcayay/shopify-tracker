import { eq } from "drizzle-orm";
import type { Database } from "@shopify-tracking/db";
import {
  scrapeRuns,
  categories,
  categorySnapshots,
  apps,
  appCategoryRankings,
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
  shouldUseAllPage,
} from "../parsers/category-parser.js";

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

  constructor(db: Database, options: CategoryScraperOptions = {}) {
    this.db = db;
    this.httpClient = options.httpClient || new HttpClient();
    this.maxDepth = options.maxDepth ?? MAX_CATEGORY_DEPTH;
  }

  /**
   * Crawl the full category tree starting from the 6 seed categories.
   * Returns the complete tree as an array of root nodes.
   */
  async crawl(): Promise<CategoryNode[]> {
    log.info("starting full category tree crawl");

    // Create scrape run
    const [run] = await this.db
      .insert(scrapeRuns)
      .values({
        scraperType: "category",
        status: "running",
        startedAt: new Date(),
      })
      .returning();

    const startTime = Date.now();
    const tree: CategoryNode[] = [];
    let itemsScraped = 0;
    let itemsFailed = 0;

    try {
      for (const slug of SEED_CATEGORY_SLUGS) {
        try {
          const node = await this.crawlCategory(slug, null, 0, run.id);
          if (node) {
            tree.push(node);
            itemsScraped += this.countNodes(node);
          }
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
            duration_ms: Date.now() - startTime,
          },
        })
        .where(eq(scrapeRuns.id, run.id));

      log.info("crawl completed", { itemsScraped, itemsFailed, durationMs: Date.now() - startTime });
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

    return tree;
  }

  private async crawlCategory(
    slug: string,
    parentSlug: string | null,
    depth: number,
    runId: string
  ): Promise<CategoryNode | null> {
    if (this.visited.has(slug)) return null;
    this.visited.add(slug);

    log.info("crawling category", { slug, depth });

    const categoryUrl = urls.category(slug);

    // For root categories (depth 0), we just extract subcategory links
    // For deeper categories, we get app listings
    let dataSourceUrl = categoryUrl;
    let html: string;

    try {
      html = await this.httpClient.fetchPage(categoryUrl);
    } catch (error) {
      log.error("failed to fetch category page", { url: categoryUrl, error: String(error) });
      return null;
    }

    // Check if we need to use the /all page for app listings
    if (depth > 0 && shouldUseAllPage(html)) {
      const allUrl = urls.categoryAll(slug);
      try {
        html = await this.httpClient.fetchPage(allUrl);
        dataSourceUrl = allUrl;
      } catch (error) {
        log.warn("failed to fetch /all page, using main page", { slug });
      }
    }

    const pageData = parseCategoryPage(html, dataSourceUrl);

    // Upsert category master record
    await this.db
      .insert(categories)
      .values({
        slug,
        title: pageData.title,
        url: categoryUrl,
        parentSlug,
        categoryLevel: depth,
        description: pageData.description,
      })
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          title: pageData.title,
          description: pageData.description,
          parentSlug,
          categoryLevel: depth,
          updatedAt: new Date(),
        },
      });

    // Insert snapshot (skip for root categories with no app data)
    if (depth > 0 || pageData.first_page_apps.length > 0) {
      await this.db.insert(categorySnapshots).values({
        categorySlug: slug,
        scrapeRunId: runId,
        scrapedAt: new Date(),
        dataSourceUrl,
        appCount: pageData.app_count,
        firstPageMetrics: pageData.first_page_metrics,
        firstPageApps: pageData.first_page_apps,
        breadcrumb: pageData.breadcrumb,
      });

      // Record app rankings from first page
      await this.recordAppRankings(
        pageData.first_page_apps,
        slug,
        runId
      );
    }

    // Recurse into subcategories
    const children: CategoryNode[] = [];
    if (depth < this.maxDepth) {
      for (const sub of pageData.subcategory_links) {
        const childNode = await this.crawlCategory(
          sub.slug,
          slug,
          depth + 1,
          runId
        );
        if (childNode) children.push(childNode);
      }
    }

    return {
      slug,
      url: categoryUrl,
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
    };
  }

  /**
   * Ensure each app from first_page_apps exists in the apps table,
   * then record their category ranking positions.
   */
  private async recordAppRankings(
    appList: { app_url: string; name: string }[],
    categorySlug: string,
    runId: string
  ): Promise<void> {
    const now = new Date();

    for (let i = 0; i < appList.length; i++) {
      const app = appList[i];
      const appSlug = app.app_url.replace(
        "https://apps.shopify.com/",
        ""
      );

      // Upsert app master record
      await this.db
        .insert(apps)
        .values({ slug: appSlug, name: app.name })
        .onConflictDoNothing();

      // Record ranking
      await this.db.insert(appCategoryRankings).values({
        appSlug,
        categorySlug,
        scrapeRunId: runId,
        scrapedAt: now,
        position: i + 1,
      });
    }
  }

  private countNodes(node: CategoryNode): number {
    return 1 + node.children.reduce((sum, c) => sum + this.countNodes(c), 0);
  }
}
