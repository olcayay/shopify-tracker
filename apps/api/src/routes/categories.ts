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
        isListingPage: categories.isListingPage,
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

    // Fetch ranked apps
    let rankedApps: any[] = [];
    let hubPageApps: any[] = [];

    if (category.isListingPage && latestSnapshot) {
      // Listing page: fetch ranked apps from appCategoryRankings
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
            launchedDate: apps.launchedDate,
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
          launched_date: r.launchedDate || null,
        }));
      } catch (err) {
        app.log.warn(`Failed to fetch ranked apps for category ${slug}: ${err}`);
      }
    } else if (!category.isListingPage) {
      // Hub page: return featured apps from snapshot + apps from descendant listing categories
      if (latestSnapshot?.firstPageApps) {
        hubPageApps = (latestSnapshot.firstPageApps as any[]).map((a: any) => ({
          slug: a.app_url?.replace("https://apps.shopify.com/", "") || "",
          name: a.name,
          icon_url: a.logo_url || null,
          is_built_for_shopify: !!a.is_built_for_shopify,
          average_rating: a.average_rating || null,
          rating_count: a.rating_count || null,
          pricing_hint: a.pricing_hint || null,
        }));
      }

      // Get apps from descendant listing categories
      try {
        const descendantListingCats = await db
          .select({ slug: categories.slug, title: categories.title })
          .from(categories)
          .where(
            and(
              sql`${categories.slug} LIKE ${slug + '-%'}`,
              eq(categories.isListingPage, true)
            )
          );

        if (descendantListingCats.length > 0) {
          // Collect all categories per app (an app can appear in multiple listing categories)
          const appMap = new Map<string, any>();
          for (const descCat of descendantListingCats) {
            const [descSnapshot] = await db
              .select({ scrapeRunId: categorySnapshots.scrapeRunId })
              .from(categorySnapshots)
              .where(eq(categorySnapshots.categorySlug, descCat.slug))
              .orderBy(desc(categorySnapshots.scrapedAt))
              .limit(1);

            if (!descSnapshot) continue;

            const descRanked = await db
              .select({
                position: appCategoryRankings.position,
                appSlug: appCategoryRankings.appSlug,
                name: apps.name,
                iconUrl: apps.iconUrl,
                isBuiltForShopify: apps.isBuiltForShopify,
                averageRating: apps.averageRating,
                ratingCount: apps.ratingCount,
                pricingHint: apps.pricingHint,
                launchedDate: apps.launchedDate,
              })
              .from(appCategoryRankings)
              .innerJoin(apps, eq(apps.slug, appCategoryRankings.appSlug))
              .where(
                and(
                  eq(appCategoryRankings.scrapeRunId, descSnapshot.scrapeRunId),
                  eq(appCategoryRankings.categorySlug, descCat.slug)
                )
              )
              .orderBy(asc(appCategoryRankings.position));

            for (const r of descRanked) {
              if (!appMap.has(r.appSlug)) {
                appMap.set(r.appSlug, {
                  position: r.position,
                  slug: r.appSlug,
                  name: r.name,
                  icon_url: r.iconUrl || null,
                  is_built_for_shopify: r.isBuiltForShopify,
                  average_rating: r.averageRating ? Number(r.averageRating) : null,
                  rating_count: r.ratingCount ?? null,
                  pricing_hint: r.pricingHint || null,
                  launched_date: r.launchedDate || null,
                  source_categories: [{ title: descCat.title, slug: descCat.slug }],
                });
              } else {
                appMap.get(r.appSlug).source_categories.push({ title: descCat.title, slug: descCat.slug });
              }
            }
          }
          // Keep only leaf categories per app (remove parents when a child is present)
          for (const app of appMap.values()) {
            const cats: { title: string; slug: string }[] = app.source_categories;
            if (cats.length > 1) {
              app.source_categories = cats.filter(
                (cat) => !cats.some((other) => other.slug !== cat.slug && other.slug.startsWith(cat.slug + '-'))
              );
            }
          }
          rankedApps = [...appMap.values()];
        }
      } catch (err) {
        app.log.warn(`Failed to fetch descendant apps for hub category ${slug}: ${err}`);
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
      hubPageApps,
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
