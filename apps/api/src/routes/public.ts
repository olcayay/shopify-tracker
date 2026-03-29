import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and, desc, asc } from "drizzle-orm";
import {
  apps,
  appSnapshots,
  categories,
  categorySnapshots,
  appCategoryRankings,
  globalDevelopers,
  platformDevelopers,
  appSimilarityScores,
} from "@appranks/db";
import { cacheGet } from "../utils/cache.js";
import { PLATFORMS, PLATFORM_IDS, isPlatformId } from "@appranks/shared";

const PUBLIC_CACHE_TTL = 3600; // 1 hour

export const publicRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /public/apps/:platform/:slug — public app profile
  app.get<{ Params: { platform: string; slug: string } }>(
    "/apps/:platform/:slug",
    async (request, reply) => {
      const { platform, slug } = request.params;
      if (!isPlatformId(platform)) return reply.code(400).send({ error: "Invalid platform" });

      const result = await cacheGet(`public:app:${platform}:${slug}`, async () => {
        const [appRow] = await db
          .select({
            slug: apps.slug,
            name: apps.name,
            iconUrl: apps.iconUrl,
            platform: apps.platform,
            isBuiltForShopify: apps.isBuiltForShopify,
            launchedDate: apps.launchedDate,
            averageRating: apps.averageRating,
            ratingCount: apps.ratingCount,
            pricingHint: apps.pricingHint,
            activeInstalls: apps.activeInstalls,
          })
          .from(apps)
          .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
          .limit(1);

        if (!appRow) return null;

        // Get latest snapshot for extra details
        const snapRows = await db.execute(sql`
          SELECT DISTINCT ON (app_id)
            intro, developer, pricing, pricing_plans, categories, screenshots,
            features, average_rating, rating_count
          FROM app_snapshots
          WHERE app_id = (SELECT id FROM apps WHERE slug = ${slug} AND platform = ${platform} LIMIT 1)
          ORDER BY app_id, scraped_at DESC
        `);
        const snap = ((snapRows as any).rows ?? snapRows)[0] || {};

        // Get top 5 similar apps by similarity score
        const similarRows = await db.execute(sql`
          SELECT a.slug, a.name, a.icon_url, a.average_rating, a.rating_count, a.pricing_hint,
                 s.overall_score
          FROM app_similarity_scores s
          JOIN apps a ON a.id = s.app_id_b
          WHERE s.app_id_a = (SELECT id FROM apps WHERE slug = ${slug} AND platform = ${platform} LIMIT 1)
            AND a.platform = ${platform}
          ORDER BY s.overall_score DESC
          LIMIT 5
        `);
        const similarApps = ((similarRows as any).rows ?? similarRows).map((r: any) => ({
          slug: r.slug,
          name: r.name,
          iconUrl: r.icon_url,
          averageRating: r.average_rating ? parseFloat(r.average_rating) : null,
          ratingCount: r.rating_count,
          pricingHint: r.pricing_hint,
        }));

        return {
          ...appRow,
          intro: snap.intro || null,
          developer: snap.developer || null,
          pricing: snap.pricing || null,
          pricingPlans: snap.pricing_plans || [],
          features: snap.features || [],
          categories: snap.categories || [],
          screenshots: snap.screenshots || [],
          similarApps,
          averageRating: snap.average_rating ? parseFloat(snap.average_rating) : appRow.averageRating,
          ratingCount: snap.rating_count ?? appRow.ratingCount,
        };
      }, PUBLIC_CACHE_TTL);

      if (!result) return reply.code(404).send({ error: "App not found" });
      reply.header("cache-control", "public, max-age=3600, stale-while-revalidate=7200");
      return result;
    }
  );

  // GET /public/categories/:platform/:slug — category with top apps
  app.get<{ Params: { platform: string; slug: string } }>(
    "/categories/:platform/:slug",
    async (request, reply) => {
      const { platform, slug } = request.params;
      if (!isPlatformId(platform)) return reply.code(400).send({ error: "Invalid platform" });

      const result = await cacheGet(`public:cat:${platform}:${slug}`, async () => {
        const [cat] = await db
          .select({
            id: categories.id,
            slug: categories.slug,
            title: categories.title,
            description: categories.description,
            isListingPage: categories.isListingPage,
          })
          .from(categories)
          .where(and(eq(categories.slug, slug), eq(categories.platform, platform)))
          .limit(1);

        if (!cat) return null;

        // Latest snapshot
        const snapRows = await db.execute(sql`
          SELECT DISTINCT ON (category_id) app_count, scrape_run_id, scraped_at
          FROM category_snapshots
          WHERE category_id = ${cat.id}
          ORDER BY category_id, scraped_at DESC
        `);
        const snap = ((snapRows as any).rows ?? snapRows)[0];

        // Top 10 ranked apps
        let topApps: any[] = [];
        if (snap?.scrape_run_id && cat.isListingPage) {
          topApps = await db
            .select({
              position: appCategoryRankings.position,
              appSlug: apps.slug,
              name: apps.name,
              iconUrl: apps.iconUrl,
              averageRating: apps.averageRating,
              ratingCount: apps.ratingCount,
              pricingHint: apps.pricingHint,
            })
            .from(appCategoryRankings)
            .innerJoin(apps, eq(apps.id, appCategoryRankings.appId))
            .where(
              and(
                eq(appCategoryRankings.scrapeRunId, snap.scrape_run_id),
                eq(appCategoryRankings.categorySlug, slug)
              )
            )
            .orderBy(asc(appCategoryRankings.position))
            .limit(10);
        }

        return {
          ...cat,
          appCount: snap?.app_count ?? null,
          lastUpdated: snap?.scraped_at ?? null,
          topApps,
        };
      }, PUBLIC_CACHE_TTL);

      if (!result) return reply.code(404).send({ error: "Category not found" });
      reply.header("cache-control", "public, max-age=3600, stale-while-revalidate=7200");
      return result;
    }
  );

  // GET /public/categories/:platform — category tree for a platform
  app.get<{ Params: { platform: string } }>(
    "/categories/:platform",
    async (request, reply) => {
      const { platform } = request.params;
      if (!isPlatformId(platform)) return reply.code(400).send({ error: "Invalid platform" });

      const result = await cacheGet(`public:cats:${platform}`, async () => {
        return db
          .select({
            slug: categories.slug,
            title: categories.title,
            parentSlug: categories.parentSlug,
            isListingPage: categories.isListingPage,
          })
          .from(categories)
          .where(eq(categories.platform, platform))
          .orderBy(categories.title);
      }, PUBLIC_CACHE_TTL);

      reply.header("cache-control", "public, max-age=3600, stale-while-revalidate=7200");
      return result;
    }
  );

  // GET /public/developers/:platform/:slug — developer profile
  app.get<{ Params: { platform: string; slug: string } }>(
    "/developers/:platform/:slug",
    async (request, reply) => {
      const { platform, slug } = request.params;

      const result = await cacheGet(`public:dev:${platform}:${slug}`, async () => {
        const [dev] = await db
          .select({
            id: globalDevelopers.id,
            slug: globalDevelopers.slug,
            name: globalDevelopers.name,
            website: globalDevelopers.website,
          })
          .from(globalDevelopers)
          .where(eq(globalDevelopers.slug, slug))
          .limit(1);

        if (!dev) return null;

        // Get platform developers
        const platformDevs = await db
          .select({
            platform: platformDevelopers.platform,
            name: platformDevelopers.name,
          })
          .from(platformDevelopers)
          .where(eq(platformDevelopers.globalDeveloperId, dev.id));

        // Get apps
        const devNames = platformDevs.map((pd) => pd.name);
        let appList: any[] = [];
        if (devNames.length > 0) {
          const appRows = await db.execute(sql`
            SELECT DISTINCT ON (a.id) a.slug, a.name, a.icon_url, a.platform,
                   a.average_rating, a.rating_count, a.pricing_hint
            FROM apps a
            JOIN (
              SELECT DISTINCT ON (app_id) app_id, developer
              FROM app_snapshots ORDER BY app_id, scraped_at DESC
            ) s ON s.app_id = a.id
            WHERE s.developer->>'name' = ANY(${devNames})
              ${isPlatformId(platform) ? sql`AND a.platform = ${platform}` : sql``}
            ORDER BY a.id
          `);
          appList = ((appRows as any).rows ?? appRows).map((r: any) => ({
            slug: r.slug,
            name: r.name,
            iconUrl: r.icon_url,
            platform: r.platform,
            averageRating: r.average_rating ? parseFloat(r.average_rating) : null,
            ratingCount: r.rating_count,
            pricingHint: r.pricing_hint,
          }));
        }

        return { ...dev, platforms: platformDevs, apps: appList };
      }, PUBLIC_CACHE_TTL);

      if (!result) return reply.code(404).send({ error: "Developer not found" });
      reply.header("cache-control", "public, max-age=3600, stale-while-revalidate=7200");
      return result;
    }
  );

  // GET /public/platforms/:platform/stats — platform statistics
  app.get<{ Params: { platform: string } }>(
    "/platforms/:platform/stats",
    async (request, reply) => {
      const { platform } = request.params;
      if (!isPlatformId(platform)) return reply.code(400).send({ error: "Invalid platform" });

      const result = await cacheGet(`public:platform-stats:${platform}`, async () => {
        const [appCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(apps)
          .where(eq(apps.platform, platform));

        const [catCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(categories)
          .where(and(eq(categories.platform, platform), eq(categories.isListingPage, true)));

        const [avgRating] = await db
          .select({ avg: sql<number>`round(avg(average_rating)::numeric, 2)` })
          .from(apps)
          .where(and(eq(apps.platform, platform), sql`average_rating IS NOT NULL`));

        const platformConfig = PLATFORMS[platform as keyof typeof PLATFORMS];

        return {
          platform,
          name: platformConfig?.name || platform,
          totalApps: appCount?.count || 0,
          totalCategories: catCount?.count || 0,
          averageRating: avgRating?.avg || null,
        };
      }, PUBLIC_CACHE_TTL);

      reply.header("cache-control", "public, max-age=3600, stale-while-revalidate=7200");
      return result;
    }
  );
};
