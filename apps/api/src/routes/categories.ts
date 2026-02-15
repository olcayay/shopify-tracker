import type { FastifyPluginAsync } from "fastify";
import { eq, desc, isNull, sql } from "drizzle-orm";
import { createDb } from "@shopify-tracking/db";
import { categories, categorySnapshots } from "@shopify-tracking/db";

type Db = ReturnType<typeof createDb>;

export const categoryRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // GET /api/categories — list all categories
  // ?format=tree (default) | flat
  // ?tracked=true — only tracked
  app.get("/", async (request) => {
    const { format = "tree", tracked } = request.query as {
      format?: string;
      tracked?: string;
    };

    let query = db.select().from(categories);
    if (tracked === "true") {
      query = query.where(eq(categories.isTracked, true)) as typeof query;
    }
    const rows = await query.orderBy(categories.categoryLevel, categories.title);

    if (format === "flat") {
      return rows;
    }

    // Build tree: roots are those with null parentSlug
    return buildTree(rows);
  });

  // GET /api/categories/:slug — category detail + latest snapshot
  app.get<{ Params: { slug: string } }>("/:slug", async (request, reply) => {
    const { slug } = request.params;

    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    if (!category) {
      return reply.code(404).send({ error: "Category not found" });
    }

    const [latestSnapshot] = await db
      .select()
      .from(categorySnapshots)
      .where(eq(categorySnapshots.categorySlug, slug))
      .orderBy(desc(categorySnapshots.scrapedAt))
      .limit(1);

    const children = await db
      .select()
      .from(categories)
      .where(eq(categories.parentSlug, slug));

    return { ...category, latestSnapshot: latestSnapshot || null, children };
  });

  // GET /api/categories/:slug/history — historical snapshots
  // ?limit=20&offset=0
  app.get<{ Params: { slug: string } }>(
    "/:slug/history",
    async (request, reply) => {
      const { slug } = request.params;
      const { limit = "20", offset = "0" } = request.query as {
        limit?: string;
        offset?: string;
      };

      const [category] = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);

      if (!category) {
        return reply.code(404).send({ error: "Category not found" });
      }

      const snapshots = await db
        .select()
        .from(categorySnapshots)
        .where(eq(categorySnapshots.categorySlug, slug))
        .orderBy(desc(categorySnapshots.scrapedAt))
        .limit(parseInt(limit, 10))
        .offset(parseInt(offset, 10));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(categorySnapshots)
        .where(eq(categorySnapshots.categorySlug, slug));

      return { category, snapshots, total: count };
    }
  );
};

function buildTree(rows: (typeof categories.$inferSelect)[]) {
  const map = new Map<string, any>();
  const roots: any[] = [];

  for (const row of rows) {
    map.set(row.slug, { ...row, children: [] });
  }

  for (const row of rows) {
    const node = map.get(row.slug);
    if (row.parentSlug && map.has(row.parentSlug)) {
      map.get(row.parentSlug).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
