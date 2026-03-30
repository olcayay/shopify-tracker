import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, sql, and, ilike, desc, asc } from "drizzle-orm";
import {
  globalDevelopers,
  platformDevelopers,
  apps,
  appSnapshots,
  accountStarredDevelopers,
  sqlArray,
} from "@appranks/db";
import { requireSystemAdmin } from "../middleware/authorize.js";
import { developerNameToSlug } from "@appranks/shared";
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT_SMALL, PAGINATION_DEFAULT_DEVELOPER_APPS, PAGINATION_MAX_DEVELOPER_APPS, PAGINATION_MAX_LIMIT } from "../constants.js";

export async function developerRoutes(app: FastifyInstance) {
  const db = app.db;

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
      const sort = request.query.sort || "name";
      const order = request.query.order === "desc" ? "desc" : "asc";
      const platformsParam = request.query.platforms?.trim() || "";
      const platforms = platformsParam ? platformsParam.split(",").filter(Boolean) : [];

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

      const orderClause =
        sort === "apps" ? sql`app_count` :
        sort === "platforms" ? sql`platform_count` :
        sql`g.name`;
      const orderDir = order === "desc" ? sql`DESC` : sql`ASC`;

      // Get account ID for starred status (may be null for unauthenticated)
      const accountId = (request as any).user?.accountId || null;

      // Get paginated results with counts, platforms array, top app icons, and starred status
      const rows: any[] = await db.execute(sql`
        SELECT
          g.id, g.slug, g.name, g.website,
          COUNT(DISTINCT pd.platform) AS platform_count,
          COUNT(DISTINCT pd.id) AS link_count,
          ARRAY_AGG(DISTINCT pd.platform) FILTER (WHERE pd.platform IS NOT NULL) AS platforms,
          (
            SELECT COALESCE(json_agg(sub), '[]'::json)
            FROM (
              SELECT DISTINCT a.icon_url, a.name, a.slug, a.platform
              FROM apps a
              JOIN app_snapshots s ON s.app_id = a.id
              JOIN platform_developers pd2 ON pd2.global_developer_id = g.id
                AND a.platform = pd2.platform
              WHERE s.developer->>'name' = pd2.name
                AND a.icon_url IS NOT NULL
                AND s.id = (SELECT s2.id FROM app_snapshots s2 WHERE s2.app_id = a.id ORDER BY s2.scraped_at DESC LIMIT 1)
              ORDER BY a.name
              LIMIT 5
            ) sub
          ) AS top_apps,
          (
            SELECT COUNT(DISTINCT a2.id)
            FROM apps a2
            JOIN app_snapshots s2 ON s2.app_id = a2.id
            JOIN platform_developers pd3 ON pd3.global_developer_id = g.id
              AND a2.platform = pd3.platform
            WHERE s2.developer->>'name' = pd3.name
              AND s2.id = (SELECT s3.id FROM app_snapshots s3 WHERE s3.app_id = a2.id ORDER BY s3.scraped_at DESC LIMIT 1)
          ) AS app_count,
          CASE WHEN asd.id IS NOT NULL THEN true ELSE false END AS is_starred
        FROM global_developers g
        LEFT JOIN platform_developers pd ON pd.global_developer_id = g.id
        LEFT JOIN account_starred_developers asd ON asd.global_developer_id = g.id
          AND asd.account_id = ${accountId}
        ${whereClause}
        GROUP BY g.id, asd.id
        ORDER BY (asd.id IS NOT NULL) DESC, ${orderClause} ${orderDir}
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        developers: rows.map((r: any) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          website: r.website,
          platformCount: Number(r.platform_count || 0),
          linkCount: Number(r.link_count || 0),
          appCount: Number(r.app_count || 0),
          platforms: r.platforms || [],
          topApps: (r.top_apps || []).map((a: any) => ({
            iconUrl: a.icon_url,
            name: a.name,
            slug: a.slug,
            platform: a.platform,
          })),
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

  // GET /api/developers/:slug — developer profile + all apps across platforms
  app.get(
    "/:slug",
    async (
      request: FastifyRequest<{ Params: { slug: string } }>,
      reply
    ) => {
      const slug = request.params.slug.toLowerCase();

      // Get global developer
      const [developer] = await db
        .select()
        .from(globalDevelopers)
        .where(eq(globalDevelopers.slug, slug))
        .limit(1);

      if (!developer) {
        return reply.code(404).send({ error: "Developer not found" });
      }

      // Get all platform developers linked to this global developer
      const platformDevs = await db
        .select({
          id: platformDevelopers.id,
          platform: platformDevelopers.platform,
          name: platformDevelopers.name,
        })
        .from(platformDevelopers)
        .where(eq(platformDevelopers.globalDeveloperId, developer.id));

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
      }[] = [];

      // Batch-fetch apps for all platform developers in a single query
      if (platformDevs.length > 0) {
        const devNames = platformDevs.map((pd: { name: string }) => pd.name);
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
            a.active_installs
          FROM ${apps} a
          JOIN ${appSnapshots} s ON s.app_id = a.id
          WHERE a.platform = ANY(${sqlArray(devPlatforms)})
            AND s.developer->>'name' = ANY(${sqlArray(devNames)})
            AND s.id = (
              SELECT s2.id FROM ${appSnapshots} s2
              WHERE s2.app_id = a.id
              ORDER BY s2.scraped_at DESC LIMIT 1
            )
          ORDER BY a.id
        `);
        const appData: any[] = (allAppRows as any).rows ?? allAppRows;
        for (const row of appData) {
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
          });
        }
      }

      // Check if developer is starred by current account
      const detailAccountId = (request as any).user?.accountId || null;
      let isStarred = false;
      if (detailAccountId) {
        const [starred] = await db
          .select({ id: accountStarredDevelopers.id })
          .from(accountStarredDevelopers)
          .where(
            and(
              eq(accountStarredDevelopers.accountId, detailAccountId),
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

      // Use CTEs instead of correlated subqueries for platform_developers and app_count
      const rows: any[] = await db.execute(sql`
        WITH latest_snapshots AS (
          SELECT DISTINCT ON (app_id) app_id, developer
          FROM app_snapshots
          ORDER BY app_id, scraped_at DESC
        ),
        dev_app_counts AS (
          SELECT pd.global_developer_id, COUNT(DISTINCT a.id) AS app_count
          FROM platform_developers pd
          JOIN apps a ON a.platform = pd.platform
          JOIN latest_snapshots s ON s.app_id = a.id
          WHERE s.developer->>'name' = pd.name
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
