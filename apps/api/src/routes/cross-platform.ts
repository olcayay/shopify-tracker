import type { FastifyInstance, FastifyRequest } from "fastify";
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT_SMALL } from "../constants.js";
import { sql, eq, and, inArray } from "drizzle-orm";
import {
  apps,
  accountTrackedApps,
  accountCompetitorApps,
  accountTrackedKeywords,
  trackedKeywords,
  accountPlatforms,
} from "@appranks/db";

interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
  sort?: string;
  order?: string;
  platforms?: string;
  status?: string;
}

function parsePagination(query: PaginationQuery) {
  const page = Math.max(1, parseInt(query.page || "1", 10));
  const limit = Math.min(PAGINATION_MAX_LIMIT_SMALL, Math.max(1, parseInt(query.limit || String(PAGINATION_DEFAULT_LIMIT), 10)));
  const offset = (page - 1) * limit;
  const search = query.search?.trim() || "";
  const order = query.order === "desc" ? "desc" : "asc";
  const platformFilter = query.platforms
    ? query.platforms.split(",").map((p) => p.trim()).filter(Boolean)
    : [];
  const statusFilter = query.status === "tracked" || query.status === "competitor" ? query.status : "all";
  return { page, limit, offset, search, order, platformFilter, statusFilter };
}

