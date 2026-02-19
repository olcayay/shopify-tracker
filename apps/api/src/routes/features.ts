import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and, ilike } from "drizzle-orm";
import {
  createDb,
  appSnapshots,
  apps,
  accountTrackedFeatures,
} from "@shopify-tracking/db";

type Db = ReturnType<typeof createDb>;

export const featureRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // GET /api/features/tree — all features grouped as category > subcategory > features
  app.get("/tree", async () => {
    const rows = await db.execute(sql`
      SELECT DISTINCT
        cat->>'title' AS category_title,
        sub->>'title' AS subcategory_title,
        f->>'feature_handle' AS feature_handle,
        f->>'title' AS feature_title
      FROM (
        SELECT DISTINCT ON (app_slug) categories
        FROM app_snapshots
        ORDER BY app_slug, scraped_at DESC
      ) latest,
      jsonb_array_elements(latest.categories) AS cat,
      jsonb_array_elements(cat->'subcategories') AS sub,
      jsonb_array_elements(sub->'features') AS f
      ORDER BY category_title, subcategory_title, feature_title
    `);

    const data = (rows as any).rows ?? rows;

    // Group into tree: category > subcategory > features
    const catMap = new Map<string, Map<string, { handle: string; title: string }[]>>();
    for (const row of data) {
      const cat = row.category_title;
      const sub = row.subcategory_title;
      if (!catMap.has(cat)) catMap.set(cat, new Map());
      const subMap = catMap.get(cat)!;
      if (!subMap.has(sub)) subMap.set(sub, []);
      subMap.get(sub)!.push({ handle: row.feature_handle, title: row.feature_title });
    }

    const tree = [];
    for (const [catTitle, subMap] of catMap) {
      const subcategories = [];
      for (const [subTitle, features] of subMap) {
        subcategories.push({ title: subTitle, features });
      }
      tree.push({ title: catTitle, subcategories });
    }

    return tree;
  });

  // GET /api/features/search?q= — search features by title
  app.get("/search", async (request) => {
    const { q = "" } = request.query as { q?: string };
    if (q.length < 1) return [];

    // Extract distinct features from latest snapshots using JSONB
    const rows = await db.execute(sql`
      SELECT DISTINCT
        f->>'feature_handle' AS handle,
        f->>'title' AS title
      FROM (
        SELECT DISTINCT ON (app_slug)
          categories
        FROM app_snapshots
        ORDER BY app_slug, scraped_at DESC
      ) latest,
      jsonb_array_elements(latest.categories) AS cat,
      jsonb_array_elements(cat->'subcategories') AS sub,
      jsonb_array_elements(sub->'features') AS f
      WHERE f->>'title' ILIKE ${`%${q}%`}
      ORDER BY title
      LIMIT 30
    `);

    return (rows as any).rows ?? rows;
  });

  // GET /api/features/by-category?category=X&subcategory=Y — features in a category
  app.get("/by-category", async (request) => {
    const { category = "", subcategory = "" } = request.query as {
      category?: string;
      subcategory?: string;
    };
    if (!category && !subcategory) return [];

    let rows: any;
    if (subcategory) {
      rows = await db.execute(sql`
        SELECT DISTINCT
          f->>'feature_handle' AS handle,
          f->>'title' AS title,
          cat->>'title' AS category_title,
          sub->>'title' AS subcategory_title
        FROM (
          SELECT DISTINCT ON (app_slug) categories
          FROM app_snapshots
          ORDER BY app_slug, scraped_at DESC
        ) latest,
        jsonb_array_elements(latest.categories) AS cat,
        jsonb_array_elements(cat->'subcategories') AS sub,
        jsonb_array_elements(sub->'features') AS f
        WHERE sub->>'title' = ${subcategory}
        ${category ? sql`AND cat->>'title' = ${category}` : sql``}
        ORDER BY title
      `);
    } else {
      rows = await db.execute(sql`
        SELECT DISTINCT
          f->>'feature_handle' AS handle,
          f->>'title' AS title,
          cat->>'title' AS category_title,
          sub->>'title' AS subcategory_title
        FROM (
          SELECT DISTINCT ON (app_slug) categories
          FROM app_snapshots
          ORDER BY app_slug, scraped_at DESC
        ) latest,
        jsonb_array_elements(latest.categories) AS cat,
        jsonb_array_elements(cat->'subcategories') AS sub,
        jsonb_array_elements(sub->'features') AS f
        WHERE cat->>'title' = ${category}
        ORDER BY title
      `);
    }

    return (rows as any).rows ?? rows;
  });

  // GET /api/features/:handle — feature detail + apps that have it
  app.get<{ Params: { handle: string } }>(
    "/:handle",
    async (request, reply) => {
      const { handle } = request.params;
      const { accountId } = request.user;

      // Find feature title + category info from any snapshot
      const featureResult = await db.execute(sql`
        SELECT DISTINCT
          f->>'feature_handle' AS handle,
          f->>'title' AS title,
          cat->>'title' AS category_title,
          sub->>'title' AS subcategory_title
        FROM app_snapshots,
          jsonb_array_elements(categories) AS cat,
          jsonb_array_elements(cat->'subcategories') AS sub,
          jsonb_array_elements(sub->'features') AS f
        WHERE f->>'feature_handle' = ${handle}
        LIMIT 1
      `);

      const featureRows = (featureResult as any).rows ?? featureResult;
      if (!featureRows || featureRows.length === 0) {
        return reply.code(404).send({ error: "Feature not found" });
      }

      const feature = featureRows[0];

      // Find all apps that have this feature (from latest snapshot)
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
            id, app_slug, categories, average_rating, rating_count, pricing
          FROM app_snapshots
          ORDER BY app_slug, scraped_at DESC
        ) s
        INNER JOIN apps a ON a.slug = s.app_slug
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements(s.categories) AS cat,
               jsonb_array_elements(cat->'subcategories') AS sub,
               jsonb_array_elements(sub->'features') AS f
          WHERE f->>'feature_handle' = ${handle}
        )
        ORDER BY a.name
      `);

      // Check if tracked by account
      const [tracked] = await db
        .select({ id: accountTrackedFeatures.id })
        .from(accountTrackedFeatures)
        .where(
          and(
            eq(accountTrackedFeatures.accountId, accountId),
            eq(accountTrackedFeatures.featureHandle, handle)
          )
        );

      return {
        handle: feature.handle,
        title: feature.title,
        categoryTitle: feature.category_title || null,
        subcategoryTitle: feature.subcategory_title || null,
        isStarredByAccount: !!tracked,
        apps: (appsResult as any).rows ?? appsResult,
      };
    }
  );
};
