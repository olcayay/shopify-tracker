import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and, ilike } from "drizzle-orm";
import {
  appSnapshots,
  apps,
  accountTrackedFeatures,
} from "@appranks/db";
import { cacheGet } from "../utils/cache.js";
import { slugifyTitle } from "../utils/slugify.js";

const FEATURE_TREE_TTL = 43200; // 12 hours

type FeatureCategoryTreeNode = {
  title: string;
  slug: string;
  url: string | null;
  subcategories: {
    title: string;
    features: {
      handle: string;
      title: string;
      url: string | null;
    }[];
  }[];
};

async function getFeatureTree(db: any): Promise<FeatureCategoryTreeNode[]> {
  return cacheGet("features:tree:full", async () => {
    const rows = await db.execute(sql`
      SELECT DISTINCT
        cat->>'title' AS category_title,
        cat->>'url' AS category_url,
        sub->>'title' AS subcategory_title,
        f->>'feature_handle' AS feature_handle,
        f->>'title' AS feature_title,
        f->>'url' AS feature_url
      FROM (
        SELECT DISTINCT ON (app_id) categories
        FROM app_snapshots
        ORDER BY app_id, scraped_at DESC
      ) latest,
      jsonb_array_elements(latest.categories) AS cat,
      jsonb_array_elements(cat->'subcategories') AS sub,
      jsonb_array_elements(sub->'features') AS f
      ORDER BY category_title, subcategory_title, feature_title
    `);

    const data = (rows as any).rows ?? rows;
    const catMap = new Map<string, {
      title: string;
      slug: string;
      url: string | null;
      subcategories: Map<string, {
        title: string;
        features: Map<string, { handle: string; title: string; url: string | null }>;
      }>;
    }>();

    for (const row of data) {
      const categoryTitle = row.category_title;
      const subcategoryTitle = row.subcategory_title;
      if (!categoryTitle || !subcategoryTitle || !row.feature_handle || !row.feature_title) continue;

      if (!catMap.has(categoryTitle)) {
        catMap.set(categoryTitle, {
          title: categoryTitle,
          slug: slugifyTitle(categoryTitle),
          url: row.category_url || null,
          subcategories: new Map(),
        });
      }

      const category = catMap.get(categoryTitle)!;
      if (!category.subcategories.has(subcategoryTitle)) {
        category.subcategories.set(subcategoryTitle, {
          title: subcategoryTitle,
          features: new Map(),
        });
      }

      const subcategory = category.subcategories.get(subcategoryTitle)!;
      if (!subcategory.features.has(row.feature_handle)) {
        subcategory.features.set(row.feature_handle, {
          handle: row.feature_handle,
          title: row.feature_title,
          url: row.feature_url || null,
        });
      }
    }

    return Array.from(catMap.values()).map((category) => ({
      title: category.title,
      slug: category.slug,
      url: category.url,
      subcategories: Array.from(category.subcategories.values()).map((subcategory) => ({
        title: subcategory.title,
        features: Array.from(subcategory.features.values()),
      })),
    }));
  }, FEATURE_TREE_TTL);
}

export const featureRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/features/tree — all features grouped as category > subcategory > features
  // Cached for 12 hours — changes only when scraper runs
  app.get("/tree", async () => {
    const tree = await getFeatureTree(db);
    return tree.map((category) => ({
      title: category.title,
      slug: category.slug,
      subcategories: category.subcategories,
    }));
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
        SELECT DISTINCT ON (app_id)
          categories
        FROM app_snapshots
        ORDER BY app_id, scraped_at DESC
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
        SELECT
          f->>'feature_handle' AS handle,
          f->>'title' AS title,
          cat->>'title' AS category_title,
          sub->>'title' AS subcategory_title,
          COUNT(DISTINCT latest.app_id)::int AS app_count
        FROM (
          SELECT DISTINCT ON (app_id) app_id, categories
          FROM app_snapshots
          ORDER BY app_id, scraped_at DESC
        ) latest,
        jsonb_array_elements(latest.categories) AS cat,
        jsonb_array_elements(cat->'subcategories') AS sub,
        jsonb_array_elements(sub->'features') AS f
        WHERE sub->>'title' = ${subcategory}
        ${category ? sql`AND cat->>'title' = ${category}` : sql``}
        GROUP BY handle, title, category_title, subcategory_title
        ORDER BY title
      `);
    } else {
      rows = await db.execute(sql`
        SELECT
          f->>'feature_handle' AS handle,
          f->>'title' AS title,
          cat->>'title' AS category_title,
          sub->>'title' AS subcategory_title,
          COUNT(DISTINCT latest.app_id)::int AS app_count
        FROM (
          SELECT DISTINCT ON (app_id) app_id, categories
          FROM app_snapshots
          ORDER BY app_id, scraped_at DESC
        ) latest,
        jsonb_array_elements(latest.categories) AS cat,
        jsonb_array_elements(cat->'subcategories') AS sub,
        jsonb_array_elements(sub->'features') AS f
        WHERE cat->>'title' = ${category}
        GROUP BY handle, title, category_title, subcategory_title
        ORDER BY title
      `);
    }

    return (rows as any).rows ?? rows;
  });

  // GET /api/features/categories/:slug — parent feature category detail
  app.get<{ Params: { slug: string } }>(
    "/categories/:slug",
    async (request, reply) => {
      const { slug } = request.params;
      const tree = await getFeatureTree(db);
      const category = tree.find((entry) => entry.slug === slug);

      if (!category) {
        return reply.code(404).send({ error: "Feature category not found" });
      }

      const features = category.subcategories.flatMap((subcategory) =>
        subcategory.features.map((feature) => ({
          ...feature,
          subcategoryTitle: subcategory.title,
        })),
      );

      // Fetch app counts per feature handle in this category
      const featureHandles = features.map((f) => f.handle);
      let appCountMap: Record<string, number> = {};
      if (featureHandles.length > 0) {
        const countRows = await db.execute(sql`
          SELECT
            f->>'feature_handle' AS handle,
            COUNT(DISTINCT latest.app_id)::int AS app_count
          FROM (
            SELECT DISTINCT ON (app_id) app_id, categories
            FROM app_snapshots
            ORDER BY app_id, scraped_at DESC
          ) latest,
          jsonb_array_elements(latest.categories) AS cat,
          jsonb_array_elements(cat->'subcategories') AS sub,
          jsonb_array_elements(sub->'features') AS f
          WHERE cat->>'title' = ${category.title}
          GROUP BY handle
        `);
        const countData = (countRows as any).rows ?? countRows;
        for (const row of countData) {
          appCountMap[row.handle] = row.app_count;
        }
      }

      return {
        slug: category.slug,
        title: category.title,
        url: category.url,
        subcategoryCount: category.subcategories.length,
        featureCount: features.length,
        subcategories: category.subcategories.map((subcategory) => ({
          title: subcategory.title,
          featureCount: subcategory.features.length,
        })),
        features: features.map((f) => ({
          ...f,
          appCount: appCountMap[f.handle] ?? 0,
        })),
      };
    },
  );

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
          cat->>'url' AS category_url,
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
          SELECT DISTINCT ON (app_id)
            id, app_id, categories, average_rating, rating_count, pricing
          FROM app_snapshots
          ORDER BY app_id, scraped_at DESC
        ) s
        INNER JOIN apps a ON a.id = s.app_id
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
        categoryUrl: feature.category_url || null,
        subcategoryTitle: feature.subcategory_title || null,
        isStarredByAccount: !!tracked,
        apps: (appsResult as any).rows ?? appsResult,
      };
    }
  );
};