function paginationResponse(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function crossPlatformRoutes(app: FastifyInstance) {
  const db = app.db;

  // GET /api/cross-platform/apps — tracked + competitor apps across all platforms
  app.get(
    "/apps",
    async (
      request: FastifyRequest<{ Querystring: PaginationQuery }>
    ) => {
      const { accountId } = request.user;
      const { page, limit, offset, search, order, platformFilter, statusFilter } = parsePagination(request.query);
      const sort = request.query.sort || "name";

      // Get account's enabled platforms
      const enabledPlatforms = await db
        .select({ platform: accountPlatforms.platform })
        .from(accountPlatforms)
        .where(eq(accountPlatforms.accountId, accountId));
      const enabledPlatformIds = enabledPlatforms.map((p: { platform: string }) => p.platform);

      if (enabledPlatformIds.length === 0) {
        return { items: [], pagination: paginationResponse(page, limit, 0) };
      }

      // Get tracked app IDs for this account
      const trackedAppRows = await db
        .select({ appId: accountTrackedApps.appId })
        .from(accountTrackedApps)
        .where(eq(accountTrackedApps.accountId, accountId));
      const trackedAppIds = trackedAppRows.map((r: { appId: number }) => r.appId);

      // Get competitor app IDs
      const competitorAppRows = await db
        .select({
          competitorAppId: accountCompetitorApps.competitorAppId,
          trackedAppId: accountCompetitorApps.trackedAppId,
        })
        .from(accountCompetitorApps)
        .where(eq(accountCompetitorApps.accountId, accountId));
      const competitorAppIds = competitorAppRows.map((r: { competitorAppId: number }) => r.competitorAppId);

      // Merge app IDs based on status filter
      const allAppIds: number[] = statusFilter === "tracked"
        ? [...trackedAppIds]
        : statusFilter === "competitor"
        ? [...new Set(competitorAppIds)]
        : [...new Set([...trackedAppIds, ...competitorAppIds])];
      if (allAppIds.length === 0) {
        return { items: [], pagination: paginationResponse(page, limit, 0) };
      }

      // Build platform filter
      const effectivePlatforms = platformFilter.length > 0
        ? platformFilter.filter((p) => enabledPlatformIds.includes(p))
        : enabledPlatformIds;

      if (effectivePlatforms.length === 0) {
        return { items: [], pagination: paginationResponse(page, limit, 0) };
      }

      const searchFilter = search
        ? sql`AND a.name ILIKE ${`%${search}%`}`
        : sql``;
      const platformIn = sql`a.platform IN (${sql.join(effectivePlatforms.map((p: string) => sql`${p}`), sql`, `)})`;

      // Count total
      const [countResult] = await db.execute(sql`
        SELECT COUNT(*) as count FROM apps a
        WHERE a.id IN (${sql.join(allAppIds.map((id: number) => sql`${id}`), sql`, `)})
        AND ${platformIn}
        ${searchFilter}
      `) as any[];
      const total = Number(countResult?.count || 0);

      // Sort clause
      const orderDir = order === "desc" ? sql`DESC` : sql`ASC`;
      const orderClause =
        sort === "rating" ? sql`a.average_rating` :
        sort === "reviews" ? sql`a.rating_count` :
        sort === "platform" ? sql`a.platform` :
        sql`a.name`;

      // Fetch paginated results
      const rows: any[] = await db.execute(sql`
        SELECT
          a.id, a.platform, a.slug, a.name, a.icon_url,
          a.average_rating, a.rating_count, a.pricing_hint, a.is_tracked,
          a.active_installs
        FROM apps a
        WHERE a.id IN (${sql.join(allAppIds.map((id: number) => sql`${id}`), sql`, `)})
        AND ${platformIn}
        ${searchFilter}
        ORDER BY
          ${trackedAppIds.length > 0
            ? sql`CASE WHEN a.id IN (${sql.join(trackedAppIds.map((id: number) => sql`${id}`), sql`, `)}) THEN 0 ELSE 1 END,`
            : sql``}
          ${orderClause} ${orderDir}
        LIMIT ${limit} OFFSET ${offset}
      `);

      const trackedSet = new Set(trackedAppIds);
      const competitorMap = new Map<number, number[]>();
      for (const r of competitorAppRows) {
        const existing = competitorMap.get(r.competitorAppId) || [];
        existing.push(r.trackedAppId);
        competitorMap.set(r.competitorAppId, existing);
      }

      return {
        items: rows.map((r: any) => ({
          id: r.id,
          platform: r.platform,
          slug: r.slug,
          name: r.name,
          iconUrl: r.icon_url,
          averageRating: r.average_rating ? parseFloat(r.average_rating) : null,
          ratingCount: r.rating_count,
          pricingHint: r.pricing_hint,
          isTracked: trackedSet.has(r.id),
          isCompetitor: competitorMap.has(r.id),
          competitorOfAppIds: competitorMap.get(r.id) || [],
          activeInstalls: r.active_installs,
        })),
        pagination: paginationResponse(page, limit, total),
      };
    }
  );

  // GET /api/cross-platform/keywords — tracked keywords across all platforms
  app.get(
    "/keywords",
    async (
      request: FastifyRequest<{ Querystring: PaginationQuery }>
    ) => {
      const { accountId } = request.user;
      const { page, limit, offset, search, order, platformFilter } = parsePagination(request.query);
      const sort = request.query.sort || "keyword";

      // Get account's tracked keyword IDs
      const trackedKeywordRows = await db
        .select({
          keywordId: accountTrackedKeywords.keywordId,
          trackedAppId: accountTrackedKeywords.trackedAppId,
        })
        .from(accountTrackedKeywords)
        .where(eq(accountTrackedKeywords.accountId, accountId));

      if (trackedKeywordRows.length === 0) {
        return { items: [], pagination: paginationResponse(page, limit, 0) };
      }

      const keywordIds = Array.from(new Set(trackedKeywordRows.map((r: { keywordId: number }) => r.keywordId))) as number[];

      // Build keyword-to-apps map
      const keywordAppMap = new Map<number, number[]>();
      for (const r of trackedKeywordRows) {
        if (r.trackedAppId == null) continue; // Skip research-mode keywords
        const existing = keywordAppMap.get(r.keywordId) || [];
        existing.push(r.trackedAppId);
        keywordAppMap.set(r.keywordId, existing);
      }

      const searchFilter = search
        ? sql`AND k.keyword ILIKE ${`%${search}%`}`
        : sql``;
      const platformFilterSql = platformFilter.length > 0
        ? sql`AND k.platform IN (${sql.join(platformFilter.map((p) => sql`${p}`), sql`, `)})`
        : sql``;

      // Count total
      const [countResult] = await db.execute(sql`
        SELECT COUNT(*) as count FROM tracked_keywords k
        WHERE k.id IN (${sql.join(keywordIds.map((id: number) => sql`${id}`), sql`, `)})
        ${searchFilter}
        ${platformFilterSql}
      `) as any[];
      const total = Number(countResult?.count || 0);

      // Sort clause
      const orderDir = order === "desc" ? sql`DESC` : sql`ASC`;
      const orderClause =
        sort === "platform" ? sql`k.platform` :
        sort === "totalResults" ? sql`ks.total_results` :
        sql`k.keyword`;
      const nullsLast = sort === "totalResults" ? sql`NULLS LAST` : sql``;

      // Fetch paginated results with batch DISTINCT ON instead of LATERAL join
      const rows: any[] = await db.execute(sql`
        SELECT
          k.id, k.platform, k.keyword, k.slug, k.is_active, k.created_at,
          ks.total_results, ks.scraped_at AS last_scraped_at
        FROM tracked_keywords k
        LEFT JOIN (
          SELECT DISTINCT ON (keyword_id)
            keyword_id, total_results, scraped_at
          FROM keyword_snapshots
          WHERE keyword_id IN (${sql.join(keywordIds.map((id: number) => sql`${id}`), sql`, `)})
          ORDER BY keyword_id, scraped_at DESC
        ) ks ON ks.keyword_id = k.id
        WHERE k.id IN (${sql.join(keywordIds.map((id: number) => sql`${id}`), sql`, `)})
        ${searchFilter}
        ${platformFilterSql}
        ORDER BY ${orderClause} ${orderDir} ${nullsLast}
        LIMIT ${limit} OFFSET ${offset}
      `) as any[];

      // Fetch tracked app details for display
      const allTrackedAppIds = Array.from(new Set(
        Array.from(keywordAppMap.values()).flat()
      )) as number[];
      const trackedAppDetailsMap = new Map<number, { name: string; iconUrl: string | null; slug: string; platform: string }>();
      if (allTrackedAppIds.length > 0) {
        const trackedAppRows: any[] = await db.execute(sql`
          SELECT id, name, icon_url, slug, platform
          FROM apps
          WHERE id IN (${sql.join(allTrackedAppIds.map((id: number) => sql`${id}`), sql`, `)})
        `) as any[];
        for (const ta of trackedAppRows) {
          trackedAppDetailsMap.set(ta.id, { name: ta.name, iconUrl: ta.icon_url, slug: ta.slug, platform: ta.platform });
        }
      }

      return {
        items: rows.map((r: any) => {
          const appIds = keywordAppMap.get(r.id) || [];
          return {
            id: r.id,
            platform: r.platform,
            keyword: r.keyword,
            slug: r.slug,
            isActive: r.is_active,
            appCount: appIds.length,
            trackedAppIds: appIds,
            trackedApps: appIds
              .map((id: number) => trackedAppDetailsMap.get(id))
              .filter(Boolean),
            totalResults: r.total_results != null ? Number(r.total_results) : null,
            lastScrapedAt: r.last_scraped_at || null,
            createdAt: r.created_at,
          };
        }),
        pagination: paginationResponse(page, limit, total),
      };
    }
  );

  // GET /api/cross-platform/competitors — competitor apps across all platforms
  app.get(
    "/competitors",
    async (
      request: FastifyRequest<{ Querystring: PaginationQuery }>
    ) => {
      const { accountId } = request.user;
      const { page, limit, offset, search, order, platformFilter } = parsePagination(request.query);
      const sort = request.query.sort || "name";

      // Get competitor relationships
      const competitorRows = await db
        .select({
          competitorAppId: accountCompetitorApps.competitorAppId,
          trackedAppId: accountCompetitorApps.trackedAppId,
        })
        .from(accountCompetitorApps)
        .where(eq(accountCompetitorApps.accountId, accountId));

      if (competitorRows.length === 0) {
        return { items: [], pagination: paginationResponse(page, limit, 0) };
      }

      const competitorAppIds = Array.from(new Set(competitorRows.map((r: { competitorAppId: number }) => r.competitorAppId))) as number[];

      // Build competitor-to-tracked-apps map
      const trackedForMap = new Map<number, number[]>();
      for (const r of competitorRows) {
        const existing = trackedForMap.get(r.competitorAppId) || [];
        existing.push(r.trackedAppId);
        trackedForMap.set(r.competitorAppId, existing);
      }

      const searchFilter = search
        ? sql`AND a.name ILIKE ${`%${search}%`}`
        : sql``;
      const platformFilterSql = platformFilter.length > 0
        ? sql`AND a.platform IN (${sql.join(platformFilter.map((p) => sql`${p}`), sql`, `)})`
        : sql``;

      // Count total
      const [countResult] = await db.execute(sql`
        SELECT COUNT(*) as count FROM apps a
        WHERE a.id IN (${sql.join(competitorAppIds.map((id: number) => sql`${id}`), sql`, `)})
        ${searchFilter}
        ${platformFilterSql}
      `) as any[];
      const total = Number(countResult?.count || 0);

      // Sort clause
      const orderDir = order === "desc" ? sql`DESC` : sql`ASC`;
      const orderClause =
        sort === "rating" ? sql`a.average_rating` :
        sort === "reviews" ? sql`a.rating_count` :
        sort === "platform" ? sql`a.platform` :
        sql`a.name`;

      // Fetch paginated results
      const rows: any[] = await db.execute(sql`
        SELECT
          a.id, a.platform, a.slug, a.name, a.icon_url,
          a.average_rating, a.rating_count, a.pricing_hint,
          a.active_installs
        FROM apps a
        WHERE a.id IN (${sql.join(competitorAppIds.map((id: number) => sql`${id}`), sql`, `)})
        ${searchFilter}
        ${platformFilterSql}
        ORDER BY ${orderClause} ${orderDir}
        LIMIT ${limit} OFFSET ${offset}
      `) as any[];

      // Fetch tracked app details for display
      const allTrackedAppIds = Array.from(new Set(competitorRows.map((r: { trackedAppId: number }) => r.trackedAppId))) as number[];
      const trackedAppDetailsMap = new Map<number, { id: number; name: string; iconUrl: string | null; slug: string; platform: string }>();
      if (allTrackedAppIds.length > 0) {
        const trackedAppRows: any[] = await db.execute(sql`
          SELECT id, name, icon_url, slug, platform
          FROM apps
          WHERE id IN (${sql.join(allTrackedAppIds.map((id: number) => sql`${id}`), sql`, `)})
        `) as any[];
        for (const ta of trackedAppRows) {
          trackedAppDetailsMap.set(ta.id, { id: ta.id, name: ta.name, iconUrl: ta.icon_url, slug: ta.slug, platform: ta.platform });
        }
      }

      return {
        items: rows.map((r: any) => {
          const trackedAppIds = trackedForMap.get(r.id) || [];
          return {
            id: r.id,
            platform: r.platform,
            slug: r.slug,
            name: r.name,
            iconUrl: r.icon_url,
            averageRating: r.average_rating ? parseFloat(r.average_rating) : null,
            ratingCount: r.rating_count,
            pricingHint: r.pricing_hint,
            trackedForAppIds: trackedAppIds,
            trackedForCount: trackedAppIds.length,
            trackedForApps: trackedAppIds
              .map((id: number) => trackedAppDetailsMap.get(id))
              .filter(Boolean),
            activeInstalls: r.active_installs,
          };
        }),
        pagination: paginationResponse(page, limit, total),
      };
    }
  );
}
