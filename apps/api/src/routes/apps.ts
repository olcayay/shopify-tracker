import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and, inArray, ilike } from "drizzle-orm";
import { createDb } from "@shopify-tracking/db";
import {
  apps,
  appSnapshots,
  appFieldChanges,
  appCategoryRankings,
  appKeywordRankings,
  keywordAdSightings,
  reviews,
  trackedKeywords,
  categories,
  accountTrackedApps,
  accountCompetitorApps,
} from "@shopify-tracking/db";

type Db = ReturnType<typeof createDb>;

function getMinPaidPrice(plans: any[] | null | undefined): number | null {
  if (!plans || plans.length === 0) return null;
  const prices = plans
    .filter((p: any) => p.price != null && parseFloat(p.price) > 0)
    .map((p: any) => parseFloat(p.price));
  return prices.length > 0 ? Math.min(...prices) : 0;
}

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
            pricingPlans: appSnapshots.pricingPlans,
            scrapedAt: appSnapshots.scrapedAt,
          })
          .from(appSnapshots)
          .where(eq(appSnapshots.appSlug, appRow.slug))
          .orderBy(desc(appSnapshots.scrapedAt))
          .limit(1);

        const [change] = await db
          .select({ detectedAt: appFieldChanges.detectedAt })
          .from(appFieldChanges)
          .where(eq(appFieldChanges.appSlug, appRow.slug))
          .orderBy(desc(appFieldChanges.detectedAt))
          .limit(1);

        const minPaidPrice = getMinPaidPrice(snapshot?.pricingPlans);
        const { pricingPlans: _, ...snapshotRest } = snapshot || ({} as any);

        return { ...appRow, latestSnapshot: snapshot ? snapshotRest : null, minPaidPrice, lastChangeAt: change?.detectedAt || null };
      })
    );

    return result;
  });

  // POST /api/apps/last-changes — bulk lookup lastChangeAt for multiple apps
  app.post("/last-changes", async (request) => {
    const { slugs } = request.body as { slugs: string[] };
    if (!slugs?.length) return {};

    const rows = await db
      .select({
        appSlug: appFieldChanges.appSlug,
        lastChangeAt: sql<string>`max(${appFieldChanges.detectedAt})`,
      })
      .from(appFieldChanges)
      .where(inArray(appFieldChanges.appSlug, slugs))
      .groupBy(appFieldChanges.appSlug);

    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.appSlug] = r.lastChangeAt;
    }
    return result;
  });

  // POST /api/apps/min-paid-prices — bulk lookup minPaidPrice for multiple apps
  app.post("/min-paid-prices", async (request) => {
    const { slugs } = request.body as { slugs: string[] };
    if (!slugs?.length) return {};

    const rows = await db
      .select({
        appSlug: appSnapshots.appSlug,
        pricingPlans: appSnapshots.pricingPlans,
      })
      .from(appSnapshots)
      .where(
        and(
          inArray(appSnapshots.appSlug, slugs),
          sql`${appSnapshots.id} = (SELECT s2.id FROM app_snapshots s2 WHERE s2.app_slug = ${appSnapshots.appSlug} ORDER BY s2.scraped_at DESC LIMIT 1)`
        )
      );

    const result: Record<string, number | null> = {};
    for (const r of rows) {
      result[r.appSlug] = getMinPaidPrice(r.pricingPlans);
    }
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
        isBuiltForShopify: apps.isBuiltForShopify,
        averageRating: appSnapshots.averageRating,
        ratingCount: appSnapshots.ratingCount,
      })
      .from(apps)
      .leftJoin(
        appSnapshots,
        sql`${appSnapshots.appSlug} = ${apps.slug}
          AND ${appSnapshots.id} = (
            SELECT s2.id FROM app_snapshots s2
            WHERE s2.app_slug = "apps"."slug"
            ORDER BY s2.scraped_at DESC LIMIT 1
          )`
      )
      .where(ilike(apps.name, `%${q}%`))
      .orderBy(apps.name)
      .limit(20);

    return rows;
  });

  // GET /api/apps/by-developer?name= — list apps by developer name
  app.get("/by-developer", async (request) => {
    const { name = "" } = request.query as { name?: string };
    if (name.length < 1) return [];

    // Find apps whose latest snapshot has matching developer name
    const rows = await db
      .select({
        slug: apps.slug,
        name: apps.name,
        iconUrl: apps.iconUrl,
        averageRating: appSnapshots.averageRating,
        ratingCount: appSnapshots.ratingCount,
        pricing: appSnapshots.pricing,
        developer: appSnapshots.developer,
      })
      .from(apps)
      .innerJoin(appSnapshots, eq(appSnapshots.appSlug, apps.slug))
      .where(
        sql`${appSnapshots.developer}->>'name' = ${name}
          AND ${appSnapshots.id} = (
            SELECT s2.id FROM app_snapshots s2
            WHERE s2.app_slug = "apps"."slug"
            ORDER BY s2.scraped_at DESC LIMIT 1
          )`
      )
      .orderBy(apps.name);

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

    const [competitor] = await db
      .select({ appSlug: accountCompetitorApps.appSlug })
      .from(accountCompetitorApps)
      .where(
        and(
          eq(accountCompetitorApps.accountId, accountId),
          eq(accountCompetitorApps.appSlug, slug)
        )
      );

    return {
      ...appRow,
      latestSnapshot: latestSnapshot || null,
      isTrackedByAccount: !!tracked,
      isCompetitor: !!competitor,
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

      const [{ withContentCount }] = await db
        .select({ withContentCount: sql<number>`count(*)::int` })
        .from(reviews)
        .where(and(eq(reviews.appSlug, slug), sql`content != ''`));

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

      return { app: appRow, reviews: rows, total: count, withContentCount, distribution };
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
          keywordSlug: trackedKeywords.slug,
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

      const sinceDateStr = since.toISOString().slice(0, 10);
      const keywordAds = await db
        .select({
          keywordId: keywordAdSightings.keywordId,
          keyword: trackedKeywords.keyword,
          keywordSlug: trackedKeywords.slug,
          seenDate: keywordAdSightings.seenDate,
          timesSeenInDay: keywordAdSightings.timesSeenInDay,
        })
        .from(keywordAdSightings)
        .innerJoin(
          trackedKeywords,
          eq(keywordAdSightings.keywordId, trackedKeywords.id)
        )
        .where(
          and(
            eq(keywordAdSightings.appSlug, slug),
            sql`${keywordAdSightings.seenDate} >= ${sinceDateStr}`
          )
        )
        .orderBy(desc(keywordAdSightings.seenDate));

      return { app: appRow, categoryRankings, keywordRankings, keywordAds };
    }
  );

  // GET /api/apps/:slug/changes — field-level change history
  // ?limit=50
  app.get<{ Params: { slug: string } }>(
    "/:slug/changes",
    async (request) => {
      const { slug } = request.params;
      const { limit = "50" } = request.query as { limit?: string };
      const maxLimit = Math.min(parseInt(limit, 10) || 50, 200);

      return db
        .select()
        .from(appFieldChanges)
        .where(eq(appFieldChanges.appSlug, slug))
        .orderBy(desc(appFieldChanges.detectedAt))
        .limit(maxLimit);
    }
  );
};
