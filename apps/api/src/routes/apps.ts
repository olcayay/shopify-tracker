import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and, inArray, ilike } from "drizzle-orm";
import { createDb } from "@appranks/db";
import { computeWeightedPowerScore } from "@appranks/shared";
import { getPlatformFromQuery } from "../utils/platform.js";
import { requireSystemAdmin } from "../middleware/authorize.js";
import {
  apps,
  appSnapshots,
  appFieldChanges,
  appCategoryRankings,
  appKeywordRankings,
  keywordAdSightings,
  categoryAdSightings,
  reviews,
  trackedKeywords,
  categories,
  accountTrackedApps,
  accountCompetitorApps,
  accountTrackedKeywords,
  similarAppSightings,
  featuredAppSightings,
  appReviewMetrics,
  appVisibilityScores,
  appPowerScores,
  researchProjects,
  researchProjectCompetitors,
} from "@appranks/db";

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
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    // Get app IDs tracked by this account
    const trackedRows = await db
      .select({ appId: accountTrackedApps.appId })
      .from(accountTrackedApps)
      .where(eq(accountTrackedApps.accountId, accountId));

    if (trackedRows.length === 0) {
      return [];
    }

    const appIds = trackedRows.map((r) => r.appId);
    const rows = await db
      .select()
      .from(apps)
      .where(and(inArray(apps.id, appIds), eq(apps.platform, platform)))
      .orderBy(apps.name);

    // Get competitor and keyword counts per tracked app
    const competitorCounts = await db
      .select({
        trackedAppId: accountCompetitorApps.trackedAppId,
        count: sql<number>`count(*)::int`,
      })
      .from(accountCompetitorApps)
      .where(eq(accountCompetitorApps.accountId, accountId))
      .groupBy(accountCompetitorApps.trackedAppId);

    const keywordCounts = await db
      .select({
        trackedAppId: accountTrackedKeywords.trackedAppId,
        count: sql<number>`count(*)::int`,
      })
      .from(accountTrackedKeywords)
      .where(eq(accountTrackedKeywords.accountId, accountId))
      .groupBy(accountTrackedKeywords.trackedAppId);

    const compCountMap = new Map(competitorCounts.map((r) => [r.trackedAppId, r.count]));
    const kwCountMap = new Map(keywordCounts.map((r) => [r.trackedAppId, r.count]));

    // Get ranked keyword counts per tracked app
    const rankedKwMap = new Map<number, number>();
    const allKeywordRows = await db
      .select({
        trackedAppId: accountTrackedKeywords.trackedAppId,
        keywordId: accountTrackedKeywords.keywordId,
      })
      .from(accountTrackedKeywords)
      .where(eq(accountTrackedKeywords.accountId, accountId));

    if (allKeywordRows.length > 0) {
      const kwByApp = new Map<number, number[]>();
      for (const row of allKeywordRows) {
        const arr = kwByApp.get(row.trackedAppId) ?? [];
        arr.push(row.keywordId);
        kwByApp.set(row.trackedAppId, arr);
      }

      for (const [trackedAppId, keywordIds] of kwByApp) {
        const idList = sql.join(keywordIds.map((id) => sql`${id}`), sql`,`);
        const rankedRows = await db.execute(sql`
          SELECT COUNT(DISTINCT keyword_id)::int AS cnt
          FROM (
            SELECT DISTINCT ON (keyword_id) keyword_id, position
            FROM app_keyword_rankings
            WHERE app_id = ${trackedAppId}
              AND keyword_id IN (${idList})
            ORDER BY keyword_id, scraped_at DESC
          ) latest
          WHERE position IS NOT NULL
        `);
        const data: any[] = (rankedRows as any).rows ?? rankedRows;
        rankedKwMap.set(trackedAppId, data[0]?.cnt ?? 0);
      }
    }

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
          .where(eq(appSnapshots.appId, appRow.id))
          .orderBy(desc(appSnapshots.scrapedAt))
          .limit(1);

        const [change] = await db
          .select({ detectedAt: appFieldChanges.detectedAt })
          .from(appFieldChanges)
          .where(eq(appFieldChanges.appId, appRow.id))
          .orderBy(desc(appFieldChanges.detectedAt))
          .limit(1);

        const minPaidPrice = getMinPaidPrice(snapshot?.pricingPlans);
        const { pricingPlans: _, ...snapshotRest } = snapshot || ({} as any);

        return {
          ...appRow,
          latestSnapshot: snapshot ? snapshotRest : null,
          minPaidPrice,
          lastChangeAt: change?.detectedAt || null,
          competitorCount: compCountMap.get(appRow.id) ?? 0,
          keywordCount: kwCountMap.get(appRow.id) ?? 0,
          rankedKeywordCount: rankedKwMap.get(appRow.id) ?? 0,
        };
      })
    );

    return result;
  });

  // POST /api/apps/last-changes — bulk lookup lastChangeAt for multiple apps
  app.post("/last-changes", async (request) => {
    const { slugs } = request.body as { slugs: string[] };
    if (!slugs?.length) return {};
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    const rows = await db
      .select({
        appSlug: apps.slug,
        lastChangeAt: sql<string>`max(${appFieldChanges.detectedAt})`,
      })
      .from(appFieldChanges)
      .innerJoin(apps, eq(apps.id, appFieldChanges.appId))
      .where(and(inArray(apps.slug, slugs), eq(apps.platform, platform)))
      .groupBy(apps.slug);

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
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    const rows = await db
      .select({
        appSlug: apps.slug,
        pricingPlans: appSnapshots.pricingPlans,
      })
      .from(appSnapshots)
      .innerJoin(apps, eq(apps.id, appSnapshots.appId))
      .where(
        and(
          inArray(apps.slug, slugs),
          eq(apps.platform, platform),
          sql`${appSnapshots.id} = (SELECT s2.id FROM app_snapshots s2 WHERE s2.app_id = ${appSnapshots.appId} ORDER BY s2.scraped_at DESC LIMIT 1)`
        )
      );

    const result: Record<string, number | null> = {};
    for (const r of rows) {
      result[r.appSlug] = getMinPaidPrice(r.pricingPlans);
    }
    return result;
  });

  // POST /api/apps/launched-dates — bulk lookup launchedDate for multiple apps
  app.post("/launched-dates", async (request) => {
    const { slugs } = request.body as { slugs: string[] };
    if (!slugs?.length) return {};
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    const rows = await db
      .select({ slug: apps.slug, launchedDate: apps.launchedDate })
      .from(apps)
      .where(and(inArray(apps.slug, slugs), eq(apps.platform, platform)));

    const result: Record<string, string | null> = {};
    for (const r of rows) {
      result[r.slug] = r.launchedDate ? r.launchedDate.toISOString() : null;
    }
    return result;
  });

  // POST /api/apps/categories — bulk lookup leaf categories for multiple apps
  app.post("/categories", async (request) => {
    const { slugs } = request.body as { slugs: string[] };
    if (!slugs?.length) return {};
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    // Look up app IDs from slugs (scoped to platform)
    const appRows = await db
      .select({ id: apps.id, slug: apps.slug })
      .from(apps)
      .where(and(inArray(apps.slug, slugs), eq(apps.platform, platform)));
    const appIdsBySlug = new Map(appRows.map((a) => [a.id, a.slug]));
    const appIdList = appRows.map((a) => a.id);

    if (appIdList.length === 0) return {};

    // Get distinct category slugs per app from latest rankings (listing pages only)
    const rows = await db
      .selectDistinctOn([appCategoryRankings.appId, appCategoryRankings.categorySlug], {
        appId: appCategoryRankings.appId,
        categorySlug: appCategoryRankings.categorySlug,
        categoryTitle: categories.title,
        position: appCategoryRankings.position,
      })
      .from(appCategoryRankings)
      .innerJoin(categories, and(
        eq(categories.slug, appCategoryRankings.categorySlug),
        eq(categories.platform, platform),
        eq(categories.isListingPage, true),
      ))
      .where(inArray(appCategoryRankings.appId, appIdList))
      .orderBy(appCategoryRankings.appId, appCategoryRankings.categorySlug, desc(appCategoryRankings.scrapedAt));

    // Group by app slug (skip position <= 0 — invalid/sponsored artifacts)
    const result: Record<string, { title: string; slug: string; position: number | null }[]> = {};
    for (const r of rows) {
      if (r.position != null && r.position <= 0) continue;
      const appSlug = appIdsBySlug.get(r.appId) || '';
      if (!result[appSlug]) result[appSlug] = [];
      result[appSlug].push({ title: r.categoryTitle, slug: r.categorySlug, position: r.position });
    }

    // Keep only leaf categories per app
    for (const appSlug of Object.keys(result)) {
      const cats = result[appSlug];
      if (cats.length > 1) {
        result[appSlug] = cats.filter(
          (cat) => !cats.some((other) => other.slug !== cat.slug && other.slug.startsWith(cat.slug + '-'))
        );
      }
    }

    return result;
  });

  // POST /api/apps/reverse-similar-counts — count how many apps list each slug as a similar app
  app.post("/reverse-similar-counts", async (request) => {
    const { slugs } = request.body as { slugs: string[] };
    if (!slugs?.length) return {};
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    // Look up app IDs from slugs (scoped to platform)
    const appLookup = await db
      .select({ id: apps.id, slug: apps.slug })
      .from(apps)
      .where(and(inArray(apps.slug, slugs), eq(apps.platform, platform)));
    const appSlugById = new Map(appLookup.map((a) => [a.id, a.slug]));
    const appIdList = appLookup.map((a) => a.id);

    if (appIdList.length === 0) return {};

    // Count distinct app_id per similar_app_id (how many apps recommend this app)
    const rows = await db
      .select({
        similarAppId: similarAppSightings.similarAppId,
        count: sql<number>`count(distinct ${similarAppSightings.appId})::int`,
      })
      .from(similarAppSightings)
      .where(inArray(similarAppSightings.similarAppId, appIdList))
      .groupBy(similarAppSightings.similarAppId);

    const result: Record<string, number> = {};
    for (const r of rows) {
      const slug = appSlugById.get(r.similarAppId) || '';
      result[slug] = r.count;
    }
    return result;
  });

  // POST /api/apps/featured-section-counts — count distinct featured sections per app (last 30 days)
  app.post("/featured-section-counts", async (request) => {
    const { slugs } = request.body as { slugs: string[] };
    if (!slugs?.length) return {};
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);

    // Look up app IDs from slugs (scoped to platform)
    const featAppLookup = await db
      .select({ id: apps.id, slug: apps.slug })
      .from(apps)
      .where(and(inArray(apps.slug, slugs), eq(apps.platform, platform)));
    const featSlugById = new Map(featAppLookup.map((a) => [a.id, a.slug]));
    const featAppIds = featAppLookup.map((a) => a.id);

    if (featAppIds.length === 0) return {};

    const rows = await db
      .select({
        appId: featuredAppSightings.appId,
        sectionCount: sql<number>`count(distinct ${featuredAppSightings.surface} || ':' || ${featuredAppSightings.surfaceDetail} || ':' || ${featuredAppSightings.sectionHandle})`,
      })
      .from(featuredAppSightings)
      .where(
        and(
          inArray(featuredAppSightings.appId, featAppIds),
          sql`${featuredAppSightings.seenDate} >= ${sinceStr}`
        )
      )
      .groupBy(featuredAppSightings.appId);

    const result: Record<string, number> = {};
    for (const r of rows) {
      const slug = featSlugById.get(r.appId) || '';
      result[slug] = r.sectionCount;
    }
    return result;
  });

  // POST /api/apps/ad-keyword-counts — count distinct ad keywords per app (last 30 days)
  app.post("/ad-keyword-counts", async (request) => {
    const { slugs } = request.body as { slugs: string[] };
    if (!slugs?.length) return {};
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);

    // Look up app IDs from slugs (scoped to platform)
    const adAppLookup = await db
      .select({ id: apps.id, slug: apps.slug })
      .from(apps)
      .where(and(inArray(apps.slug, slugs), eq(apps.platform, platform)));
    const adSlugById = new Map(adAppLookup.map((a) => [a.id, a.slug]));
    const adAppIds = adAppLookup.map((a) => a.id);

    if (adAppIds.length === 0) return {};

    const rows = await db
      .select({
        appId: keywordAdSightings.appId,
        keywordCount: sql<number>`count(distinct ${keywordAdSightings.keywordId})`,
      })
      .from(keywordAdSightings)
      .where(
        and(
          inArray(keywordAdSightings.appId, adAppIds),
          sql`${keywordAdSightings.seenDate} >= ${sinceStr}`
        )
      )
      .groupBy(keywordAdSightings.appId);

    const result: Record<string, number> = {};
    for (const r of rows) {
      const slug = adSlugById.get(r.appId) || '';
      result[slug] = r.keywordCount;
    }
    return result;
  });

  // POST /api/apps/review-velocity — bulk review velocity metrics from pre-computed table
  app.post("/review-velocity", async (request) => {
    const { slugs } = request.body as { slugs: string[] };
    if (!slugs?.length) return {};
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    // Get latest computed metrics per slug (graceful if table not yet migrated)
    const result: Record<string, { v7d: number | null; v30d: number | null; v90d: number | null; momentum: string | null }> = {};
    try {
      const rows: any[] = await db.execute(sql`
        SELECT DISTINCT ON (a.slug)
          a.slug AS app_slug, m.v7d, m.v30d, m.v90d, m.momentum
        FROM app_review_metrics m
        INNER JOIN apps a ON a.id = m.app_id
        WHERE a.slug IN (${sql.join(slugs.map(s => sql`${s}`), sql`, `)})
          AND a.platform = ${platform}
        ORDER BY a.slug, m.computed_at DESC
      `).then((res: any) => (res as any).rows ?? res);
      for (const r of rows) {
        result[r.app_slug] = {
          v7d: r.v7d,
          v30d: r.v30d,
          v90d: r.v90d,
          momentum: r.momentum,
        };
      }
    } catch { /* table may not exist yet */ }
    return result;
  });

  // GET /api/apps/search?q= — search all apps by name prefix
  app.get("/search", async (request) => {
    const { q = "" } = request.query as { q?: string };
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
    if (q.length < 1) return [];

    const rows = await db
      .select({
        slug: apps.slug,
        name: apps.name,
        iconUrl: apps.iconUrl,
        isBuiltForShopify: apps.isBuiltForShopify,
        averageRating: appSnapshots.averageRating,
        ratingCount: appSnapshots.ratingCount,
      })
      .from(apps)
      .leftJoin(
        appSnapshots,
        sql`${appSnapshots.appId} = ${apps.id}
          AND ${appSnapshots.id} = (
            SELECT s2.id FROM app_snapshots s2
            WHERE s2.app_id = "apps"."id"
            ORDER BY s2.scraped_at DESC LIMIT 1
          )`
      )
      .where(and(ilike(apps.name, `%${q}%`), eq(apps.platform, platform)))
      .orderBy(apps.name)
      .limit(20);

    return rows;
  });

  // GET /api/apps/developers — list all developers with app counts and contact info (system admin only)
  app.get("/developers", { preHandler: [requireSystemAdmin()] }, async (request) => {
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    // Platform-specific JSON paths for email/country
    const emailPath: Record<string, string> = {
      canva: "platform_data->>'developerEmail'",
      salesforce: "platform_data->'publisher'->>'email'",
      wix: "platform_data->>'developerEmail'",
      wordpress: "platform_data->>'homepage'",
    };
    const countryPath: Record<string, string> = {
      canva: "platform_data->'developerAddress'->>'country'",
      salesforce: "platform_data->'publisher'->>'country'",
    };

    const emailExpr = emailPath[platform] ? sql.raw(`s.${emailPath[platform]}`) : sql.raw("NULL");
    const countryExpr = countryPath[platform] ? sql.raw(`s.${countryPath[platform]}`) : sql.raw("NULL");

    const rows = await db.execute<{
      developer_name: string;
      app_count: number;
      email: string | null;
      country: string | null;
    }>(sql`
      SELECT
        s.developer->>'name' AS developer_name,
        COUNT(DISTINCT a.id)::int AS app_count,
        (ARRAY_AGG(${emailExpr}) FILTER (WHERE ${emailExpr} IS NOT NULL))[1] AS email,
        (ARRAY_AGG(${countryExpr}) FILTER (WHERE ${countryExpr} IS NOT NULL))[1] AS country
      FROM apps a
      INNER JOIN app_snapshots s ON s.app_id = a.id
      WHERE a.platform = ${platform}
        AND s.developer->>'name' IS NOT NULL
        AND s.developer->>'name' != ''
        AND s.id = (
          SELECT s2.id FROM app_snapshots s2
          WHERE s2.app_id = a.id
          ORDER BY s2.scraped_at DESC LIMIT 1
        )
      GROUP BY s.developer->>'name'
      ORDER BY app_count DESC, developer_name ASC
    `);

    return rows;
  });

  // GET /api/apps/by-developer?name= — list apps by developer name
  app.get("/by-developer", async (request) => {
    const { name = "" } = request.query as { name?: string };
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
    if (name.length < 1) return [];

    // Find apps whose latest snapshot has matching developer name
    const rows = await db
      .select({
        slug: apps.slug,
        name: apps.name,
        iconUrl: apps.iconUrl,
        isBuiltForShopify: apps.isBuiltForShopify,
        launchedDate: apps.launchedDate,
        averageRating: appSnapshots.averageRating,
        ratingCount: appSnapshots.ratingCount,
        pricing: appSnapshots.pricing,
        pricingPlans: appSnapshots.pricingPlans,
        developer: appSnapshots.developer,
        platformData: appSnapshots.platformData,
      })
      .from(apps)
      .innerJoin(appSnapshots, eq(appSnapshots.appId, apps.id))
      .where(
        and(
          sql`${appSnapshots.developer}->>'name' = ${name}
            AND ${appSnapshots.id} = (
              SELECT s2.id FROM app_snapshots s2
              WHERE s2.app_id = "apps"."id"
              ORDER BY s2.scraped_at DESC LIMIT 1
            )`,
          eq(apps.platform, platform)
        )
      )
      .orderBy(apps.name);

    // Extract developer contact info from the first app's platformData
    let developerInfo: Record<string, unknown> | null = null;
    if (rows.length > 0) {
      const pd = rows[0].platformData as Record<string, any> | undefined;
      if (pd) {
        if (platform === "canva") {
          const info: Record<string, unknown> = {};
          if (pd.developerEmail) info.email = pd.developerEmail;
          if (pd.developerPhone) info.phone = pd.developerPhone;
          if (pd.developerAddress) info.address = pd.developerAddress;
          if (pd.termsUrl) info.termsUrl = pd.termsUrl;
          if (pd.privacyUrl) info.privacyUrl = pd.privacyUrl;
          if (Object.keys(info).length > 0) developerInfo = info;
        } else if (platform === "salesforce" && pd.publisher) {
          const pub = pd.publisher as Record<string, any>;
          const info: Record<string, unknown> = {};
          if (pub.email) info.email = pub.email;
          if (pub.employees != null) info.employees = pub.employees;
          if (pub.yearFounded != null) info.yearFounded = pub.yearFounded;
          if (pub.location) info.location = pub.location;
          if (pub.country) info.country = pub.country;
          if (Object.keys(info).length > 0) developerInfo = info;
        } else if (platform === "wix") {
          const info: Record<string, unknown> = {};
          if (pd.developerEmail) info.email = pd.developerEmail;
          if (pd.developerPrivacyUrl) info.privacyUrl = pd.developerPrivacyUrl;
          if (Object.keys(info).length > 0) developerInfo = info;
        } else if (platform === "wordpress") {
          const info: Record<string, unknown> = {};
          if (pd.homepage) info.website = pd.homepage;
          if (pd.donateLink) info.donateLink = pd.donateLink;
          if (Object.keys(info).length > 0) developerInfo = info;
        }
      }
    }

    const appRows = rows.map((r) => {
      const minPaidPrice = getMinPaidPrice(r.pricingPlans);
      const { pricingPlans: _, platformData: _pd, ...rest } = r;
      return { ...rest, minPaidPrice };
    });

    return { apps: appRows, developerInfo };
  });

  // GET /api/apps/:slug/membership — which tracked apps and research projects contain this app as competitor
  app.get<{ Params: { slug: string } }>(
    "/:slug/membership",
    async (request, reply) => {
      const { slug } = request.params;
      const { accountId } = request.user;
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const [appRow] = await db
        .select({ id: apps.id, slug: apps.slug })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);

      if (!appRow) {
        return reply.code(404).send({ error: "App not found" });
      }

      const [competitorRows, projectRows] = await Promise.all([
        db
          .select({
            trackedAppSlug: apps.slug,
            appName: apps.name,
          })
          .from(accountCompetitorApps)
          .innerJoin(apps, eq(apps.id, accountCompetitorApps.trackedAppId))
          .where(
            and(
              eq(accountCompetitorApps.accountId, accountId),
              eq(accountCompetitorApps.competitorAppId, appRow.id)
            )
          ),
        db
          .select({
            projectId: researchProjectCompetitors.researchProjectId,
            projectName: researchProjects.name,
          })
          .from(researchProjectCompetitors)
          .innerJoin(
            researchProjects,
            eq(researchProjects.id, researchProjectCompetitors.researchProjectId)
          )
          .where(
            and(
              eq(researchProjects.accountId, accountId),
              eq(researchProjectCompetitors.appId, appRow.id)
            )
          ),
      ]);

      return {
        competitorForApps: competitorRows.map((r) => r.trackedAppSlug),
        researchProjectIds: projectRows.map((r) => r.projectId),
        competitorForAppNames: competitorRows.map((r) => ({ slug: r.trackedAppSlug, name: r.appName })),
        researchProjects: projectRows.map((r) => ({ id: r.projectId, name: r.projectName })),
      };
    }
  );

  // GET /api/apps/:slug — app detail + latest snapshot + track status
  app.get<{ Params: { slug: string } }>("/:slug", async (request, reply) => {
    const { slug } = request.params;
    const { accountId } = request.user;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    const [appRow] = await db
      .select()
      .from(apps)
      .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
      .limit(1);

    if (!appRow) {
      return reply.code(404).send({ error: "App not found" });
    }

    const [latestSnapshot] = await db
      .select()
      .from(appSnapshots)
      .where(eq(appSnapshots.appId, appRow.id))
      .orderBy(desc(appSnapshots.scrapedAt))
      .limit(1);

    const [tracked] = await db
      .select({ appId: accountTrackedApps.appId })
      .from(accountTrackedApps)
      .where(
        and(
          eq(accountTrackedApps.accountId, accountId),
          eq(accountTrackedApps.appId, appRow.id)
        )
      );

    let competitorForApps: string[] = [];
    try {
      const competitorLinks = await db
        .select({ trackedAppSlug: apps.slug })
        .from(accountCompetitorApps)
        .innerJoin(apps, eq(apps.id, accountCompetitorApps.trackedAppId))
        .where(
          and(
            eq(accountCompetitorApps.accountId, accountId),
            eq(accountCompetitorApps.competitorAppId, appRow.id)
          )
        );
      competitorForApps = competitorLinks.map((r) => r.trackedAppSlug);
    } catch {
      // Column may not exist if migration 0022 hasn't been applied yet
    }

    return {
      ...appRow,
      latestSnapshot: latestSnapshot || null,
      isTrackedByAccount: !!tracked,
      isCompetitor: competitorForApps.length > 0,
      competitorForApps,
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
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const [appRow] = await db
        .select()
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);

      if (!appRow) {
        return reply.code(404).send({ error: "App not found" });
      }

      const snapshots = await db
        .select()
        .from(appSnapshots)
        .where(eq(appSnapshots.appId, appRow.id))
        .orderBy(desc(appSnapshots.scrapedAt))
        .limit(parseInt(limit, 10))
        .offset(parseInt(offset, 10));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(appSnapshots)
        .where(eq(appSnapshots.appId, appRow.id));

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
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const [appRow] = await db
        .select()
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
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
        .where(eq(reviews.appId, appRow.id))
        .orderBy(orderBy)
        .limit(parseInt(limit, 10))
        .offset(parseInt(offset, 10));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviews)
        .where(eq(reviews.appId, appRow.id));

      const [{ withContentCount }] = await db
        .select({ withContentCount: sql<number>`count(*)::int` })
        .from(reviews)
        .where(and(eq(reviews.appId, appRow.id), sql`content != ''`));

      // Rating distribution
      const distribution = await db
        .select({
          rating: reviews.rating,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(eq(reviews.appId, appRow.id))
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
      const { accountId } = request.user;
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const [appRow] = await db
        .select()
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
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
          and(eq(categories.slug, appCategoryRankings.categorySlug), eq(categories.platform, platform))
        )
        .where(
          and(
            eq(appCategoryRankings.appId, appRow.id),
            sql`${appCategoryRankings.scrapedAt} >= ${sinceStr}`,
            eq(categories.isListingPage, true),
            sql`${appCategoryRankings.position} > 0`
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

      // Get keyword IDs linked to this app for this account
      const linkedKeywordRows = await db
        .select({ keywordId: accountTrackedKeywords.keywordId })
        .from(accountTrackedKeywords)
        .where(
          and(
            eq(accountTrackedKeywords.accountId, accountId),
            eq(accountTrackedKeywords.trackedAppId, appRow.id)
          )
        );
      const linkedKeywordIds = linkedKeywordRows.map((r) => r.keywordId);

      let keywordRankings: any[] = [];
      if (linkedKeywordIds.length > 0) {
        keywordRankings = await db
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
              eq(appKeywordRankings.appId, appRow.id),
              inArray(appKeywordRankings.keywordId, linkedKeywordIds),
              sql`${appKeywordRankings.scrapedAt} >= ${sinceStr}`
            )
          )
          .orderBy(appKeywordRankings.scrapedAt);
      }

      const sinceDateStr = since.toISOString().slice(0, 10);
      let keywordAds: any[] = [];
      if (linkedKeywordIds.length > 0) {
        keywordAds = await db
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
              eq(keywordAdSightings.appId, appRow.id),
              inArray(keywordAdSightings.keywordId, linkedKeywordIds),
              sql`${keywordAdSightings.seenDate} >= ${sinceDateStr}`
            )
          )
          .orderBy(desc(keywordAdSightings.seenDate));
      }

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
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
      const maxLimit = Math.min(parseInt(limit, 10) || 50, 200);

      // Look up app ID (scoped to platform)
      const [changeApp] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);

      if (!changeApp) return [];

      return db
        .select()
        .from(appFieldChanges)
        .where(eq(appFieldChanges.appId, changeApp.id))
        .orderBy(desc(appFieldChanges.detectedAt))
        .limit(maxLimit);
    }
  );

  // GET /api/apps/:slug/similar-apps — direct, reverse, 2nd degree similar apps
  app.get<{ Params: { slug: string } }>(
    "/:slug/similar-apps",
    async (request, reply) => {
      const { slug } = request.params;
      const { days = "30" } = request.query as { days?: string };
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const [appRow] = await db
        .select({ id: apps.id, slug: apps.slug, name: apps.name, iconUrl: apps.iconUrl })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);

      if (!appRow) {
        return reply.code(404).send({ error: "App not found" });
      }

      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      const sinceStr = since.toISOString().slice(0, 10);

      // DIRECT: apps in this app's "More apps like this"
      const direct = await db
        .select({
          slug: apps.slug,
          name: apps.name,
          iconUrl: apps.iconUrl,
          seenDate: similarAppSightings.seenDate,
          timesSeenInDay: similarAppSightings.timesSeenInDay,
          position: similarAppSightings.position,
        })
        .from(similarAppSightings)
        .innerJoin(apps, eq(apps.id, similarAppSightings.similarAppId))
        .where(
          and(
            eq(similarAppSightings.appId, appRow.id),
            sql`${similarAppSightings.seenDate} >= ${sinceStr}`
          )
        )
        .orderBy(desc(similarAppSightings.seenDate));

      // REVERSE: apps that list THIS app as similar
      const reverse = await db
        .select({
          slug: apps.slug,
          name: apps.name,
          iconUrl: apps.iconUrl,
          seenDate: similarAppSightings.seenDate,
          timesSeenInDay: similarAppSightings.timesSeenInDay,
          position: similarAppSightings.position,
        })
        .from(similarAppSightings)
        .innerJoin(apps, eq(apps.id, similarAppSightings.appId))
        .where(
          and(
            eq(similarAppSightings.similarAppId, appRow.id),
            sql`${similarAppSightings.seenDate} >= ${sinceStr}`
          )
        )
        .orderBy(desc(similarAppSightings.seenDate));

      // 2ND DEGREE: similar apps of direct similar apps (excluding self + directs)
      const directSlugs = [...new Set(direct.map((d) => d.slug))];
      let secondDegree: typeof direct = [];

      if (directSlugs.length > 0) {
        // Look up IDs for direct slugs
        const directAppRows = await db
          .select({ id: apps.id })
          .from(apps)
          .where(inArray(apps.slug, directSlugs));
        const directAppIds = directAppRows.map((a) => a.id);

        // Exclude self + directs
        const excludeIds = [appRow.id, ...directAppIds];
        secondDegree = await db
          .select({
            slug: apps.slug,
            name: apps.name,
            iconUrl: apps.iconUrl,
            seenDate: similarAppSightings.seenDate,
            timesSeenInDay: similarAppSightings.timesSeenInDay,
            position: similarAppSightings.position,
          })
          .from(similarAppSightings)
          .innerJoin(apps, eq(apps.id, similarAppSightings.similarAppId))
          .where(
            and(
              inArray(similarAppSightings.appId, directAppIds),
              sql`${similarAppSightings.seenDate} >= ${sinceStr}`,
              sql`${similarAppSightings.similarAppId} NOT IN (${sql.join(
                excludeIds.map((id) => sql`${id}`),
                sql`, `
              )})`
            )
          )
          .orderBy(desc(similarAppSightings.seenDate));
      }

      return { app: appRow, direct, reverse, secondDegree };
    }
  );

  // GET /api/apps/:slug/featured-placements — where is this app featured
  app.get<{ Params: { slug: string } }>(
    "/:slug/featured-placements",
    async (request, reply) => {
      const { slug } = request.params;
      const { days = "30" } = request.query as { days?: string };
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      const sinceStr = since.toISOString().slice(0, 10);

      // Look up app ID (scoped to platform)
      const [featApp] = await db.select({ id: apps.id }).from(apps).where(and(eq(apps.slug, slug), eq(apps.platform, platform))).limit(1);
      if (!featApp) return { sightings: [] };

      const sightings = await db
        .select({
          surface: featuredAppSightings.surface,
          surfaceDetail: featuredAppSightings.surfaceDetail,
          sectionHandle: featuredAppSightings.sectionHandle,
          sectionTitle: featuredAppSightings.sectionTitle,
          position: featuredAppSightings.position,
          seenDate: featuredAppSightings.seenDate,
          timesSeenInDay: featuredAppSightings.timesSeenInDay,
        })
        .from(featuredAppSightings)
        .where(
          and(
            eq(featuredAppSightings.appId, featApp.id),
            sql`${featuredAppSightings.seenDate} >= ${sinceStr}`
          )
        )
        .orderBy(desc(featuredAppSightings.seenDate));

      return { sightings };
    }
  );

  // GET /api/apps/:slug/ad-sightings — which keywords is this app advertising on
  app.get<{ Params: { slug: string } }>(
    "/:slug/ad-sightings",
    async (request, reply) => {
      const { slug } = request.params;
      const { days = "30" } = request.query as { days?: string };
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      const sinceStr = since.toISOString().slice(0, 10);

      // Look up app ID (scoped to platform)
      const [adApp] = await db.select({ id: apps.id }).from(apps).where(and(eq(apps.slug, slug), eq(apps.platform, platform))).limit(1);
      if (!adApp) return { sightings: [] };

      const sightings = await db
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
            eq(keywordAdSightings.appId, adApp.id),
            sql`${keywordAdSightings.seenDate} >= ${sinceStr}`
          )
        )
        .orderBy(desc(keywordAdSightings.seenDate));

      return { sightings };
    }
  );

  // GET /api/apps/:slug/category-ad-sightings — which categories is this app advertising in
  app.get<{ Params: { slug: string } }>(
    "/:slug/category-ad-sightings",
    async (request, reply) => {
      const { slug } = request.params;
      const { days = "30" } = request.query as { days?: string };
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      const sinceStr = since.toISOString().slice(0, 10);

      // Look up app ID (scoped to platform)
      const [catAdApp] = await db.select({ id: apps.id }).from(apps).where(and(eq(apps.slug, slug), eq(apps.platform, platform))).limit(1);
      if (!catAdApp) return { sightings: [] };

      const sightings = await db
        .select({
          categorySlug: categories.slug,
          categoryTitle: categories.title,
          seenDate: categoryAdSightings.seenDate,
          timesSeenInDay: categoryAdSightings.timesSeenInDay,
        })
        .from(categoryAdSightings)
        .innerJoin(
          categories,
          eq(categoryAdSightings.categoryId, categories.id)
        )
        .where(
          and(
            eq(categoryAdSightings.appId, catAdApp.id),
            sql`${categoryAdSightings.seenDate} >= ${sinceStr}`
          )
        )
        .orderBy(desc(categoryAdSightings.seenDate));

      return { sightings };
    }
  );

  // GET /api/apps/:slug/scores — latest visibility + power scores for an app
  app.get("/:slug/scores", async (request) => {
    const { slug } = request.params as { slug: string };
    const { accountId } = request.user;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    // Look up app ID (scoped to platform)
    const [scoreApp] = await db.select({ id: apps.id }).from(apps).where(and(eq(apps.slug, slug), eq(apps.platform, platform))).limit(1);
    if (!scoreApp) return { visibility: [], power: [], weightedPowerScore: 0 };

    // Visibility: account-scoped, grouped by trackedAppId
    const visRows = await db
      .select()
      .from(appVisibilityScores)
      .where(
        and(
          eq(appVisibilityScores.appId, scoreApp.id),
          eq(appVisibilityScores.accountId, accountId),
        )
      )
      .orderBy(desc(appVisibilityScores.computedAt))
      .limit(50);

    // Group by trackedAppId, take latest per trackedApp, resolve to slug
    const visByTrackedApp = new Map<number, typeof visRows[0]>();
    for (const r of visRows) {
      if (!visByTrackedApp.has(r.trackedAppId)) {
        visByTrackedApp.set(r.trackedAppId, r);
      }
    }

    // Resolve trackedAppIds to slugs
    const trackedAppIds = [...visByTrackedApp.keys()];
    const trackedAppSlugMap = new Map<number, string>();
    if (trackedAppIds.length > 0) {
      const trackedAppRows = await db
        .select({ id: apps.id, slug: apps.slug })
        .from(apps)
        .where(inArray(apps.id, trackedAppIds));
      for (const a of trackedAppRows) {
        trackedAppSlugMap.set(a.id, a.slug);
      }
    }

    const visibility = [...visByTrackedApp.entries()].map(([trackedAppId, r]) => ({
      trackedAppSlug: trackedAppSlugMap.get(trackedAppId) || '',
      visibilityScore: r.visibilityScore,
      visibilityRaw: r.visibilityRaw,
      keywordCount: r.keywordCount,
      computedAt: r.computedAt,
    }));

    // Power: category-based (leaf categories), grouped by categorySlug
    const powRows = await db
      .select({
        id: appPowerScores.id,
        appId: appPowerScores.appId,
        categorySlug: appPowerScores.categorySlug,
        computedAt: appPowerScores.computedAt,
        ratingScore: appPowerScores.ratingScore,
        reviewScore: appPowerScores.reviewScore,
        categoryScore: appPowerScores.categoryScore,
        momentumScore: appPowerScores.momentumScore,
        powerRaw: appPowerScores.powerRaw,
        powerScore: appPowerScores.powerScore,
        categoryTitle: categories.title,
      })
      .from(appPowerScores)
      .innerJoin(categories, and(eq(categories.slug, appPowerScores.categorySlug), eq(categories.platform, platform)))
      .where(and(eq(appPowerScores.appId, scoreApp.id), eq(categories.isListingPage, true)))
      .orderBy(desc(appPowerScores.computedAt))
      .limit(50);

    // Group by category, take latest per category
    const powByCategory = new Map<string, typeof powRows[0]>();
    for (const r of powRows) {
      if (!powByCategory.has(r.categorySlug)) {
        powByCategory.set(r.categorySlug, r);
      }
    }

    // Get appCount + rank position per category
    const catSlugs = [...powByCategory.keys()];
    const catSizeMap = new Map<string, number>();
    const catPositionMap = new Map<string, number>();
    if (catSlugs.length > 0) {
      const catSizeRows: { category_slug: string; app_count: number }[] = await db
        .execute(
          sql`
          SELECT DISTINCT ON (category_slug)
            category_slug, app_count
          FROM category_snapshots
          WHERE category_slug IN (${sql.join(catSlugs.map((s) => sql`${s}`), sql`, `)})
            AND app_count IS NOT NULL
          ORDER BY category_slug, scraped_at DESC
        `
        )
        .then((res: any) => (res as any).rows ?? res);

      for (const r of catSizeRows) {
        catSizeMap.set(r.category_slug, r.app_count);
      }

      // Fetch latest category ranking position for this app
      const rankRows: { category_slug: string; position: number }[] = await db
        .execute(
          sql`
          SELECT DISTINCT ON (category_slug)
            category_slug, position
          FROM app_category_rankings
          WHERE app_id = ${scoreApp.id}
            AND category_slug IN (${sql.join(catSlugs.map((s) => sql`${s}`), sql`, `)})
            AND position IS NOT NULL
          ORDER BY category_slug, scraped_at DESC
        `
        )
        .then((res: any) => (res as any).rows ?? res);

      for (const r of rankRows) {
        catPositionMap.set(r.category_slug, r.position);
      }
    }

    const power = [...powByCategory.entries()].map(([categorySlug, r]) => ({
      categorySlug,
      categoryTitle: r.categoryTitle,
      powerScore: r.powerScore,
      powerRaw: r.powerRaw,
      ratingScore: r.ratingScore,
      reviewScore: r.reviewScore,
      categoryScore: r.categoryScore,
      momentumScore: r.momentumScore,
      computedAt: r.computedAt,
      position: catPositionMap.get(categorySlug) ?? null,
      totalApps: catSizeMap.get(categorySlug) ?? null,
    }));

    // Compute weighted power score
    let weightedPowerScore = 0;
    if (power.length > 0) {
      const inputs = power.map((p) => ({
        powerScore: p.powerScore,
        appCount: catSizeMap.get(p.categorySlug) || 1,
      }));

      weightedPowerScore = computeWeightedPowerScore(inputs);
    }

    return { visibility, power, weightedPowerScore };
  });

  // GET /api/apps/:slug/scores/history — historical score data for trend charts
  // ?trackedApp=slug for visibility history, ?category=slug for power history
  app.get("/:slug/scores/history", async (request) => {
    const { slug } = request.params as { slug: string };
    const { days = "30", category, trackedApp } = request.query as {
      days?: string;
      category?: string;
      trackedApp?: string;
    };
    const { accountId } = request.user;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
    const daysNum = Math.min(parseInt(days) || 30, 90);
    const sinceStr = new Date(Date.now() - daysNum * 86400000).toISOString().slice(0, 10);

    // Look up app ID (scoped to platform)
    const [histApp] = await db.select({ id: apps.id }).from(apps).where(and(eq(apps.slug, slug), eq(apps.platform, platform))).limit(1);
    if (!histApp) return { visibility: [], power: [] };

    // Visibility history: requires trackedApp param, scoped to account
    let visibility: any[] = [];
    if (trackedApp) {
      // Look up trackedApp ID (scoped to platform)
      const [trackedAppRow] = await db.select({ id: apps.id }).from(apps).where(and(eq(apps.slug, trackedApp), eq(apps.platform, platform))).limit(1);
      if (trackedAppRow) {
        visibility = await db
          .select()
          .from(appVisibilityScores)
          .where(
            and(
              eq(appVisibilityScores.appId, histApp.id),
              eq(appVisibilityScores.accountId, accountId),
              eq(appVisibilityScores.trackedAppId, trackedAppRow.id),
              sql`${appVisibilityScores.computedAt} >= ${sinceStr}`,
            )
          )
          .orderBy(appVisibilityScores.computedAt);
      }
    }

    // Power history: by category
    const powConditions = [
      eq(appPowerScores.appId, histApp.id),
      sql`${appPowerScores.computedAt} >= ${sinceStr}`,
    ];
    if (category) powConditions.push(eq(appPowerScores.categorySlug, category));

    const power = await db
      .select()
      .from(appPowerScores)
      .where(and(...powConditions))
      .orderBy(appPowerScores.computedAt);

    return { visibility, power };
  });
};
