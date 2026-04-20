import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, sql, and, ilike, desc, asc } from "drizzle-orm";
import {
  globalDevelopers,
  platformDevelopers,
  apps,
  appSnapshots,
  appCategoryRankings,
  categories,
  accountStarredDevelopers,
  accountPlatforms,
  platformVisibility,
  sqlArray,
} from "@appranks/db";
import { requireSystemAdmin } from "../middleware/authorize.js";
import { getCategoryTotalsForPlatform } from "../utils/category-totals.js";
import { developerNameToSlug } from "@appranks/shared";
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT_SMALL, PAGINATION_DEFAULT_DEVELOPER_APPS, PAGINATION_MAX_DEVELOPER_APPS, PAGINATION_MAX_LIMIT } from "../constants.js";
import { getVisiblePlatformsForAccount } from "../utils/platform-visibility.js";
import { cacheGet } from "../utils/cache.js";

const DEVELOPERS_LIST_TTL_S = 300;

export async function developerRoutes(app: FastifyInstance) {
  const db = app.writeDb;

  // GET /api/developers — list global developers (paginated, searchable)
  app.get(
    "/",
    async (
      request: FastifyRequest<{
        Querystring: {
          page?: string;
          limit?: string;
          search?: string;
          sort?: string;
          order?: string;
          platforms?: string;
        };
      }>
    ) => {
      const page = Math.max(1, parseInt(request.query.page || "1", 10));
      const limit = Math.min(PAGINATION_MAX_LIMIT_SMALL, Math.max(1, parseInt(request.query.limit || String(PAGINATION_DEFAULT_LIMIT), 10)));
      const offset = (page - 1) * limit;
      const search = request.query.search?.trim() || "";
      const VALID_SORTS = new Set([
        "name",
        "apps",
        "platforms",
        "avgRating",
        "avgReviews",
        "firstLaunch",
        "lastLaunch",
      ]);
      const sort = VALID_SORTS.has(request.query.sort || "") ? request.query.sort! : "name";
      const order = request.query.order === "desc" ? "desc" : "asc";
      const platformsParam = request.query.platforms?.trim() || "";
      const requestedPlatforms = platformsParam ? platformsParam.split(",").filter(Boolean) : [];

      // Get account ID (may be null for unauthenticated)
      const accountId = (request as any).user?.accountId || null;
      const userId = (request as any).user?.userId || undefined;

      // Resolve enabled + globally visible platforms for the user's account (system admins bypass)
      const isAdmin = (request as any).user?.isSystemAdmin === true;
      let allowedPlatforms: string[] = [];
      if (!isAdmin && accountId) {
        allowedPlatforms = await getVisiblePlatformsForAccount(db, accountId, userId);
        if (allowedPlatforms.length === 0) {
          return { developers: [], pagination: { page, limit, total: 0, totalPages: 0 } };
        }
      }

      // Intersect requested platforms with allowed platforms
      let platforms: string[];
      if (isAdmin || !accountId) {
        platforms = requestedPlatforms;
      } else if (requestedPlatforms.length > 0) {
        const allowedSet = new Set(allowedPlatforms);
        platforms = requestedPlatforms.filter((p) => allowedSet.has(p));
        if (platforms.length === 0) {
          return { developers: [], pagination: { page, limit, total: 0, totalPages: 0 } };
        }
      } else {
        platforms = allowedPlatforms;
      }

      // Build WHERE conditions
      const conditions: ReturnType<typeof sql>[] = [];
      if (search) {
        conditions.push(sql`g.name ILIKE ${`%${search}%`}`);
      }
      if (platforms.length > 0) {
        conditions.push(sql`EXISTS (SELECT 1 FROM platform_developers pf WHERE pf.global_developer_id = g.id AND pf.platform = ANY(${sqlArray(platforms)}))`);
      }
      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Get total count
      const [countResult] = await db.execute(sql`
        SELECT COUNT(*) as count FROM global_developers g ${whereClause}
      `) as any[];
      const total = Number(countResult?.count || 0);

      // Use sql.raw() for column references — sql`app_count` would parameterize
      // the identifier as a string value instead of a column reference
      const orderColumn =
        sort === "apps"
          ? "app_count"
          : sort === "platforms"
            ? "platform_count"
            : sort === "avgRating"
              ? "avg_rating"
              : sort === "avgReviews"
                ? "avg_review_count"
                : sort === "firstLaunch"
                  ? "first_launch_date"
                  : sort === "lastLaunch"
                    ? "last_launch_date"
                    : "g.name";
      // NULLS LAST so developers with missing stats don't pollute the top of
      // DESC sorts on the new aggregate columns.
      const orderSQL = sql.raw(`(asd.id IS NOT NULL) DESC, ${orderColumn} ${order === "desc" ? "DESC" : "ASC"} NULLS LAST`);

      // Two-phase query (PLA-1103):
      //   Phase 1 — rank, filter, paginate using developer_platform_stats MV.
      //     The MV pre-aggregates per-(developer, platform) app_count and
      //     re-aggregable rating sums so sort-by-apps becomes an index lookup
      //     instead of re-joining platform_developers × apps × app_snapshots on
      //     every request. Averages are recomputed from sum/count so multi-
      //     platform filters produce correct weighted results.
      //   Phase 2 — only for the returned 25 IDs, compute top_apps and
      //     app_counts_by_platform via the latest-snapshot join. Bounded to 25
      //     developers so the expensive LATERAL stays cheap.
      // Before: ~7s on /shopify/developers?sort=apps. Target: <500ms.
      const mvPlatformFilter = platforms.length > 0
        ? sql`WHERE platform = ANY(${sqlArray(platforms)})`
        : sql``;

      const phase1Rows: any[] = await db.execute(sql`
        WITH dev_stats_filtered AS (
          SELECT
            global_developer_id,
            SUM(app_count)::int AS app_count,
            COUNT(DISTINCT platform)::int AS platform_count,
            ARRAY_AGG(platform ORDER BY platform) AS platforms,
            -- Re-derive weighted averages from sum/count so platform-subset
            -- filters produce arithmetically correct results.
            CASE WHEN SUM(count_rating_count) > 0
              THEN (SUM(sum_rating_count)::numeric / NULLIF(SUM(count_rating_count), 0))::numeric(12,2)
              ELSE NULL
            END AS avg_review_count,
            CASE WHEN SUM(count_avg_rating) > 0
              THEN (SUM(sum_avg_rating) / NULLIF(SUM(count_avg_rating), 0))::numeric(3,2)
              ELSE NULL
            END AS avg_rating,
            MIN(first_launch_date) AS first_launch_date,
            MAX(last_launch_date) AS last_launch_date
          FROM developer_platform_stats
          ${mvPlatformFilter}
          GROUP BY global_developer_id
        )
        SELECT
          g.id, g.slug, g.name, g.website,
          COALESCE(dsf.app_count, 0) AS app_count,
          COALESCE(dsf.platform_count, 0) AS platform_count,
          COALESCE(dsf.platforms, '{}'::text[]) AS platforms,
          dsf.avg_review_count,
          dsf.avg_rating,
          dsf.first_launch_date,
          dsf.last_launch_date,
          CASE WHEN asd.id IS NOT NULL THEN true ELSE false END AS is_starred
        FROM global_developers g
        LEFT JOIN dev_stats_filtered dsf ON dsf.global_developer_id = g.id
        LEFT JOIN account_starred_developers asd ON asd.global_developer_id = g.id
          AND asd.account_id = ${accountId}
        ${whereClause}
        ORDER BY ${orderSQL}
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Phase 2: fetch top_apps + app_counts_by_platform only for the page IDs.
      // Cached for 60s — developer top apps rarely change, and the LATERAL join
      // on app_snapshots is the main bottleneck (~2.5s for 25 developers).
      const pageIds = phase1Rows.map((r: any) => Number(r.id));
      const topAppsByDev = new Map<number, any[]>();
      const countsByDev = new Map<number, Record<string, number>>();
      if (pageIds.length > 0) {
        const cacheKey = `dev-phase2:${platforms.join(",")}:${pageIds.join(",")}`;
        const phase2Rows: any[] = await cacheGet(cacheKey, async () => {
          const phase2PlatformFilter = platforms.length > 0
            ? sql`AND a.platform = ANY(${sqlArray(platforms)})`
            : sql``;
          return db.execute(sql`
          WITH dev_apps AS (
            SELECT pd.global_developer_id, a.id AS app_id, a.slug, a.name, a.icon_url, a.platform
            FROM apps a
            JOIN LATERAL (
              SELECT s.developer->>'name' AS dev_name
              FROM app_snapshots s
              WHERE s.app_id = a.id
              ORDER BY s.scraped_at DESC
              LIMIT 1
            ) ls ON ls.dev_name IS NOT NULL
            JOIN platform_developers pd ON pd.platform = a.platform AND pd.name = ls.dev_name
            WHERE pd.global_developer_id = ANY(${sqlArray(pageIds)})
            ${phase2PlatformFilter}
          ),
          dedup AS (
            SELECT DISTINCT ON (global_developer_id, app_id)
              global_developer_id, app_id, slug, name, icon_url, platform
            FROM dev_apps
          ),
          per_platform AS (
            SELECT global_developer_id, platform, COUNT(DISTINCT app_id) AS c
            FROM dedup GROUP BY global_developer_id, platform
          ),
          counts AS (
            SELECT global_developer_id,
              jsonb_object_agg(platform, c) AS app_counts_by_platform
            FROM per_platform
            GROUP BY global_developer_id
          ),
          ranked AS (
            SELECT global_developer_id, icon_url, name, slug, platform,
              ROW_NUMBER() OVER (PARTITION BY global_developer_id ORDER BY name) AS rn
            FROM (
              SELECT DISTINCT ON (global_developer_id, slug)
                global_developer_id, icon_url, name, slug, platform
              FROM dedup
              WHERE icon_url IS NOT NULL
            ) d
          ),
          top AS (
            SELECT global_developer_id,
              jsonb_agg(jsonb_build_object(
                'icon_url', icon_url, 'name', name, 'slug', slug, 'platform', platform
              ) ORDER BY name) FILTER (WHERE rn <= 5) AS top_apps
            FROM ranked
            GROUP BY global_developer_id
          )
          SELECT
            g.id AS global_developer_id,
            COALESCE(t.top_apps, '[]'::jsonb) AS top_apps,
            COALESCE(c.app_counts_by_platform, '{}'::jsonb) AS app_counts_by_platform
          FROM global_developers g
          LEFT JOIN top t ON t.global_developer_id = g.id
          LEFT JOIN counts c ON c.global_developer_id = g.id
          WHERE g.id = ANY(${sqlArray(pageIds)})
        `).then((res: any) => (res as any).rows ?? res);
        }, DEVELOPERS_LIST_TTL_S);
        for (const r of phase2Rows) {
          const devId = Number(r.global_developer_id);
          topAppsByDev.set(devId, Array.isArray(r.top_apps) ? r.top_apps : []);
          const counts = r.app_counts_by_platform && typeof r.app_counts_by_platform === "object"
            ? Object.fromEntries(
                Object.entries(r.app_counts_by_platform as Record<string, unknown>)
                  .map(([k, v]) => [k, Number(v) || 0])
              )
            : {};
          countsByDev.set(devId, counts);
        }
      }

      // Merge phase-2 results onto phase-1 rows for uniform downstream mapping.
      const rows = phase1Rows.map((r: any) => ({
        ...r,
        top_apps: topAppsByDev.get(Number(r.id)) ?? [],
        app_counts_by_platform: countsByDev.get(Number(r.id)) ?? {},
        link_count: Number(r.platform_count || 0),
      }));

      return {
        developers: rows.map((r: any) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          website: r.website,
          platformCount: Number(r.platform_count || 0),
          linkCount: Number(r.link_count || 0),
          appCount: Number(r.app_count || 0),
          appCountsByPlatform: r.app_counts_by_platform && typeof r.app_counts_by_platform === "object"
            ? Object.fromEntries(
                Object.entries(r.app_counts_by_platform as Record<string, unknown>)
                  .map(([k, v]) => [k, Number(v) || 0])
              )
            : {},
          platforms: r.platforms || [],
          topApps: (r.top_apps || []).map((a: any) => ({
            iconUrl: a.icon_url,
            name: a.name,
            slug: a.slug,
            platform: a.platform,
          })),
          avgReviewCount: r.avg_review_count != null ? Number(r.avg_review_count) : null,
          avgRating: r.avg_rating != null ? Number(r.avg_rating) : null,
          firstAppLaunchDate: r.first_launch_date ? new Date(r.first_launch_date).toISOString() : null,
          lastAppLaunchDate: r.last_launch_date ? new Date(r.last_launch_date).toISOString() : null,
          isStarred: r.is_starred === true || r.is_starred === "true",
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );

  // GET /api/developers/tracked — developers of user's tracked apps with their tracked apps
  app.get("/tracked", async (request) => {
    const accountId = (request as any).user?.accountId || null;
    const userId = (request as any).user?.userId || undefined;
    if (!accountId) return { developers: [] };

    // Filter by enabled + globally visible platforms (system admins bypass)
    const isAdmin = (request as any).user?.isSystemAdmin === true;
    let platformFilterSql = sql``;
    let trackedAppsPlatformFilterSql = sql``;
    if (!isAdmin) {
      const enabledPlatforms = await getVisiblePlatformsForAccount(db, accountId, userId);
      if (enabledPlatforms.length === 0) return { developers: [] };
      platformFilterSql = sql`AND a.platform = ANY(${sqlArray(enabledPlatforms)})`;
      trackedAppsPlatformFilterSql = sql`AND ta.platform = ANY(${sqlArray(enabledPlatforms)})`;
    }

    // Two-phase query (PLA-1144):
    // Phase 1: Find developer IDs of tracked apps + stats from developer_platform_stats MV.
    //   Uses the MV for total_apps instead of correlated subqueries against app_snapshots.
    // Phase 2: Batch-fetch tracked app details only for the found developers.
    const phase1Rows: any[] = await db.execute(sql`
      WITH tracked_dev_ids AS (
        SELECT DISTINCT pd.global_developer_id
        FROM account_tracked_apps ata
        JOIN apps a ON a.id = ata.app_id
        JOIN platform_developers pd ON pd.platform = a.platform
        JOIN LATERAL (
          SELECT s.developer->>'name' AS dev_name
          FROM app_snapshots s WHERE s.app_id = a.id
          ORDER BY s.scraped_at DESC LIMIT 1
        ) ls ON ls.dev_name = pd.name
        WHERE ata.account_id = ${accountId} ${platformFilterSql}
      )
      SELECT
        g.id, g.slug, g.name,
        COALESCE(dps.app_count, 0) AS total_apps,
        COALESCE(dps.platform_count, 0) AS platform_count,
        COALESCE(dps.platforms, '{}'::text[]) AS platforms,
        CASE WHEN asd.id IS NOT NULL THEN true ELSE false END AS is_starred
      FROM tracked_dev_ids tdi
      JOIN global_developers g ON g.id = tdi.global_developer_id
      LEFT JOIN LATERAL (
        SELECT
          SUM(app_count)::int AS app_count,
          COUNT(DISTINCT platform)::int AS platform_count,
          ARRAY_AGG(platform ORDER BY platform) AS platforms
        FROM developer_platform_stats
        WHERE global_developer_id = g.id
      ) dps ON true
      LEFT JOIN account_starred_developers asd ON asd.global_developer_id = g.id AND asd.account_id = ${accountId}
      ORDER BY (asd.id IS NOT NULL) DESC, total_apps DESC, g.name ASC
    `);

    // Phase 2: batch-fetch tracked apps per developer
    const devIds = phase1Rows.map((r: any) => Number(r.id));
    const trackedAppsMap = new Map<number, any[]>();
    if (devIds.length > 0) {
      const appRows: any[] = await db.execute(sql`
        SELECT
          pd.global_developer_id AS dev_id,
          ta.slug, ta.name, ta.platform, ta.icon_url
        FROM apps ta
        JOIN account_tracked_apps ata ON ata.app_id = ta.id AND ata.account_id = ${accountId}
        JOIN platform_developers pd ON pd.global_developer_id = ANY(${sqlArray(devIds)})
          AND pd.platform = ta.platform
        JOIN LATERAL (
          SELECT s.developer->>'name' AS dev_name
          FROM app_snapshots s WHERE s.app_id = ta.id
          ORDER BY s.scraped_at DESC LIMIT 1
        ) ls ON ls.dev_name = pd.name
        ${trackedAppsPlatformFilterSql ? sql`WHERE true ${trackedAppsPlatformFilterSql}` : sql``}
      `);
      for (const ar of appRows) {
        const devId = Number(ar.dev_id);
        if (!trackedAppsMap.has(devId)) trackedAppsMap.set(devId, []);
        trackedAppsMap.get(devId)!.push({
          slug: ar.slug, name: ar.name, platform: ar.platform, iconUrl: ar.icon_url,
        });
      }
    }

    const rows = phase1Rows.map((r: any) => ({
      ...r,
      tracked_apps: trackedAppsMap.get(Number(r.id)) || [],
    }));

    return {
      developers: rows.map((r: any) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        platformCount: Number(r.platform_count || 0),
        platforms: r.platforms || [],
        totalApps: Number(r.total_apps || 0),
        isStarred: r.is_starred === true || r.is_starred === "true",
        trackedApps: r.tracked_apps || [],
      })),
    };
  });

  // GET /api/developers/competitors — developers of competitor apps
  app.get("/competitors", async (request) => {
    const accountId = (request as any).user?.accountId || null;
    const userId = (request as any).user?.userId || undefined;
    if (!accountId) return { developers: [] };

    const requestedPlatform = (request.query as any).platform?.trim() || "";

    // Filter by enabled + globally visible platforms
    const isAdmin = (request as any).user?.isSystemAdmin === true;
    let platformFilterSql = sql``;
    let compAppsPlatformFilterSql = sql``;
    if (!isAdmin) {
      const enabledPlatforms = await getVisiblePlatformsForAccount(db, accountId, userId);
      if (enabledPlatforms.length === 0) return { developers: [] };
      const platforms = requestedPlatform
        ? enabledPlatforms.filter((p: string) => p === requestedPlatform)
        : enabledPlatforms;
      if (platforms.length === 0) return { developers: [] };
      platformFilterSql = sql`AND a.platform = ANY(${sqlArray(platforms)})`;
      compAppsPlatformFilterSql = sql`AND ca.platform = ANY(${sqlArray(platforms)})`;
    } else if (requestedPlatform) {
      platformFilterSql = sql`AND a.platform = ${requestedPlatform}`;
      compAppsPlatformFilterSql = sql`AND ca.platform = ${requestedPlatform}`;
    }

    // Two-phase query (PLA-1144): same pattern as /tracked above.
    // Phase 1: Find developer IDs + stats from MV
    const phase1Rows: any[] = await db.execute(sql`
      WITH comp_dev_ids AS (
        SELECT DISTINCT pd.global_developer_id
        FROM account_competitor_apps aca
        JOIN apps a ON a.id = aca.competitor_app_id
        JOIN platform_developers pd ON pd.platform = a.platform
        JOIN LATERAL (
          SELECT s.developer->>'name' AS dev_name
          FROM app_snapshots s WHERE s.app_id = a.id
          ORDER BY s.scraped_at DESC LIMIT 1
        ) ls ON ls.dev_name = pd.name
        WHERE aca.account_id = ${accountId} ${platformFilterSql}
      )
      SELECT
        g.id, g.slug, g.name,
        COALESCE(dps.app_count, 0) AS total_apps,
        COALESCE(dps.platform_count, 0) AS platform_count,
        COALESCE(dps.platforms, '{}'::text[]) AS platforms,
        CASE WHEN asd.id IS NOT NULL THEN true ELSE false END AS is_starred
      FROM comp_dev_ids cdi
      JOIN global_developers g ON g.id = cdi.global_developer_id
      LEFT JOIN LATERAL (
        SELECT
          SUM(app_count)::int AS app_count,
          COUNT(DISTINCT platform)::int AS platform_count,
          ARRAY_AGG(platform ORDER BY platform) AS platforms
        FROM developer_platform_stats
        WHERE global_developer_id = g.id
      ) dps ON true
      LEFT JOIN account_starred_developers asd ON asd.global_developer_id = g.id AND asd.account_id = ${accountId}
      ORDER BY (asd.id IS NOT NULL) DESC, total_apps DESC, g.name ASC
    `);

    // Phase 2: batch-fetch competitor apps per developer
    const devIds = phase1Rows.map((r: any) => Number(r.id));
    const compAppsMap = new Map<number, any[]>();
    if (devIds.length > 0) {
      const appRows: any[] = await db.execute(sql`
        SELECT
          pd.global_developer_id AS dev_id,
          ca.slug, ca.name, ca.platform, ca.icon_url
        FROM apps ca
        JOIN account_competitor_apps aca ON aca.competitor_app_id = ca.id AND aca.account_id = ${accountId}
        JOIN platform_developers pd ON pd.global_developer_id = ANY(${sqlArray(devIds)})
          AND pd.platform = ca.platform
        JOIN LATERAL (
          SELECT s.developer->>'name' AS dev_name
          FROM app_snapshots s WHERE s.app_id = ca.id
          ORDER BY s.scraped_at DESC LIMIT 1
        ) ls ON ls.dev_name = pd.name
        ${compAppsPlatformFilterSql ? sql`WHERE true ${compAppsPlatformFilterSql}` : sql``}
      `);
      for (const ar of appRows) {
        const devId = Number(ar.dev_id);
        if (!compAppsMap.has(devId)) compAppsMap.set(devId, []);
        compAppsMap.get(devId)!.push({
          slug: ar.slug, name: ar.name, platform: ar.platform, iconUrl: ar.icon_url,
        });
      }
    }

    return {
      developers: phase1Rows.map((r: any) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        platformCount: Number(r.platform_count || 0),
        platforms: r.platforms || [],
        totalApps: Number(r.total_apps || 0),
        isStarred: r.is_starred === true || r.is_starred === "true",
        competitorApps: compAppsMap.get(Number(r.id)) || [],
      })),
    };
  });

  /**
   * Latest category ranking per (app_id, category_slug) for the given app ids,
   * joined with the category title. Returns a Map keyed by appId with:
   *   { categorySlug, categoryName, position, totalApps, percentile }[]
   *
   * totalApps = distinct apps ranked in that category's latest scrape window
   * (approximation: distinct app_ids with any ranking per platform+slug). Good
   * enough for the "Top X%" tier display; exact cohort sizing isn't needed
   * for this UI.
   */
  async function fetchCategoryRankingsForApps(
    appIds: number[],
  ): Promise<Map<number, { categorySlug: string; categoryName: string; position: number; totalApps: number; percentile: number }[]>> {
    if (appIds.length === 0) return new Map();
    // Per-request work: only the bounded latest_app_cat query — uses the
    // (app_id, category_slug, scraped_at DESC) index from migration 0132.
    // cat_totals is fetched per-platform from the category-totals cache to
    // avoid a full `app_category_rankings` scan on every request (PLA-1063).
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
    // Resolve per-platform totals once, in parallel.
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
    // Sort each app's rankings by position for stable UI.
    for (const list of out.values()) list.sort((a, b) => a.position - b.position);
    return out;
  }

  // GET /api/developers/:slug — developer profile + all apps across platforms
  app.get(
    "/:slug",
    async (
      request: FastifyRequest<{ Params: { slug: string } }>,
      reply
    ) => {
      const slug = request.params.slug.toLowerCase();
      const accountId = (request as any).user?.accountId || null;
      const userId = (request as any).user?.userId || undefined;
      const isAdmin = (request as any).user?.isSystemAdmin === true;

      // Get global developer
      const [developer] = await db
        .select()
        .from(globalDevelopers)
        .where(eq(globalDevelopers.slug, slug))
        .limit(1);

      if (!developer) {
        return reply.code(404).send({ error: "Developer not found" });
      }

      let allowedPlatforms: string[] | null = null;
      if (!isAdmin && accountId) {
        allowedPlatforms = await getVisiblePlatformsForAccount(db, accountId, userId);
        if (allowedPlatforms.length === 0) {
          return reply.code(404).send({ error: "Developer not found" });
        }
      }

      // Get all platform developers linked to this global developer
      const allPlatformDevs = await db
        .select({
          id: platformDevelopers.id,
          platform: platformDevelopers.platform,
          name: platformDevelopers.name,
        })
        .from(platformDevelopers)
        .where(eq(platformDevelopers.globalDeveloperId, developer.id));

      const platformDevs = allowedPlatforms
        ? allPlatformDevs.filter((pd: { platform: string }) => allowedPlatforms!.includes(pd.platform))
        : allPlatformDevs;

      if (platformDevs.length === 0) {
        return reply.code(404).send({ error: "Developer not found" });
      }

      // For each platform developer, get their apps (from latest snapshots)
      const developerApps: {
        id: number;
        platform: string;
        slug: string;
        name: string;
        iconUrl: string | null;
        averageRating: number | null;
        ratingCount: number | null;
        pricingHint: string | null;
        isTracked: boolean;
        activeInstalls: number | null;
        launchedDate: string | null;
        categoryRankings: {
          categorySlug: string;
          categoryName: string;
          position: number;
          totalApps: number;
          percentile: number;
        }[];
      }[] = [];

      // Batch-fetch apps for all platform developers in a single query
      if (platformDevs.length > 0) {
        const devPlatforms = platformDevs.map((pd: { platform: string }) => pd.platform);
        const allAppRows = await db.execute(sql`
          SELECT DISTINCT ON (a.id)
            a.id,
            a.platform,
            a.slug,
            a.name,
            a.icon_url,
            a.average_rating,
            a.rating_count,
            a.pricing_hint,
            a.is_tracked,
            a.active_installs,
            a.launched_date
          FROM ${apps} a
          JOIN ${appSnapshots} s ON s.app_id = a.id
          JOIN ${platformDevelopers} pd ON pd.global_developer_id = ${developer.id}
            AND pd.platform = a.platform
          WHERE a.platform = ANY(${sqlArray(devPlatforms)})
            AND s.developer->>'name' = pd.name
            AND s.id = (
              SELECT s2.id FROM ${appSnapshots} s2
              WHERE s2.app_id = a.id
              ORDER BY s2.scraped_at DESC LIMIT 1
            )
          ORDER BY a.id
        `);
        const appData: any[] = (allAppRows as any).rows ?? allAppRows;
        const appIds: number[] = [];
        for (const row of appData) {
          if (!devPlatforms.includes(row.platform)) continue;
          if (typeof row.id === "number") appIds.push(row.id);
        }
        const rankingsByAppId = appIds.length > 0
          ? await fetchCategoryRankingsForApps(appIds)
          : new Map();
        for (const row of appData) {
          if (!devPlatforms.includes(row.platform)) continue;
          developerApps.push({
            id: row.id,
            platform: row.platform,
            slug: row.slug,
            name: row.name,
            iconUrl: row.icon_url,
            averageRating: row.average_rating ? parseFloat(row.average_rating) : null,
            ratingCount: row.rating_count,
            pricingHint: row.pricing_hint,
            isTracked: row.is_tracked,
            activeInstalls: row.active_installs,
            launchedDate: row.launched_date
              ? new Date(row.launched_date).toISOString()
              : null,
            categoryRankings: rankingsByAppId.get(row.id) ?? [],
          });
        }
      }

      // Check if developer is starred by current account
      let isStarred = false;
      if (accountId) {
        const [starred] = await db
          .select({ id: accountStarredDevelopers.id })
          .from(accountStarredDevelopers)
          .where(
            and(
              eq(accountStarredDevelopers.accountId, accountId),
              eq(accountStarredDevelopers.globalDeveloperId, developer.id)
            )
          )
          .limit(1);
        isStarred = !!starred;
      }

      return {
        developer: {
          id: developer.id,
          slug: developer.slug,
          name: developer.name,
          website: developer.website,
          createdAt: developer.createdAt,
        },
        platforms: platformDevs.map((pd: { id: number; platform: string; name: string }) => ({
          id: pd.id,
          platform: pd.platform,
          name: pd.name,
          appCount: developerApps.filter((a) => a.platform === pd.platform).length,
        })),
        apps: developerApps,
        totalApps: developerApps.length,
        isStarred,
      };
    }
  );

  // =========================================================================
  // System Admin endpoints
  // =========================================================================

  // GET /api/developers/admin/list — admin view with extra details
  app.get(
    "/admin/list",
    { preHandler: [requireSystemAdmin()] },
    async (
      request: FastifyRequest<{
        Querystring: {
          page?: string;
          limit?: string;
          search?: string;
          platform?: string;
          sort?: string;
          order?: string;
        };
      }>
    ) => {
      const page = Math.max(1, parseInt(request.query.page || "1", 10));
      const limit = Math.min(PAGINATION_MAX_LIMIT, Math.max(1, parseInt(request.query.limit || String(PAGINATION_MAX_LIMIT_SMALL), 10)));
      const offset = (page - 1) * limit;
      const search = request.query.search?.trim() || "";
      const platformFilter = request.query.platform?.trim() || "";
      const sortField = (["name", "apps", "platforms"].includes(request.query.sort || "") ? request.query.sort : "name") as string;
      const sortOrder = request.query.order === "desc" ? "DESC" : "ASC";

      // Build WHERE conditions
      const whereParts: ReturnType<typeof sql>[] = [];
      if (search) {
        whereParts.push(sql`g.name ILIKE ${`%${search}%`}`);
      }
      if (platformFilter) {
        whereParts.push(sql`EXISTS (SELECT 1 FROM platform_developers pd2 WHERE pd2.global_developer_id = g.id AND pd2.platform = ${platformFilter})`);
      }
      const whereSQL = whereParts.length > 0
        ? sql`WHERE ${sql.join(whereParts, sql` AND `)}`
        : sql``;

      // Build ORDER BY
      const orderSQL = sortField === "apps"
        ? sql`ORDER BY app_count ${sql.raw(sortOrder)}, g.name`
        : sortField === "platforms"
        ? sql`ORDER BY platform_count ${sql.raw(sortOrder)}, g.name`
        : sql`ORDER BY g.name ${sql.raw(sortOrder)}`;

      const [countResult]: any[] = await db.execute(sql`
        SELECT COUNT(*) FROM global_developers g ${whereSQL}
      `);
      const total = Number(countResult?.count || 0);

      // Use lateral join to count apps per developer without cross-joining all apps
      const rows: any[] = await db.execute(sql`
        WITH dev_app_counts AS (
          SELECT pd.global_developer_id, COUNT(DISTINCT a.id) AS app_count
          FROM apps a
          JOIN LATERAL (
            SELECT s.developer->>'name' AS dev_name
            FROM app_snapshots s
            WHERE s.app_id = a.id
            ORDER BY s.scraped_at DESC
            LIMIT 1
          ) ls ON ls.dev_name IS NOT NULL
          JOIN platform_developers pd ON pd.platform = a.platform AND pd.name = ls.dev_name
          GROUP BY pd.global_developer_id
        )
        SELECT
          g.id,
          g.slug,
          g.name,
          g.website,
          g.created_at,
          (
            SELECT json_agg(json_build_object(
              'id', pd.id,
              'platform', pd.platform,
              'name', pd.name
            ))
            FROM platform_developers pd
            WHERE pd.global_developer_id = g.id
          ) AS platform_developers,
          COALESCE(dac.app_count, 0) AS app_count,
          (SELECT COUNT(*) FROM platform_developers pd3 WHERE pd3.global_developer_id = g.id) AS platform_count
        FROM global_developers g
        LEFT JOIN dev_app_counts dac ON dac.global_developer_id = g.id
        ${whereSQL}
        ${orderSQL}
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        developers: rows.map((r: any) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          website: r.website,
          createdAt: r.created_at,
          platformDevelopers: r.platform_developers || [],
          appCount: Number(r.app_count || 0),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    }
  );

  // POST /api/developers/admin/create — create a global developer manually
  app.post(
    "/admin/create",
    { preHandler: [requireSystemAdmin()] },
    async (request, reply) => {
      const { name, website } = request.body as { name: string; website?: string };
      if (!name?.trim()) {
        return reply.code(400).send({ error: "Name is required" });
      }

      const slug = developerNameToSlug(name.trim());
      if (!slug) {
        return reply.code(400).send({ error: "Cannot generate slug from name" });
      }

      // Check for existing slug
      const [existing] = await db
        .select({ id: globalDevelopers.id })
        .from(globalDevelopers)
        .where(eq(globalDevelopers.slug, slug))
        .limit(1);

      if (existing) {
        return reply.code(409).send({ error: "A developer with this slug already exists", existingId: existing.id });
      }

      const [created] = await db
        .insert(globalDevelopers)
        .values({
          slug,
          name: name.trim(),
          website: website?.trim() || null,
        })
        .returning();

      return { developer: created };
    }
  );

  // POST /api/developers/admin/merge — merge source into target
  app.post(
    "/admin/merge",
    { preHandler: [requireSystemAdmin()] },
    async (request, reply) => {
      const { sourceId, targetId } = request.body as { sourceId: number; targetId: number };
      if (!sourceId || !targetId || sourceId === targetId) {
        return reply.code(400).send({ error: "sourceId and targetId must be different" });
      }

      // Move all platform developers from source to target
      await db
        .update(platformDevelopers)
        .set({ globalDeveloperId: targetId })
        .where(eq(platformDevelopers.globalDeveloperId, sourceId));

      // Delete the source global developer
      await db
        .delete(globalDevelopers)
        .where(eq(globalDevelopers.id, sourceId));

      return { success: true, mergedInto: targetId };
    }
  );

  // POST /api/developers/admin/unlink — detach a platform developer
  app.post(
    "/admin/unlink",
    { preHandler: [requireSystemAdmin()] },
    async (request, reply) => {
      const { platformDeveloperId } = request.body as { platformDeveloperId: number };
      if (!platformDeveloperId) {
        return reply.code(400).send({ error: "platformDeveloperId is required" });
      }

      // Get the platform developer
      const [pd] = await db
        .select()
        .from(platformDevelopers)
        .where(eq(platformDevelopers.id, platformDeveloperId))
        .limit(1);

      if (!pd) {
        return reply.code(404).send({ error: "Platform developer not found" });
      }

      // Create a new global developer for this platform developer
      const slug = developerNameToSlug(pd.name);
      const [newGlobal] = await db
        .insert(globalDevelopers)
        .values({
          slug: `${slug}-${pd.platform}`,
          name: pd.name,
        })
        .returning();

      // Re-link to the new global developer
      await db
        .update(platformDevelopers)
        .set({ globalDeveloperId: newGlobal.id })
        .where(eq(platformDevelopers.id, platformDeveloperId));

      return { success: true, newGlobalDeveloperId: newGlobal.id };
    }
  );

  // POST /api/developers/admin/link — re-link a platform developer to a different global developer
  app.post(
    "/admin/link",
    { preHandler: [requireSystemAdmin()] },
    async (request, reply) => {
      const { platformDeveloperId, globalDeveloperId } = request.body as { platformDeveloperId: number; globalDeveloperId: number };
      if (!platformDeveloperId || !globalDeveloperId) {
        return reply.code(400).send({ error: "platformDeveloperId and globalDeveloperId are required" });
      }

      // Verify both exist
      const [pd] = await db
        .select({ id: platformDevelopers.id, globalDeveloperId: platformDevelopers.globalDeveloperId })
        .from(platformDevelopers)
        .where(eq(platformDevelopers.id, platformDeveloperId))
        .limit(1);

      if (!pd) {
        return reply.code(404).send({ error: "Platform developer not found" });
      }

      const [gd] = await db
        .select({ id: globalDevelopers.id })
        .from(globalDevelopers)
        .where(eq(globalDevelopers.id, globalDeveloperId))
        .limit(1);

      if (!gd) {
        return reply.code(404).send({ error: "Global developer not found" });
      }

      const oldGlobalId = pd.globalDeveloperId;

      await db
        .update(platformDevelopers)
        .set({ globalDeveloperId })
        .where(eq(platformDevelopers.id, platformDeveloperId));

      // If the old global developer has no more platform developers, delete it
      const [remaining] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(platformDevelopers)
        .where(eq(platformDevelopers.globalDeveloperId, oldGlobalId));

      if (Number(remaining?.count || 0) === 0) {
        await db.delete(globalDevelopers).where(eq(globalDevelopers.id, oldGlobalId));
      }

      return { success: true };
    }
  );

  // GET /api/developers/admin/suggestions — find merge candidates via slug similarity
  app.get(
    "/admin/suggestions",
    { preHandler: [requireSystemAdmin()] },
    async (
      request: FastifyRequest<{
        Querystring: { limit?: string };
      }>
    ) => {
      const limit = Math.min(PAGINATION_MAX_DEVELOPER_APPS, Math.max(1, parseInt(request.query.limit || String(PAGINATION_DEFAULT_DEVELOPER_APPS), 10)));

      // Find global developers that share similar slugs (Levenshtein distance <= 2)
      // or where one slug is a prefix of another
      const rows: any[] = await db.execute(sql`
        SELECT
          g1.id AS id1, g1.slug AS slug1, g1.name AS name1,
          g2.id AS id2, g2.slug AS slug2, g2.name AS name2,
          similarity(g1.slug, g2.slug) AS sim
        FROM global_developers g1
        JOIN global_developers g2 ON g1.id < g2.id
        WHERE similarity(g1.slug, g2.slug) > 0.6
        ORDER BY similarity(g1.slug, g2.slug) DESC
        LIMIT ${limit}
      `);

      return {
        suggestions: rows.map((r: any) => ({
          developer1: { id: r.id1, slug: r.slug1, name: r.name1 },
          developer2: { id: r.id2, slug: r.slug2, name: r.name2 },
          similarity: parseFloat(r.sim),
        })),
      };
    }
  );
}
