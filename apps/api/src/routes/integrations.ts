import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import { apps } from "@appranks/db";
import { parsePaginationQuery } from "../schemas/query.js";


export const integrationRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/integrations/:name — apps that have this integration
  app.get<{ Params: { name: string }; Querystring: { platform?: string } }>(
    "/:name",
    async (request, reply) => {
      const { name } = request.params;
      const platform = request.query.platform;
      const { limit: maxLimit, offset: parsedOffset } = parsePaginationQuery(request.query, 200);

      // Find all apps that have this integration (from latest snapshot).
      // Supports both exact display names ("Service Cloud") and slugified URLs
      // ("service-cloud") via REGEXP_REPLACE fuzzy match (same pattern as PLA-1126).
      const appsResult = await db.execute(sql`
        SELECT
          a.slug,
          a.name,
          a.is_built_for_shopify,
          a.icon_url,
          a.badges,
          s.average_rating,
          s.rating_count,
          s.pricing,
          (
            SELECT elem FROM jsonb_array_elements_text(s.integrations) elem
            WHERE elem = ${name}
              OR LOWER(REGEXP_REPLACE(elem, '[[:space:]&/]+', '-', 'g')) = LOWER(${name})
            LIMIT 1
          ) AS matched_integration
        FROM (
          SELECT DISTINCT ON (app_id)
            id, app_id, integrations, average_rating, rating_count, pricing
          FROM app_snapshots
          ORDER BY app_id, scraped_at DESC
        ) s
        INNER JOIN apps a ON a.id = s.app_id
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(s.integrations) elem
          WHERE elem = ${name}
            OR LOWER(REGEXP_REPLACE(elem, '[[:space:]&/]+', '-', 'g')) = LOWER(${name})
        )
        ${platform ? sql`AND a.platform = ${platform}` : sql``}
        ORDER BY a.name
        LIMIT ${maxLimit} OFFSET ${parsedOffset}
      `);

      const rows = (appsResult as any).rows ?? appsResult;
      if (!rows || rows.length === 0) {
        return reply.code(404).send({ error: "Integration not found" });
      }

      // Use the resolved display name from the first matched row (e.g. "Service Cloud"
      // instead of the slug "service-cloud")
      const resolvedName = (rows[0] as any).matched_integration || name;

      return {
        name: resolvedName,
        apps: rows.map((r: any) => {
          const { matched_integration, ...rest } = r;
          return rest;
        }),
      };
    }
  );
};
