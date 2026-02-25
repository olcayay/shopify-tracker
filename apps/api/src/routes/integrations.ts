import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import { createDb, apps } from "@shopify-tracking/db";

type Db = ReturnType<typeof createDb>;

export const integrationRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // GET /api/integrations/:name — apps that have this integration
  app.get<{ Params: { name: string } }>(
    "/:name",
    async (request, reply) => {
      const { name } = request.params;

      // Find all apps that have this integration (from latest snapshot)
      const appsResult = await db.execute(sql`
        SELECT
          a.slug,
          a.name,
          a.is_built_for_shopify,
          a.icon_url,
          s.average_rating,
          s.rating_count,
          s.pricing
        FROM (
          SELECT DISTINCT ON (app_slug)
            id, app_slug, integrations, average_rating, rating_count, pricing
          FROM app_snapshots
          ORDER BY app_slug, scraped_at DESC
        ) s
        INNER JOIN apps a ON a.slug = s.app_slug
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(s.integrations) AS elem
          WHERE elem = ${name}
        )
        ORDER BY a.name
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
