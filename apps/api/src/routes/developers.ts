import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, sql, and, ilike, desc, asc } from "drizzle-orm";
import {
  globalDevelopers,
  platformDevelopers,
  apps,
  appSnapshots,
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
        };
      }>
    ) => {
      const page = Math.max(1, parseInt(request.query.page || "1", 10));
      const limit = Math.min(PAGINATION_MAX_LIMIT_SMALL, Math.max(1, parseInt(request.query.limit || String(PAGINATION_DEFAULT_LIMIT), 10)));
      const offset = (page - 1) * limit;
      const search = request.query.search?.trim() || "";
      const sort = request.query.sort || "name";
      const order = request.query.order === "desc" ? "desc" : "asc";

      const searchFilter = search ? sql`WHERE g.name ILIKE ${`%${search}%`}` : sql``;

      // Get total count
      const [countResult] = await db.execute(sql`
        SELECT COUNT(*) as count FROM global_developers g ${searchFilter}
      `) as any[];
      const total = Number(countResult?.count || 0);

      const orderClause =
        sort === "apps" ? sql`app_count` :
        sort === "platforms" ? sql`platform_count` :
        sql`g.name`;
      const orderDir = order === "desc" ? sql`DESC` : sql`ASC`;

      // Get paginated results with counts and platforms array
      const rows: any[] = await db.execute(sql`
        SELECT
          g.id, g.slug, g.name, g.website,
          COUNT(DISTINCT pd.platform) AS platform_count,
          COUNT(DISTINCT pd.id) AS link_count,
          ARRAY_AGG(DISTINCT pd.platform) FILTER (WHERE pd.platform IS NOT NULL) AS platforms
        FROM global_developers g
        LEFT JOIN platform_developers pd ON pd.global_developer_id = g.id
        ${searchFilter}
        GROUP BY g.id
        ORDER BY ${orderClause} ${orderDir}
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
          platforms: r.platforms || [],
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
          WHERE a.platform = ANY(${devPlatforms})
            AND s.developer->>'name' = ANY(${devNames})
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
        };
      }>
    ) => {
      const page = Math.max(1, parseInt(request.query.page || "1", 10));
      const limit = Math.min(PAGINATION_MAX_LIMIT, Math.max(1, parseInt(request.query.limit || String(PAGINATION_MAX_LIMIT_SMALL), 10)));
      const offset = (page - 1) * limit;
      const search = request.query.search?.trim() || "";

      const conditions = [];
      if (search) {
        conditions.push(ilike(globalDevelopers.name, `%${search}%`));
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(globalDevelopers)
        .where(whereClause);

      const total = Number(countResult?.count || 0);

      const rows: any[] = await db.execute(sql`
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
          (
            SELECT COUNT(DISTINCT a.id)
            FROM platform_developers pd
            JOIN apps a ON a.platform = pd.platform
            JOIN app_snapshots s ON s.app_id = a.id
            WHERE pd.global_developer_id = g.id
              AND s.developer->>'name' = pd.name
              AND s.id = (
                SELECT s2.id FROM app_snapshots s2
                WHERE s2.app_id = a.id
                ORDER BY s2.scraped_at DESC LIMIT 1
              )
          ) AS app_count
        FROM global_developers g
        ${search ? sql`WHERE g.name ILIKE ${`%${search}%`}` : sql``}
        ORDER BY g.name
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
