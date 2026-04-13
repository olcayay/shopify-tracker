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
  sqlArray,
} from "@appranks/db";
import { cacheGet } from "../utils/cache.js";
import { getCategoryTotalsForPlatform } from "../utils/category-totals.js";
import { PLATFORMS, PLATFORM_IDS, isPlatformId, computeAudit } from "@appranks/shared";
import { filterGloballyVisiblePlatforms } from "../utils/platform-visibility.js";

const PUBLIC_CACHE_TTL = 3600; // 1 hour

export const publicRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  /** Latest category ranking per (app_id, category_slug) + per-platform totals
   *  from the cached helper (PLA-1063). Mirrors the developer-route helper. */
  async function fetchCategoryRankingsForAppsPublic(
    appIds: number[],
  ): Promise<Map<number, { categorySlug: string; categoryName: string; position: number; totalApps: number; percentile: number }[]>> {
    if (appIds.length === 0) return new Map();
    const rows = (await db.execute(sql`
      SELECT DISTINCT ON (r.app_id, r.category_slug)
        r.app_id,
        r.category_slug,
        r.position,
        a.platform,
        c.title AS category_title
      FROM ${appCategoryRankings} r
      JOIN ${apps} a ON a.id = r.app_id
      LEFT JOIN ${categories} c
        ON c.platform = a.platform AND c.slug = r.category_slug
      WHERE r.app_id = ANY(${sqlArray(appIds)})
      ORDER BY r.app_id, r.category_slug, r.scraped_at DESC
    `)) as any;
    const data: any[] = rows.rows ?? rows;
    const platforms = [...new Set(data.map((r) => r.platform).filter(Boolean))] as string[];
    const totalsByPlatform = new Map<string, Record<string, number>>();
    await Promise.all(platforms.map(async (p) => {
      totalsByPlatform.set(p, await getCategoryTotalsForPlatform(db, p));
    }));
    const out = new Map<number, { categorySlug: string; categoryName: string; position: number; totalApps: number; percentile: number }[]>();
    for (const r of data) {
      const totals = totalsByPlatform.get(r.platform) ?? {};
      const total = totals[r.category_slug] ?? 0;
      const position = Number(r.position) || 0;
      const percentile = total > 0 ? Math.ceil((position / total) * 100) : 0;
      const entry = {
        categorySlug: r.category_slug,
        categoryName: r.category_title || r.category_slug,
        position,
        totalApps: total,
        percentile,
      };
      const list = out.get(r.app_id);
      if (list) list.push(entry);
      else out.set(r.app_id, [entry]);
    }
    for (const list of out.values()) list.sort((a, b) => a.position - b.position);
    return out;
  }

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

        // Top 10 ranked apps. We query the LATEST ranking per (app_id) for this
        // category instead of joining on snap.scrape_run_id — appCategoryRankings
        // has a dedup unique index on (app_id, category_slug, DATE(scraped_at))
        // so reruns that hit ON CONFLICT DO NOTHING never update scrape_run_id,
        // leaving the latest snapshot's run id unmatched (PLA-1067).
        let topApps: any[] = [];
        if (cat.isListingPage) {
          const rows = await db.execute(sql`
            SELECT DISTINCT ON (r.app_id)
              r.position,
              a.slug AS app_slug,
              a.name,
              a.icon_url,
              a.average_rating,
              a.rating_count,
              a.pricing_hint,
              r.scraped_at
            FROM ${appCategoryRankings} r
            JOIN ${apps} a ON a.id = r.app_id
            WHERE r.category_slug = ${slug}
              AND a.platform = ${platform}
            ORDER BY r.app_id, r.scraped_at DESC
          `);
          topApps = ((rows as any).rows ?? rows)
            .map((r: any) => ({
              position: r.position,
              appSlug: r.app_slug,
              name: r.name,
              iconUrl: r.icon_url,
              averageRating: r.average_rating,
              ratingCount: r.rating_count,
              pricingHint: r.pricing_hint,
            }))
            .sort((a: any, b: any) => a.position - b.position)
            .slice(0, 10);
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
      if (!isPlatformId(platform)) return reply.code(400).send({ error: "Invalid platform" });

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

        const allPlatformDevs = await db
          .select({
            platform: platformDevelopers.platform,
            name: platformDevelopers.name,
          })
          .from(platformDevelopers)
          .where(eq(platformDevelopers.globalDeveloperId, dev.id));

        const visiblePlatforms = await filterGloballyVisiblePlatforms(
          db,
          allPlatformDevs.map((pd) => pd.platform),
        );
        if (!visiblePlatforms.includes(platform)) return null;

        const platformDevs = allPlatformDevs.filter((pd) => visiblePlatforms.includes(pd.platform));

        // Get apps
        let appList: any[] = [];
        const devNames = platformDevs.map((pd) => pd.name);
        if (devNames.length > 0) {
          const appRows = await db.execute(sql`
            SELECT DISTINCT ON (a.id) a.id, a.slug, a.name, a.icon_url, a.platform,
                   a.average_rating, a.rating_count, a.pricing_hint, a.launched_date
            FROM apps a
            JOIN (
              SELECT DISTINCT ON (app_id) app_id, developer
              FROM app_snapshots ORDER BY app_id, scraped_at DESC
            ) s ON s.app_id = a.id
            WHERE s.developer->>'name' = ANY(${sqlArray(devNames)})
              ${isPlatformId(platform) ? sql`AND a.platform = ${platform}` : sql``}
            ORDER BY a.id
          `);
          const rawRows: any[] = (appRows as any).rows ?? appRows;
          const visibleRows = rawRows.filter((r: any) => visiblePlatforms.includes(r.platform));
          const appIds = visibleRows
            .map((r: any) => r.id)
            .filter((id: unknown): id is number => typeof id === "number");
          const rankingsByAppId = await fetchCategoryRankingsForAppsPublic(appIds);
          appList = visibleRows.map((r: any) => ({
            slug: r.slug,
            name: r.name,
            iconUrl: r.icon_url,
            platform: r.platform,
            averageRating: r.average_rating ? parseFloat(r.average_rating) : null,
            ratingCount: r.rating_count,
            pricingHint: r.pricing_hint,
            launchedDate: r.launched_date ? new Date(r.launched_date).toISOString() : null,
            categoryRankings: rankingsByAppId.get(r.id) ?? [],
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

  // GET /public/keywords/:platform/:slug — public keyword insight
  app.get<{ Params: { platform: string; slug: string } }>(
    "/keywords/:platform/:slug",
    async (request, reply) => {
      const { platform, slug } = request.params;
      if (!isPlatformId(platform)) return reply.code(400).send({ error: "Invalid platform" });

      const result = await cacheGet(`public:kw:${platform}:${slug}`, async () => {
        // Get keyword
        const kwRows = await db.execute(sql`
          SELECT id, keyword, slug FROM tracked_keywords
          WHERE slug = ${slug} AND platform = ${platform} LIMIT 1
        `);
        const kw = ((kwRows as any).rows ?? kwRows)[0];
        if (!kw) return null;

        // Get top 10 ranked apps for this keyword (latest data)
        const rankRows = await db.execute(sql`
          SELECT DISTINCT ON (r.app_id) r.app_id, r.position, r.scraped_at,
                 a.slug AS app_slug, a.name AS app_name, a.icon_url, a.average_rating, a.rating_count, a.pricing_hint
          FROM app_keyword_rankings r
          JOIN apps a ON a.id = r.app_id
          WHERE r.keyword_id = ${kw.id} AND r.position IS NOT NULL
          ORDER BY r.app_id, r.scraped_at DESC
        `);
        const ranks = ((rankRows as any).rows ?? rankRows) as any[];
        const topApps = ranks
          .sort((a: any, b: any) => (a.position || 999) - (b.position || 999))
          .slice(0, 10)
          .map((r: any) => ({
            position: r.position,
            appSlug: r.app_slug,
            name: r.app_name,
            iconUrl: r.icon_url,
            averageRating: r.average_rating ? parseFloat(r.average_rating) : null,
            ratingCount: r.rating_count,
            pricingHint: r.pricing_hint,
          }));

        return {
          keyword: kw.keyword,
          slug: kw.slug,
          platform,
          topApps,
          totalRanked: ranks.length,
        };
      }, PUBLIC_CACHE_TTL);

      if (!result) return reply.code(404).send({ error: "Keyword not found" });
      reply.header("cache-control", "public, max-age=3600, stale-while-revalidate=7200");
      return result;
    }
  );

  // GET /public/audit/:platform/:slug — listing audit report
  app.get<{ Params: { platform: string; slug: string } }>(
    "/audit/:platform/:slug",
    async (request, reply) => {
      const { platform, slug } = request.params;
      if (!isPlatformId(platform)) return reply.code(400).send({ error: "Invalid platform" });

      const result = await cacheGet(`public:audit:${platform}:${slug}`, async () => {
        // Fetch app + latest snapshot with all fields needed for audit
        const rows = await db.execute(sql`
          SELECT a.slug, a.name, a.icon_url, a.platform, a.average_rating, a.rating_count,
                 a.pricing_hint, a.is_built_for_shopify, a.badges, a.app_card_subtitle,
                 s.app_introduction, s.app_details, s.seo_title, s.seo_meta_description,
                 s.features, s.screenshots, s.languages, s.integrations, s.categories,
                 s.pricing, s.pricing_plans, s.developer, s.support, s.demo_store_url,
                 s.platform_data
          FROM apps a
          LEFT JOIN LATERAL (
            SELECT * FROM app_snapshots WHERE app_id = a.id ORDER BY scraped_at DESC LIMIT 1
          ) s ON true
          WHERE a.platform = ${platform} AND a.slug = ${slug}
          LIMIT 1
        `);

        const row = ((rows as any).rows ?? rows)[0];
        if (!row) return null;

        const appData = {
          name: row.name,
          slug: row.slug,
          platform: row.platform,
          iconUrl: row.icon_url,
          averageRating: row.average_rating ? parseFloat(row.average_rating) : null,
          ratingCount: row.rating_count,
          pricingHint: row.pricing_hint,
          isBuiltForShopify: row.is_built_for_shopify,
          badges: row.badges || [],
          appCardSubtitle: row.app_card_subtitle,
        };

        const snapshot = {
          appIntroduction: row.app_introduction || "",
          appDetails: row.app_details || "",
          seoTitle: row.seo_title || "",
          seoMetaDescription: row.seo_meta_description || "",
          features: row.features || [],
          screenshots: row.screenshots || [],
          languages: row.languages || [],
          integrations: row.integrations || [],
          categories: row.categories || [],
          pricing: row.pricing || "",
          pricingPlans: row.pricing_plans || [],
          developer: row.developer || null,
          support: row.support || {},
          demoStoreUrl: row.demo_store_url || "",
          platformData: row.platform_data || {},
        };

        return computeAudit(snapshot, appData, platform);
      }, PUBLIC_CACHE_TTL);

      if (!result) return reply.code(404).send({ error: "App not found" });
      reply.header("cache-control", "public, max-age=3600, stale-while-revalidate=7200");
      return result;
    }
  );

  // GET /public/apps/search — public app search for audit page
  app.get<{ Querystring: { q: string; platform?: string; limit?: string } }>(
    "/apps/search",
    async (request, reply) => {
      const { q, platform, limit: limitStr } = request.query;
      if (!q || q.length < 2) return reply.code(400).send({ error: "Query must be at least 2 characters" });
      const searchLimit = Math.min(parseInt(limitStr || "10", 10), 20);

      const platformFilter = platform && isPlatformId(platform) ? sql`AND a.platform = ${platform}` : sql``;
      const result = await cacheGet(`public:search:${q}:${platform || "all"}:${searchLimit}`, async () => {
        const rows = await db.execute(sql`
          SELECT a.slug, a.name, a.icon_url, a.platform, a.average_rating, a.rating_count, a.pricing_hint
          FROM apps a
          WHERE a.name ILIKE ${"%" + q + "%"} ${platformFilter}
          ORDER BY a.rating_count DESC NULLS LAST
          LIMIT ${searchLimit}
        `);
        return ((rows as any).rows ?? rows).map((r: any) => ({
          slug: r.slug,
          name: r.name,
          iconUrl: r.icon_url,
          platform: r.platform,
          averageRating: r.average_rating ? parseFloat(r.average_rating) : null,
          ratingCount: r.rating_count,
          pricingHint: r.pricing_hint,
        }));
      }, 300); // short cache for search

      reply.header("cache-control", "public, max-age=300");
      return result;
    }
  );

  // GET /public/compare/:platform/:slug1/:slug2 — app comparison data
  app.get<{ Params: { platform: string; slug1: string; slug2: string } }>(
    "/compare/:platform/:slug1/:slug2",
    async (request, reply) => {
      const { platform, slug1, slug2 } = request.params;
      if (!isPlatformId(platform)) return reply.code(400).send({ error: "Invalid platform" });

      const result = await cacheGet(`public:compare:${platform}:${slug1}:${slug2}`, async () => {
        // Fetch both apps with their latest snapshots
        const appRows = await db.execute(sql`
          SELECT a.id, a.slug, a.name, a.icon_url, a.platform, a.average_rating, a.rating_count,
                 a.pricing_hint, a.active_installs, a.launched_date, a.is_built_for_shopify,
                 s.intro, s.developer, s.pricing, s.pricing_plans, s.categories, s.features, s.languages
          FROM apps a
          LEFT JOIN LATERAL (
            SELECT app_introduction AS intro, developer, pricing, pricing_plans, categories, features, languages
            FROM app_snapshots WHERE app_id = a.id ORDER BY scraped_at DESC LIMIT 1
          ) s ON true
          WHERE a.platform = ${platform} AND a.slug IN (${slug1}, ${slug2})
        `);

        const rows = ((appRows as any).rows ?? appRows) as any[];
        if (rows.length < 2) return null;

        const app1Data = rows.find((r: any) => r.slug === slug1);
        const app2Data = rows.find((r: any) => r.slug === slug2);
        if (!app1Data || !app2Data) return null;

        const normalize = (r: any) => ({
          slug: r.slug,
          name: r.name,
          iconUrl: r.icon_url,
          platform: r.platform,
          averageRating: r.average_rating ? parseFloat(r.average_rating) : null,
          ratingCount: r.rating_count,
          pricingHint: r.pricing_hint,
          activeInstalls: r.active_installs,
          launchedDate: r.launched_date,
          isBuiltForShopify: r.is_built_for_shopify,
          intro: r.intro || null,
          developer: r.developer || null,
          pricing: r.pricing || null,
          pricingPlans: r.pricing_plans || [],
          categories: r.categories || [],
          features: r.features || [],
          languages: r.languages || [],
        });

        // Similarity score
        let similarityScore: number | null = null;
        try {
          const simRows = await db.execute(sql`
            SELECT overall_score FROM app_similarity_scores
            WHERE (app_id_a = ${app1Data.id} AND app_id_b = ${app2Data.id})
               OR (app_id_a = ${app2Data.id} AND app_id_b = ${app1Data.id})
            LIMIT 1
          `);
          const simRow = ((simRows as any).rows ?? simRows)[0];
          if (simRow) similarityScore = parseFloat(simRow.overall_score);
        } catch { /* no similarity data */ }

        return {
          app1: normalize(app1Data),
          app2: normalize(app2Data),
          similarityScore,
        };
      }, PUBLIC_CACHE_TTL);

      if (!result) return reply.code(404).send({ error: "One or both apps not found" });
      reply.header("cache-control", "public, max-age=3600, stale-while-revalidate=7200");
      return result;
    }
  );
};
