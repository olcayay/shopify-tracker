import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and, inArray, ilike } from "drizzle-orm";
import { createDb } from "@shopify-tracking/db";
import {
  apps,
  appSnapshots,
  appCategoryRankings,
  appKeywordRankings,
  reviews,
  trackedKeywords,
  categories,
  accountTrackedApps,
} from "@shopify-tracking/db";

type Db = ReturnType<typeof createDb>;

export const appRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // GET /api/apps — list account's tracked apps with latest snapshot summary
  app.get("/", async (request) => {
    const { accountId } = request.user;

    // Get app slugs tracked by this account
    const trackedRows = await db
      .select({ appSlug: accountTrackedApps.appSlug })
      .from(accountTrackedApps)
      .where(eq(accountTrackedApps.accountId, accountId));

    if (trackedRows.length === 0) {
      return [];
    }

    const slugs = trackedRows.map((r) => r.appSlug);
    const rows = await db
      .select()
      .from(apps)
      .where(inArray(apps.slug, slugs))
      .orderBy(apps.name);

    // Get latest snapshot for each app
    const result = await Promise.all(
      rows.map(async (appRow) => {
        const [snapshot] = await db
          .select({
            averageRating: appSnapshots.averageRating,
            ratingCount: appSnapshots.ratingCount,
            pricing: appSnapshots.pricing,
            scrapedAt: appSnapshots.scrapedAt,
          })
          .from(appSnapshots)
          .where(eq(appSnapshots.appSlug, appRow.slug))
          .orderBy(desc(appSnapshots.scrapedAt))
          .limit(1);

        return { ...appRow, latestSnapshot: snapshot || null };
      })
    );

    return result;
  });

  // GET /api/apps/search?q= — search all apps by name prefix
  app.get("/search", async (request) => {
    const { q = "" } = request.query as { q?: string };
    if (q.length < 1) return [];

    const rows = await db
      .select({
        slug: apps.slug,
        name: apps.name,
      })
      .from(apps)
      .where(ilike(apps.name, `%${q}%`))
      .orderBy(apps.name)
      .limit(20);

    return rows;
  });

  // GET /api/apps/:slug — app detail + latest snapshot + track status
  app.get<{ Params: { slug: string } }>("/:slug", async (request, reply) => {
    const { slug } = request.params;
    const { accountId } = request.user;

    const [appRow] = await db
      .select()
      .from(apps)
      .where(eq(apps.slug, slug))
      .limit(1);

    if (!appRow) {
      return reply.code(404).send({ error: "App not found" });
    }

    const [latestSnapshot] = await db
      .select()
      .from(appSnapshots)
      .where(eq(appSnapshots.appSlug, slug))
      .orderBy(desc(appSnapshots.scrapedAt))
      .limit(1);

    const [tracked] = await db
      .select({ appSlug: accountTrackedApps.appSlug })
      .from(accountTrackedApps)
      .where(
        and(
          eq(accountTrackedApps.accountId, accountId),
          eq(accountTrackedApps.appSlug, slug)
        )
      );

    return {
      ...appRow,
      latestSnapshot: latestSnapshot || null,
      isTrackedByAccount: !!tracked,
    };
  });

  // GET /api/apps/:slug/history — historical snapshots
  // ?limit=20&offset=0
  app.get<{ Params: { slug: string } }>(
    "/:slug/history",
    async (request, reply) => {
      const { slug } = request.params;
      const { limit = "20", offset = "0" } = request.query as {
        limit?: string;
        offset?: string;
      };

      const [appRow] = await db
        .select()
        .from(apps)
        .where(eq(apps.slug, slug))
        .limit(1);

      if (!appRow) {
        return reply.code(404).send({ error: "App not found" });
      }

      const snapshots = await db
        .select()
        .from(appSnapshots)
        .where(eq(appSnapshots.appSlug, slug))
        .orderBy(desc(appSnapshots.scrapedAt))
        .limit(parseInt(limit, 10))
        .offset(parseInt(offset, 10));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(appSnapshots)
        .where(eq(appSnapshots.appSlug, slug));

      return { app: appRow, snapshots, total: count };
    }
  );

  // GET /api/apps/:slug/reviews — app reviews
  // ?limit=20&offset=0&sort=newest (default) | oldest | highest | lowest
  app.get<{ Params: { slug: string } }>(
    "/:slug/reviews",
    async (request, reply) => {
      const { slug } = request.params;
      const {
        limit = "20",
        offset = "0",
        sort = "newest",
      } = request.query as { limit?: string; offset?: string; sort?: string };

      const [appRow] = await db
        .select()
        .from(apps)
        .where(eq(apps.slug, slug))
        .limit(1);

      if (!appRow) {
        return reply.code(404).send({ error: "App not found" });
      }

      const orderBy =
        sort === "oldest"
          ? reviews.reviewDate
          : sort === "highest"
            ? desc(reviews.rating)
            : sort === "lowest"
              ? reviews.rating
              : desc(reviews.reviewDate);

      const rows = await db
        .select()
        .from(reviews)
        .where(eq(reviews.appSlug, slug))
        .orderBy(orderBy)
        .limit(parseInt(limit, 10))
        .offset(parseInt(offset, 10));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviews)
        .where(eq(reviews.appSlug, slug));

      // Rating distribution
      const distribution = await db
        .select({
          rating: reviews.rating,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(eq(reviews.appSlug, slug))
        .groupBy(reviews.rating)
        .orderBy(reviews.rating);

      return { app: appRow, reviews: rows, total: count, distribution };
    }
  );

  // GET /api/apps/:slug/rankings — category + keyword ranking history
  // ?days=30
  app.get<{ Params: { slug: string } }>(
    "/:slug/rankings",
    async (request, reply) => {
      const { slug } = request.params;
      const { days = "30" } = request.query as { days?: string };

      const [appRow] = await db
        .select()
        .from(apps)
        .where(eq(apps.slug, slug))
        .limit(1);

      if (!appRow) {
        return reply.code(404).send({ error: "App not found" });
      }

      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      const sinceStr = since.toISOString();

      const categoryRankingsRaw = await db
        .select({
          categorySlug: appCategoryRankings.categorySlug,
          categoryTitle: categories.title,
          categoryParentSlug: categories.parentSlug,
          position: appCategoryRankings.position,
          scrapedAt: appCategoryRankings.scrapedAt,
        })
        .from(appCategoryRankings)
        .innerJoin(
          categories,
          eq(categories.slug, appCategoryRankings.categorySlug)
        )
        .where(
          and(
            eq(appCategoryRankings.appSlug, slug),
            sql`${appCategoryRankings.scrapedAt} >= ${sinceStr}`
          )
        )
        .orderBy(appCategoryRankings.scrapedAt);

      // Build category breadcrumb (parent > child)
      const allCategorySlugs = new Set<string>();
      for (const r of categoryRankingsRaw) {
        allCategorySlugs.add(r.categorySlug);
        if (r.categoryParentSlug) allCategorySlugs.add(r.categoryParentSlug);
      }

      // Fetch all relevant categories for breadcrumb building
      const categoryMap = new Map<string, { title: string; parentSlug: string | null }>();
      if (allCategorySlugs.size > 0) {
        const cats = await db
          .select({
            slug: categories.slug,
            title: categories.title,
            parentSlug: categories.parentSlug,
          })
          .from(categories)
          .where(inArray(categories.slug, [...allCategorySlugs]));
        for (const c of cats) {
          categoryMap.set(c.slug, { title: c.title, parentSlug: c.parentSlug });
        }
      }

      function buildBreadcrumb(slug: string): string {
        const parts: string[] = [];
        let current: string | null = slug;
        while (current) {
          const cat = categoryMap.get(current);
          if (!cat) break;
          parts.unshift(cat.title);
          current = cat.parentSlug;
        }
        return parts.join(" > ");
      }

      const categoryRankings = categoryRankingsRaw.map((r) => ({
        categorySlug: r.categorySlug,
        categoryTitle: buildBreadcrumb(r.categorySlug),
        position: r.position,
        scrapedAt: r.scrapedAt,
      }));

      const keywordRankings = await db
        .select({
          keywordId: appKeywordRankings.keywordId,
          keyword: trackedKeywords.keyword,
          position: appKeywordRankings.position,
          scrapedAt: appKeywordRankings.scrapedAt,
        })
        .from(appKeywordRankings)
        .innerJoin(
          trackedKeywords,
          eq(appKeywordRankings.keywordId, trackedKeywords.id)
        )
        .where(
          and(
            eq(appKeywordRankings.appSlug, slug),
            sql`${appKeywordRankings.scrapedAt} >= ${sinceStr}`
          )
        )
        .orderBy(appKeywordRankings.scrapedAt);

      return { app: appRow, categoryRankings, keywordRankings };
    }
  );
};
