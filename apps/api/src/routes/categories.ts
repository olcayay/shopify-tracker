import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and, asc, inArray } from "drizzle-orm";
import { createDb } from "@shopify-tracking/db";
import { categories, categorySnapshots, appCategoryRankings, apps, categoryAdSightings, appVisibilityScores, appPowerScores } from "@shopify-tracking/db";

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

  // GET /api/categories/:slug/ads — ad sightings for this category
  app.get<{ Params: { slug: string } }>(
    "/:slug/ads",
    async (request, reply) => {
      const { slug } = request.params;
      const { days = "30" } = request.query as { days?: string };

      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      const sinceStr = since.toISOString().slice(0, 10);

      const adSightings = await db
        .select({
          appSlug: categoryAdSightings.appSlug,
          appName: apps.name,
          iconUrl: apps.iconUrl,
          seenDate: categoryAdSightings.seenDate,
          timesSeenInDay: categoryAdSightings.timesSeenInDay,
        })
        .from(categoryAdSightings)
        .innerJoin(apps, eq(categoryAdSightings.appSlug, apps.slug))
        .where(
          and(
            eq(categoryAdSightings.categorySlug, slug),
            sql`${categoryAdSightings.seenDate} >= ${sinceStr}`
          )
        )
        .orderBy(desc(categoryAdSightings.seenDate));

      return { adSightings };
    }
  );

  // GET /api/categories/:slug/scores — leaderboard by visibility or power (latest day)
  app.get(
    "/:slug/scores",
    async (request) => {
      const { slug } = request.params as { slug: string };
      const { sort = "visibility", limit: limitStr = "50" } = request.query as {
        sort?: string;
        limit?: string;
      };
      const limitNum = Math.min(parseInt(limitStr) || 50, 200);

      // Get latest computedAt for this category
      const [latestVis] = await db
        .select({ computedAt: appVisibilityScores.computedAt })
        .from(appVisibilityScores)
        .where(eq(appVisibilityScores.categorySlug, slug))
        .orderBy(desc(appVisibilityScores.computedAt))
        .limit(1);

      if (!latestVis) {
        return { scores: [], computedAt: null };
      }

      const computedAt = latestVis.computedAt;

      // Fetch visibility scores for latest day
      const visRows = await db
        .select()
        .from(appVisibilityScores)
        .where(
          and(
            eq(appVisibilityScores.categorySlug, slug),
            eq(appVisibilityScores.computedAt, computedAt),
          )
        );

      // Fetch power scores for latest day
      const powRows = await db
        .select()
        .from(appPowerScores)
        .where(
          and(
            eq(appPowerScores.categorySlug, slug),
            eq(appPowerScores.computedAt, computedAt),
          )
        );

      // Merge by appSlug
      const visMap = new Map(visRows.map((r) => [r.appSlug, r]));
      const powMap = new Map(powRows.map((r) => [r.appSlug, r]));
      const allSlugs = new Set([...visMap.keys(), ...powMap.keys()]);

      // Fetch app names
      const slugArray = [...allSlugs];
      const appRows = slugArray.length > 0
        ? await db
            .select({ slug: apps.slug, name: apps.name, iconUrl: apps.iconUrl })
            .from(apps)
            .where(inArray(apps.slug, slugArray))
        : [];
      const appMap = new Map(appRows.map((r) => [r.slug, r]));

      let scores = slugArray.map((appSlug) => {
        const vis = visMap.get(appSlug);
        const pow = powMap.get(appSlug);
        const appInfo = appMap.get(appSlug);
        return {
          appSlug,
          appName: appInfo?.name || appSlug,
          iconUrl: appInfo?.iconUrl || null,
          visibilityScore: vis?.visibilityScore ?? 0,
          visibilityRaw: vis?.visibilityRaw ?? "0",
          keywordCount: vis?.keywordCount ?? 0,
          powerScore: pow?.powerScore ?? 0,
          powerRaw: pow?.powerRaw ?? "0",
          ratingScore: pow?.ratingScore ?? "0",
          reviewScore: pow?.reviewScore ?? "0",
          categoryScore: pow?.categoryScore ?? "0",
          momentumScore: pow?.momentumScore ?? "0",
        };
      });

      // Sort
      if (sort === "power") {
        scores.sort((a, b) => b.powerScore - a.powerScore);
      } else {
        scores.sort((a, b) => b.visibilityScore - a.visibilityScore);
      }

      scores = scores.slice(0, limitNum);

      return { scores, computedAt };
    }
  );

  // GET /api/categories/:slug/scores/history — category-level score trends
  app.get(
    "/:slug/scores/history",
    async (request) => {
      const { slug } = request.params as { slug: string };
      const { days = "30" } = request.query as { days?: string };
      const daysNum = Math.min(parseInt(days) || 30, 90);
      const sinceStr = new Date(Date.now() - daysNum * 86400000).toISOString().slice(0, 10);

      const visibility = await db
        .select()
        .from(appVisibilityScores)
        .where(
          and(
            eq(appVisibilityScores.categorySlug, slug),
            sql`${appVisibilityScores.computedAt} >= ${sinceStr}`,
          )
        )
        .orderBy(appVisibilityScores.computedAt);

      const power = await db
        .select()
        .from(appPowerScores)
        .where(
          and(
            eq(appPowerScores.categorySlug, slug),
            sql`${appPowerScores.computedAt} >= ${sinceStr}`,
          )
        )
        .orderBy(appPowerScores.computedAt);

      return { visibility, power };
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
