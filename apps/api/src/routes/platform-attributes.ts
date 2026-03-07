import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import { createDb } from "@appranks/db";

type Db = ReturnType<typeof createDb>;

const FIELD_MAP: Record<string, string> = {
  industry: "supportedIndustries",
  "business-need": "businessNeeds",
  "product-required": "productsRequired",
};

export const platformAttributeRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // GET /api/platform-attributes/:type/:value?platform=salesforce
  app.get<{ Params: { type: string; value: string }; Querystring: { platform?: string } }>(
    "/:type/:value",
    async (request, reply) => {
      const { type, value } = request.params;
      const platform = (request.query as any).platform || "salesforce";

      const jsonbField = FIELD_MAP[type];
      if (!jsonbField) {
        return reply.code(400).send({ error: `Unknown attribute type: ${type}` });
      }

      const rows = await db.execute(sql`
        SELECT
          a.slug,
          a.name,
          a.icon_url,
          a.badges,
          s.average_rating,
          s.rating_count,
          s.pricing
        FROM (
          SELECT DISTINCT ON (app_id)
            id, app_id, platform_data, average_rating, rating_count, pricing
          FROM app_snapshots
          ORDER BY app_id, scraped_at DESC
        ) s
        INNER JOIN apps a ON a.id = s.app_id
        WHERE a.platform = ${platform}
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(s.platform_data -> ${jsonbField}) AS elem
            WHERE elem = ${value}
          )
        ORDER BY a.name
      `);

      const result = (rows as any).rows ?? rows;
      return {
        type,
        value,
        platform,
        apps: result || [],
      };
    }
  );
};
