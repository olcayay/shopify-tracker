import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and, inArray, ilike } from "drizzle-orm";
import { computeWeightedPowerScore, validatePlatformData, createLogger, PLATFORMS } from "@appranks/shared";
import { slugsBodySchema } from "../schemas/apps.js";
import { getPlatformFromQuery } from "../utils/platform.js";
import { requireSystemAdmin } from "../middleware/authorize.js";
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from "../constants.js";
import { cacheGet } from "../utils/cache.js";

// PLA-1069: per-account+platform tracked-apps overview is expensive (multiple
// DISTINCT ON scans on app_keyword_rankings / app_snapshots / app_field_changes).
// Short TTL absorbs the page-load thundering herd and rapid client refetches
// without needing strict invalidation on every track/keyword toggle.
const TRACKED_APPS_OVERVIEW_TTL_S = 30;
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
  sqlArray,
} from "@appranks/db";

const log = createLogger("api-apps");

function getMinPaidPrice(plans: any[] | null | undefined): number | null {
  if (!plans || plans.length === 0) return null;
  const prices = plans
    .filter((p: any) => p.price != null && parseFloat(p.price) > 0)
    .map((p: any) => parseFloat(p.price));
  return prices.length > 0 ? Math.min(...prices) : 0;
}

export const appRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/apps — list account's tracked apps with latest snapshot summary
  app.get("/", async (request) => {
    const { accountId } = request.user;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    return cacheGet(`apps:overview:${accountId}:${platform}`, () => buildTrackedAppsOverview(accountId, platform), TRACKED_APPS_OVERVIEW_TTL_S);
  });

  async function buildTrackedAppsOverview(accountId: string, platform: string) {
    // Get tracked app IDs, competitor counts, and keyword counts in parallel
    const [trackedRows, competitorCounts, keywordCounts] = await Promise.all([
      db.select({ appId: accountTrackedApps.appId })
        .from(accountTrackedApps)
        .where(eq(accountTrackedApps.accountId, accountId)),
      db.select({
        trackedAppId: accountCompetitorApps.trackedAppId,
        count: sql<number>`count(*)::int`,
      })
        .from(accountCompetitorApps)
        .where(eq(accountCompetitorApps.accountId, accountId))
        .groupBy(accountCompetitorApps.trackedAppId),
      db.select({
        trackedAppId: accountTrackedKeywords.trackedAppId,
        count: sql<number>`count(*)::int`,
      })
        .from(accountTrackedKeywords)
        .where(eq(accountTrackedKeywords.accountId, accountId))
        .groupBy(accountTrackedKeywords.trackedAppId),
    ]);

    if (trackedRows.length === 0) {
      return [];
    }

    const appIds = trackedRows.map((r) => r.appId);

    // Fetch apps and keyword associations in parallel (independent queries)
    const [rows, allKeywordRows] = await Promise.all([
      db.select()
        .from(apps)
        .where(and(inArray(apps.id, appIds), eq(apps.platform, platform)))
        .orderBy(apps.name),
      db.select({
        trackedAppId: accountTrackedKeywords.trackedAppId,
        keywordId: accountTrackedKeywords.keywordId,
      })
        .from(accountTrackedKeywords)
        .where(eq(accountTrackedKeywords.accountId, accountId)),
    ]);

    const compCountMap = new Map(competitorCounts.map((r) => [r.trackedAppId, r.count]));
    const kwCountMap = new Map(keywordCounts.map((r) => [r.trackedAppId, r.count]));

    // Get ranked keyword counts per tracked app (single batched query)
    const rankedKwMap = new Map<number, number>();

    if (allKeywordRows.length > 0) {
      const kwByApp = new Map<number, number[]>();
      for (const row of allKeywordRows) {
        if (row.trackedAppId == null) continue; // Skip research-mode keywords (no app)
        const arr = kwByApp.get(row.trackedAppId) ?? [];
        arr.push(row.keywordId);
        kwByApp.set(row.trackedAppId, arr);
      }

      // Build a single query for all tracked apps at once
      const allTrackedAppIds = [...kwByApp.keys()];
      const allKeywordIds = [...new Set(
        allKeywordRows.filter((r) => r.trackedAppId != null).map((r) => r.keywordId),
      )];

      // Skip query if no app-bound keywords (all research-mode)
      if (allTrackedAppIds.length === 0 || allKeywordIds.length === 0) {
        // No ranked keyword data to fetch
      } else {
      const appIdList = sql.join(allTrackedAppIds.map((id) => sql`${id}`), sql`,`);
      const kwIdList = sql.join(allKeywordIds.map((id) => sql`${id}`), sql`,`);

      const rankedRows = await db.execute(sql`
        SELECT app_id, COUNT(DISTINCT keyword_id)::int AS cnt
        FROM (
          SELECT DISTINCT ON (app_id, keyword_id) app_id, keyword_id, position
          FROM app_keyword_rankings
          WHERE app_id IN (${appIdList})
            AND keyword_id IN (${kwIdList})
          ORDER BY app_id, keyword_id, scraped_at DESC
        ) latest
        WHERE position IS NOT NULL
        GROUP BY app_id
      `);
      const rankedData: any[] = (rankedRows as any).rows ?? rankedRows;
      for (const row of rankedData) {
        rankedKwMap.set(row.app_id, row.cnt);
      }
      } // end else (app-bound keywords exist)
    }

    // Get latest snapshots and changes in batch (2 queries instead of 2*N)
    const appIds2 = rows.map((r) => r.id);

    if (appIds2.length === 0) {
      return [];
    }

    const [latestSnapshots, latestChanges] = await Promise.all([
      db.execute(sql`
        SELECT DISTINCT ON (app_id) app_id, average_rating, rating_count, pricing, pricing_plans, categories, scraped_at
        FROM app_snapshots
        WHERE app_id IN (${sql.join(appIds2.map((id) => sql`${id}`), sql`,`)})
        ORDER BY app_id, scraped_at DESC
      `),
      db.execute(sql`
        SELECT DISTINCT ON (afc.app_id) afc.app_id, afc.detected_at
        FROM app_field_changes afc
        WHERE afc.app_id IN (${sql.join(appIds2.map((id) => sql`${id}`), sql`,`)})
          AND NOT EXISTS (
            SELECT 1 FROM app_update_label_assignments ula
            JOIN app_update_labels aul ON aul.id = ula.label_id
            WHERE ula.change_id = afc.id AND aul.is_dismissal = TRUE
          )
        ORDER BY afc.app_id, afc.detected_at DESC
      `),
    ]);

    const snapshotData: any[] = (latestSnapshots as any).rows ?? latestSnapshots;
    const changeData: any[] = (latestChanges as any).rows ?? latestChanges;

    const snapshotMap = new Map(snapshotData.map((s: any) => [s.app_id, s]));
    const changeMap = new Map(changeData.map((c: any) => [c.app_id, c]));

    const result = rows.map((appRow) => {
      const snapshot = snapshotMap.get(appRow.id);
      const change = changeMap.get(appRow.id);
      const minPaidPrice = getMinPaidPrice(snapshot?.pricing_plans);

      return {
        ...appRow,
        latestSnapshot: snapshot
          ? {
              averageRating: snapshot.average_rating,
              ratingCount: snapshot.rating_count,
              pricing: snapshot.pricing,
              categories: snapshot.categories || [],
              scrapedAt: snapshot.scraped_at,
            }
          : null,
        minPaidPrice,
        lastChangeAt: change?.detected_at || null,
        competitorCount: compCountMap.get(appRow.id) ?? 0,
        keywordCount: kwCountMap.get(appRow.id) ?? 0,
        rankedKeywordCount: rankedKwMap.get(appRow.id) ?? 0,
      };
    });

    return result;
  }

  // POST /api/apps/last-changes — bulk lookup lastChangeAt for multiple apps
  app.post("/last-changes", async (request) => {
    const { slugs } = slugsBodySchema.parse(request.body);
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
    const { slugs } = slugsBodySchema.parse(request.body);
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    // Use DISTINCT ON instead of correlated subquery for latest snapshot
    const rows: any[] = await db.execute(sql`
      SELECT a.slug AS app_slug, s.pricing_plans
      FROM (
        SELECT DISTINCT ON (app_id) app_id, pricing_plans
        FROM app_snapshots
        ORDER BY app_id, scraped_at DESC
      ) s
      INNER JOIN apps a ON a.id = s.app_id
      WHERE a.slug = ANY(${sqlArray(slugs)})
        AND a.platform = ${platform}
    `);

    const data = (rows as any).rows ?? rows;
    const result: Record<string, number | null> = {};
    for (const r of data) {
      result[r.app_slug] = getMinPaidPrice(r.pricing_plans);
    }
    return result;
  });

  // POST /api/apps/launched-dates — bulk lookup launchedDate for multiple apps
  app.post("/launched-dates", async (request) => {
    const { slugs } = slugsBodySchema.parse(request.body);
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
    const { slugs } = slugsBodySchema.parse(request.body);
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
    const { slugs } = slugsBodySchema.parse(request.body);
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
    const { slugs } = slugsBodySchema.parse(request.body);
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
    const { slugs } = slugsBodySchema.parse(request.body);
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
    const { slugs } = slugsBodySchema.parse(request.body);
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    // Get latest computed metrics per slug (graceful if table not yet migrated)
    const result: Record<string, { v7d: number | null; v30d: number | null; v90d: number | null; momentum: string | null }> = {};
    try {
      const rows: any[] = await db.execute(sql`
        SELECT DISTINCT ON (a.slug)
          a.slug AS app_slug, m.v7d, m.v30d, m.v90d, m.momentum
        FROM app_review_metrics m
        INNER JOIN apps a ON a.id = m.app_id
        WHERE a.slug IN (${sql.join(slugs.map((s: string) => sql`${s}`), sql`, `)})
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

    // Use DISTINCT ON in subquery instead of correlated subquery for latest snapshot
    const rows: any[] = await db.execute(sql`
      SELECT a.slug, a.name, a.icon_url AS "iconUrl", a.is_built_for_shopify AS "isBuiltForShopify",
             s.average_rating AS "averageRating", s.rating_count AS "ratingCount"
      FROM apps a
      LEFT JOIN (
        SELECT DISTINCT ON (app_id) app_id, average_rating, rating_count
        FROM app_snapshots
        ORDER BY app_id, scraped_at DESC
      ) s ON s.app_id = a.id
      WHERE a.name ILIKE ${`%${q}%`}
        AND a.platform = ${platform}
      ORDER BY a.name
      LIMIT 20
    `);

    return (rows as any).rows ?? rows;
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
      google_workspace: "platform_data->>'developerWebsite'",
      zoho: "COALESCE(platform_data->'partnerDetails'->0->>'supportEmail', NULL)",
      zendesk: "platform_data->>'authorUrl'",
      atlassian: "platform_data->>'supportEmail'",
      hubspot: "platform_data->>'developerWebsite'",
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
      WITH latest AS (
        SELECT DISTINCT ON (s.app_id) s.app_id, s.developer, s.platform_data
        FROM app_snapshots s
        INNER JOIN apps a ON a.id = s.app_id
        WHERE a.platform = ${platform}
        ORDER BY s.app_id, s.scraped_at DESC
      )
      SELECT
        s.developer->>'name' AS developer_name,
        COUNT(DISTINCT a.id)::int AS app_count,
        (ARRAY_AGG(${emailExpr}) FILTER (WHERE ${emailExpr} IS NOT NULL))[1] AS email,
        (ARRAY_AGG(${countryExpr}) FILTER (WHERE ${countryExpr} IS NOT NULL))[1] AS country
      FROM apps a
      INNER JOIN latest s ON s.app_id = a.id
      WHERE s.developer->>'name' IS NOT NULL
        AND s.developer->>'name' != ''
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

    // Find apps whose latest snapshot has matching developer name (DISTINCT ON instead of correlated subquery)
    const rows: any[] = await db.execute(sql`
      SELECT a.slug, a.name, a.icon_url AS "iconUrl",
             a.is_built_for_shopify AS "isBuiltForShopify",
             a.launched_date AS "launchedDate",
             s.average_rating AS "averageRating", s.rating_count AS "ratingCount",
             s.pricing, s.pricing_plans AS "pricingPlans",
             s.developer, s.platform_data AS "platformData"
      FROM apps a
      INNER JOIN (
        SELECT DISTINCT ON (app_id)
          app_id, average_rating, rating_count, pricing, pricing_plans, developer, platform_data
        FROM app_snapshots
        ORDER BY app_id, scraped_at DESC
      ) s ON s.app_id = a.id
      WHERE s.developer->>'name' = ${name}
        AND a.platform = ${platform}
      ORDER BY a.name
    `);
    const byDevRows = (rows as any).rows ?? rows;

    // Extract developer contact info from the first app's platformData
    let developerInfo: Record<string, unknown> | null = null;
    if (byDevRows.length > 0) {
      const pd = byDevRows[0].platformData as Record<string, any> | undefined;
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
        } else if (platform === "zendesk") {
          const info: Record<string, unknown> = {};
          if (pd.authorUrl) info.website = pd.authorUrl;
          if (Object.keys(info).length > 0) developerInfo = info;
        } else if (platform === "atlassian") {
          const info: Record<string, unknown> = {};
          if (pd.supportEmail) info.email = pd.supportEmail;
          if (pd.supportUrl) info.website = pd.supportUrl;
          if (pd.supportPhone) info.phone = pd.supportPhone;
          if (Object.keys(info).length > 0) developerInfo = info;
        } else if (platform === "google_workspace") {
          const info: Record<string, unknown> = {};
          if (pd.developerWebsite) info.website = pd.developerWebsite;
          if (pd.supportUrl) info.supportUrl = pd.supportUrl;
          if (pd.termsOfServiceUrl) info.termsUrl = pd.termsOfServiceUrl;
          if (pd.privacyPolicyUrl) info.privacyUrl = pd.privacyPolicyUrl;
          if (Object.keys(info).length > 0) developerInfo = info;
        } else if (platform === "zoom") {
          const info: Record<string, unknown> = {};
          if (pd.companyName) info.company = pd.companyName;
          if (Object.keys(info).length > 0) developerInfo = info;
        } else if (platform === "zoho") {
          const info: Record<string, unknown> = {};
          const partner = Array.isArray(pd.partnerDetails) ? pd.partnerDetails[0] : null;
          if (partner?.supportEmail) info.email = partner.supportEmail;
          if (partner?.website) info.website = partner.website;
          if (Object.keys(info).length > 0) developerInfo = info;
        } else if (platform === "hubspot") {
          const info: Record<string, unknown> = {};
          if (pd.developerWebsite) info.website = pd.developerWebsite;
          if (Object.keys(info).length > 0) developerInfo = info;
        }
      }
    }

    const appRows = byDevRows.map((r: any) => {
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

    const [latestSnapshotResult, trackedResult, competitorLinksResult] =
      await Promise.all([
        db
          .select()
          .from(appSnapshots)
          .where(eq(appSnapshots.appId, appRow.id))
          .orderBy(desc(appSnapshots.scrapedAt))
          .limit(1),
        db
          .select({ appId: accountTrackedApps.appId })
          .from(accountTrackedApps)
          .where(
            and(
              eq(accountTrackedApps.accountId, accountId),
              eq(accountTrackedApps.appId, appRow.id)
            )
          ),
        (async () => {
          try {
            return await db
              .select({ trackedAppSlug: apps.slug })
              .from(accountCompetitorApps)
              .innerJoin(apps, eq(apps.id, accountCompetitorApps.trackedAppId))
              .where(
                and(
                  eq(accountCompetitorApps.accountId, accountId),
                  eq(accountCompetitorApps.competitorAppId, appRow.id)
                )
              );
          } catch {
            // Column may not exist if migration 0022 hasn't been applied yet
            return [] as { trackedAppSlug: string }[];
          }
        })(),
      ]);

    const [latestSnapshot] = latestSnapshotResult;
    const [tracked] = trackedResult;
    const competitorForApps = competitorLinksResult.map((r) => r.trackedAppSlug);

    // Validate platformData against Zod schema (non-blocking, warn only)
    if (latestSnapshot?.platformData) {
      const validation = validatePlatformData(platform, latestSnapshot.platformData);
      if (!validation.success) {
        log.warn("platformData validation failed", {
          platform,
          slug,
          errors: validation.errors.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        });
      }
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

      // Check if platform supports reviews
      const platformConfig = PLATFORMS[platform as keyof typeof PLATFORMS];
      if (platformConfig && !platformConfig.hasReviews) {
        return { supported: false, reviews: [], total: 0, withContentCount: 0, distribution: [] };
      }

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
            // Position 0 = linked but unranked (WordPress tags); include them
            sql`${appCategoryRankings.position} >= 0`
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
      const { limit = String(PAGINATION_DEFAULT_LIMIT) } = request.query as { limit?: string };
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
      const maxLimit = Math.min(parseInt(limit, 10) || PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT);

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
        .where(
          and(
            eq(appFieldChanges.appId, changeApp.id),
            sql`NOT EXISTS (
              SELECT 1 FROM app_update_label_assignments ula
              JOIN app_update_labels aul ON aul.id = ula.label_id
              WHERE ula.change_id = ${appFieldChanges.id} AND aul.is_dismissal = TRUE
            )`
          )
        )
        .orderBy(desc(appFieldChanges.detectedAt))
        .limit(maxLimit);
    }
  );

  // GET /api/apps/:slug/changes-feed — self + competitor changes in one shot
  // Lightweight alternative to calling /changes + /competitors?includeChanges=true
  // Returns { selfChanges: [...], competitorChanges: { [slug]: [...] } }
  app.get<{ Params: { slug: string } }>(
    "/:slug/changes-feed",
    async (request) => {
      const { slug } = request.params;
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
      const { accountId } = request.user;

      // Look up app
      const [appRow] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);

      if (!appRow) return { selfChanges: [], competitorChanges: {} };

      // Fetch self changes + competitor IDs in parallel
      const selfChangesPromise = db
        .select()
        .from(appFieldChanges)
        .where(
          and(
            eq(appFieldChanges.appId, appRow.id),
            sql`NOT EXISTS (
              SELECT 1 FROM app_update_label_assignments ula
              JOIN app_update_labels aul ON aul.id = ula.label_id
              WHERE ula.change_id = ${appFieldChanges.id} AND aul.is_dismissal = TRUE
            )`
          )
        )
        .orderBy(desc(appFieldChanges.detectedAt))
        .limit(50);

      // Only look up competitors if the request is authenticated
      let competitorIdsPromise: Promise<{ id: number; slug: string; name: string }[]> = Promise.resolve([]);
      if (accountId) {
        // accountCompetitorApps.trackedAppId references apps.id (integer), not accountTrackedApps.id (UUID)
        competitorIdsPromise = db
          .select({
            id: apps.id,
            slug: apps.slug,
            name: apps.name,
          })
          .from(accountCompetitorApps)
          .innerJoin(apps, eq(apps.id, accountCompetitorApps.competitorAppId))
          .where(
            and(
              eq(accountCompetitorApps.accountId, accountId),
              eq(accountCompetitorApps.trackedAppId, appRow.id)
            )
          )
          .limit(10)
          .then(rows => rows as { id: number; slug: string; name: string }[]);
      }

      const [selfChanges, competitors] = await Promise.all([selfChangesPromise, competitorIdsPromise]);

      // Batch-fetch competitor changes in a single query
      const competitorChanges: Record<string, any[]> = {};
      if (competitors.length > 0) {
        const compIds = competitors.map(c => c.id);
        const idToSlug = new Map(competitors.map(c => [c.id, c.slug]));

        const compChangeRows: any[] = await db.execute(sql`
          SELECT afc.*, a.slug AS app_slug, a.name AS app_name
          FROM (
            SELECT afc2.*, ROW_NUMBER() OVER (PARTITION BY afc2.app_id ORDER BY afc2.detected_at DESC) AS rn
            FROM app_field_changes afc2
            WHERE afc2.app_id = ANY(${sqlArray(compIds)})
              AND NOT EXISTS (
                SELECT 1 FROM app_update_label_assignments ula
                JOIN app_update_labels aul ON aul.id = ula.label_id
                WHERE ula.change_id = afc2.id AND aul.is_dismissal = TRUE
              )
          ) afc
          JOIN apps a ON a.id = afc.app_id
          WHERE afc.rn <= 20
          ORDER BY afc.detected_at DESC
        `).then((res: any) => (res as any).rows ?? res);

        for (const row of compChangeRows) {
          const s = row.app_slug;
          if (!competitorChanges[s]) competitorChanges[s] = [];
          competitorChanges[s].push({
            id: row.id,
            appId: row.app_id,
            field: row.field,
            oldValue: row.old_value,
            newValue: row.new_value,
            detectedAt: row.detected_at,
            appName: row.app_name,
          });
        }
      }

      return { selfChanges, competitorChanges };
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
          SELECT DISTINCT ON (c.slug)
            c.slug AS category_slug, cs.app_count
          FROM category_snapshots cs
          JOIN categories c ON c.id = cs.category_id
          WHERE c.slug IN (${sql.join(catSlugs.map((s) => sql`${s}`), sql`, `)})
            AND cs.app_count IS NOT NULL
          ORDER BY c.slug, cs.scraped_at DESC
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
