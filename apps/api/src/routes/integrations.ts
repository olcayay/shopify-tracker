import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import { apps } from "@appranks/db";


export const integrationRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/integrations/:name — apps that have this integration
  app.get<{ Params: { name: string }; Querystring: { platform?: string } }>(
    "/:name",
    async (request, reply) => {
      const { name } = request.params;
      const platform = request.query.platform;
      const maxLimit = Math.min(parseInt((request.query as any).limit || "200", 10) || 200, 200);
      const parsedOffset = parseInt((request.query as any).offset || "0", 10) || 0;

      // Find all apps that have this integration (from latest snapshot)
      const appsResult = await db.execute(sql`
        SELECT
          a.slug,
          a.name,
          a.is_built_for_shopify,
          a.icon_url,
          a.badges,
          s.average_rating,
          s.rating_count,
          s.pricing
        FROM (
          SELECT DISTINCT ON (app_id)
            id, app_id, integrations, average_rating, rating_count, pricing
          FROM app_snapshots
          ORDER BY app_id, scraped_at DESC
        ) s
        INNER JOIN apps a ON a.id = s.app_id
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(s.integrations) AS elem
          WHERE elem = ${name}
        )
        ${platform ? sql`AND a.platform = ${platform}` : sql``}
        ORDER BY a.name
        LIMIT ${maxLimit} OFFSET ${parsedOffset}
      `);

      const rows = (appsResult as any).rows ?? appsResult;
      if (!rows || rows.length === 0) {
        return reply.code(404).send({ error: "Integration not found" });
      }

      return {
        name,
        apps: rows,
      };
    }
  );
};
