import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and, asc } from "drizzle-orm";
import { createDb } from "@shopify-tracking/db";
import { categories, categorySnapshots, appCategoryRankings, apps } from "@shopify-tracking/db";

type Db = ReturnType<typeof createDb>;

export const categoryRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // GET /api/categories — list all categories
  // ?format=tree (default) | flat
  // ?tracked=true — only tracked
  app.get("/", async (request) => {
    const { format = "tree", tracked } = request.query as {
      format?: string;
      tracked?: string;
    };

    // Subquery for latest appCount per category
    const latestSnapshot = db
      .select({
        categorySlug: categorySnapshots.categorySlug,
        appCount: categorySnapshots.appCount,
        rn: sql<number>`row_number() over (partition by ${categorySnapshots.categorySlug} order by ${categorySnapshots.scrapedAt} desc)`.as("rn"),
      })
      .from(categorySnapshots)
      .as("ls");

    const rows = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        title: categories.title,
        url: categories.url,
        parentSlug: categories.parentSlug,
        categoryLevel: categories.categoryLevel,
        description: categories.description,
        isTracked: categories.isTracked,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
        appCount: latestSnapshot.appCount,
      })
      .from(categories)
      .leftJoin(
        latestSnapshot,
        sql`${latestSnapshot.categorySlug} = ${categories.slug} and ${latestSnapshot.rn} = 1`
      )
      .where(tracked === "true" ? eq(categories.isTracked, true) : undefined)
      .orderBy(categories.categoryLevel, categories.title);

    if (format === "flat") {
      return rows;
    }

    // Build tree: roots are those with null parentSlug
    return buildTree(rows);
  });

  // GET /api/categories/:slug — category detail + latest snapshot
  app.get<{ Params: { slug: string } }>("/:slug", async (request, reply) => {
    const { slug } = request.params;

    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    if (!category) {
      return reply.code(404).send({ error: "Category not found" });
    }

    const [latestSnapshot] = await db
      .select()
      .from(categorySnapshots)
      .where(eq(categorySnapshots.categorySlug, slug))
      .orderBy(desc(categorySnapshots.scrapedAt))
      .limit(1);

    const children = await db
      .select()
      .from(categories)
      .where(eq(categories.parentSlug, slug));

    // Build breadcrumb by walking up the parent chain
    const breadcrumb: { slug: string; title: string }[] = [];
    let currentParent = category.parentSlug;
    const visited = new Set<string>();
    while (currentParent && !visited.has(currentParent)) {
      visited.add(currentParent);
      const [parent] = await db
        .select({ slug: categories.slug, title: categories.title, parentSlug: categories.parentSlug })
        .from(categories)
        .where(eq(categories.slug, currentParent))
        .limit(1);
      if (!parent) break;
      breadcrumb.unshift({ slug: parent.slug, title: parent.title });
      currentParent = parent.parentSlug;
    }

    // Fetch all ranked apps from the latest snapshot's scrape run
    let rankedApps: any[] = [];
    if (latestSnapshot) {
      try {
        const rankings = await db
          .select({
            position: appCategoryRankings.position,
            appSlug: appCategoryRankings.appSlug,
            name: apps.name,
            iconUrl: apps.iconUrl,
            isBuiltForShopify: apps.isBuiltForShopify,
            averageRating: apps.averageRating,
            ratingCount: apps.ratingCount,
            pricingHint: apps.pricingHint,
          })
          .from(appCategoryRankings)
          .innerJoin(apps, eq(apps.slug, appCategoryRankings.appSlug))
          .where(
            and(
              eq(appCategoryRankings.scrapeRunId, latestSnapshot.scrapeRunId),
              eq(appCategoryRankings.categorySlug, slug)
            )
          )
          .orderBy(asc(appCategoryRankings.position));

        rankedApps = rankings.map((r) => ({
          position: r.position,
          slug: r.appSlug,
          name: r.name,
          icon_url: r.iconUrl || null,
          is_built_for_shopify: r.isBuiltForShopify,
          average_rating: r.averageRating ? Number(r.averageRating) : null,
          rating_count: r.ratingCount ?? null,
          pricing_hint: r.pricingHint || null,
        }));
      } catch (err) {
        app.log.warn(`Failed to fetch ranked apps for category ${slug}: ${err}`);
      }
    }

    return {
      ...category,
      latestSnapshot: latestSnapshot
        ? { appCount: latestSnapshot.appCount, scrapedAt: latestSnapshot.scrapedAt }
        : null,
      children,
      breadcrumb,
      rankedApps,
    };
  });

  // GET /api/categories/:slug/history — historical snapshots
  // ?limit=20&offset=0
  app.get<{ Params: { slug: string } }>(
    "/:slug/history",
    async (request, reply) => {
      const { slug } = request.params;
      const { limit = "20", offset = "0" } = request.query as {
        limit?: string;
        offset?: string;
      };

      const [category] = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);

      if (!category) {
        return reply.code(404).send({ error: "Category not found" });
      }

      const snapshots = await db
        .select({
          id: categorySnapshots.id,
          scrapeRunId: categorySnapshots.scrapeRunId,
          scrapedAt: categorySnapshots.scrapedAt,
          appCount: categorySnapshots.appCount,
        })
        .from(categorySnapshots)
        .where(eq(categorySnapshots.categorySlug, slug))
        .orderBy(desc(categorySnapshots.scrapedAt))
        .limit(parseInt(limit, 10))
        .offset(parseInt(offset, 10));

      // Enrich with ranking count per snapshot (actual number of apps scraped)
      const enriched = await Promise.all(
        snapshots.map(async (s) => {
          const [{ rankCount }] = await db
            .select({ rankCount: sql<number>`count(*)::int` })
            .from(appCategoryRankings)
            .where(
              and(
                eq(appCategoryRankings.scrapeRunId, s.scrapeRunId),
                eq(appCategoryRankings.categorySlug, slug)
              )
            );
          return { ...s, appCount: s.appCount ?? (rankCount || null) };
        })
      );

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(categorySnapshots)
        .where(eq(categorySnapshots.categorySlug, slug));

      return { category, snapshots: enriched, total: count };
    }
  );
};

function buildTree(rows: (typeof categories.$inferSelect)[]) {
  const map = new Map<string, any>();
  const roots: any[] = [];

  for (const row of rows) {
    map.set(row.slug, { ...row, children: [] });
  }

  for (const row of rows) {
    const node = map.get(row.slug);
    if (row.parentSlug && map.has(row.parentSlug)) {
      map.get(row.parentSlug).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
