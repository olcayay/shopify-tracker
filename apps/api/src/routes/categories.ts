import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and, asc, inArray } from "drizzle-orm";
import { categories, categorySnapshots, appCategoryRankings, apps, categoryAdSightings, appPowerScores, categoryParents, sqlArray } from "@appranks/db";
import { getPlatformFromQuery } from "../utils/platform.js";
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from "../constants.js";
import { cacheGet } from "../utils/cache.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("categories");


export const categoryRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/categories — list all categories
  // ?format=tree (default) | flat
  // ?tracked=true — only tracked
  app.get("/", async (request) => {
    const { format = "tree", tracked } = request.query as {
      format?: string;
      tracked?: string;
    };
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    // Subquery for latest appCount per category
    const latestSnapshot = db
      .select({
        categoryId: categorySnapshots.categoryId,
        appCount: categorySnapshots.appCount,
        rn: sql<number>`row_number() over (partition by ${categorySnapshots.categoryId} order by ${categorySnapshots.scrapedAt} desc)`.as("rn"),
      })
      .from(categorySnapshots)
      .as("ls");

    const conditions = [eq(categories.platform, platform)];
    if (tracked === "true") {
      conditions.push(eq(categories.isTracked, true));
    }

    const rows = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        title: categories.title,
        url: categories.url,
        parentSlug: categories.parentSlug,
        categoryLevel: categories.categoryLevel,
        description: categories.description,
        isTracked: categories.isTracked,
        isListingPage: categories.isListingPage,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
        appCount: latestSnapshot.appCount,
      })
      .from(categories)
      .leftJoin(
        latestSnapshot,
        sql`${latestSnapshot.categoryId} = ${categories.id} and ${latestSnapshot.rn} = 1`
      )
      .where(and(...conditions))
      .orderBy(categories.categoryLevel, categories.title);

    // Hide empty categories (appCount 0 or null) from non-system-admin users
    const isAdmin = request.user?.isSystemAdmin === true;

    if (format === "flat") {
      return isAdmin
        ? rows
        : rows.filter((r) => r.appCount != null && r.appCount > 0);
    }

    // Query junction table for multi-parent relationships (graceful fallback if table doesn't exist yet)
    let junctionRows: { categoryId: number; parentCategoryId: number }[] = [];
    try {
      const categoryIds = rows.map((r) => r.id);
      if (categoryIds.length > 0) {
        junctionRows = await db
          .select({
            categoryId: categoryParents.categoryId,
            parentCategoryId: categoryParents.parentCategoryId,
          })
          .from(categoryParents)
          .where(inArray(categoryParents.categoryId, categoryIds));
      }
    } catch {
      // category_parents table may not exist yet (pre-migration)
    }

    // Build tree with ALL categories (including hub parents with no apps)
    // then prune empty leaves for non-admins. This preserves the hierarchy
    // so parent categories like "Finding products" appear even if they have
    // no direct apps — as long as their children do.
    const tree = buildTree(rows, junctionRows);
    return isAdmin ? tree : pruneEmptyLeaves(tree);
  });

  // GET /api/categories/features-by-slugs?slugs=slug1,slug2
  // Returns the Shopify category feature taxonomy for the given category slugs.
  // Aggregates from all app snapshots that have those categories.
  app.get("/features-by-slugs", async (request, reply) => {
    const { slugs: slugsParam } = request.query as { slugs?: string };
    if (!slugsParam) return [];

    const slugs = slugsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (slugs.length === 0) return [];
    // Validate slugs contain only safe characters
    if (slugs.some((s) => !/^[a-z0-9-]+$/.test(s))) return [];

    try {
      const result = await db.execute(sql`
        SELECT DISTINCT
          regexp_replace(cat->>'url', '.*\/categories\/([^/?#]+).*', '\1') as cat_slug,
          cat->>'title' as cat_title,
          sub->>'title' as sub_title,
          feat->>'title' as feat_title,
          feat->>'feature_handle' as feat_handle,
          COALESCE(feat->>'url', '') as feat_url
        FROM app_snapshots s,
        jsonb_array_elements(s.categories) as cat,
        jsonb_array_elements(cat->'subcategories') as sub,
        jsonb_array_elements(sub->'features') as feat
        WHERE regexp_replace(cat->>'url', '.*\/categories\/([^/?#]+).*', '\1') = ANY(${sqlArray(slugs)})
        ORDER BY cat_title, sub_title, feat_title
      `);
      const rows = (Array.isArray(result) ? result : (result as any).rows ?? []) as { cat_slug: string; cat_title: string; sub_title: string; feat_title: string; feat_handle: string; feat_url: string }[];

    // Group by category → subcategory → features
    const catMap = new Map<string, { title: string; slug: string; subcategories: Map<string, { title: string; features: { title: string; feature_handle: string; url: string }[] }> }>();

    for (const row of rows) {
      if (!catMap.has(row.cat_slug)) {
        catMap.set(row.cat_slug, { title: row.cat_title, slug: row.cat_slug, subcategories: new Map() });
      }
      const cat = catMap.get(row.cat_slug)!;
      if (!cat.subcategories.has(row.sub_title)) {
        cat.subcategories.set(row.sub_title, { title: row.sub_title, features: [] });
      }
      const sub = cat.subcategories.get(row.sub_title)!;
      if (!sub.features.some((f) => f.feature_handle === row.feat_handle)) {
        sub.features.push({ title: row.feat_title, feature_handle: row.feat_handle, url: row.feat_url });
      }
    }

    return Array.from(catMap.values()).map((cat) => ({
      title: cat.title,
      slug: cat.slug,
      subcategories: Array.from(cat.subcategories.values()),
    }));
    } catch (err) {
      log.error("[features-by-slugs] Error", { error: String(err) });
      reply.code(500);
      return { error: "Internal server error", details: String(err) };
    }
  });

  // GET /api/categories/:slug — category detail + latest snapshot
  app.get<{ Params: { slug: string } }>("/:slug", async (request, reply) => {
    const { slug } = request.params;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.slug, slug), eq(categories.platform, platform)))
      .limit(1);

    if (!category) {
      return reply.code(404).send({ error: "Category not found" });
    }

    const [latestSnapshot] = await db
      .select()
      .from(categorySnapshots)
      .where(eq(categorySnapshots.categoryId, category.id))
      .orderBy(desc(categorySnapshots.scrapedAt))
      .limit(1);

    // Get children via junction table first, fall back to parentSlug
    let junctionChildren: any[] = [];
    try {
      junctionChildren = await db
        .select({
          id: categories.id,
          slug: categories.slug,
          title: categories.title,
          url: categories.url,
          parentSlug: categories.parentSlug,
          categoryLevel: categories.categoryLevel,
          description: categories.description,
          isTracked: categories.isTracked,
          isListingPage: categories.isListingPage,
          createdAt: categories.createdAt,
          updatedAt: categories.updatedAt,
          platform: categories.platform,
        })
        .from(categoryParents)
        .innerJoin(categories, eq(categories.id, categoryParents.categoryId))
        .where(eq(categoryParents.parentCategoryId, category.id));
    } catch {
      // category_parents table may not exist yet (pre-migration)
    }

    // Fall back to parentSlug if junction table has no results
    const childrenRaw = junctionChildren.length > 0
      ? junctionChildren
      : await db.select().from(categories).where(and(eq(categories.parentSlug, slug), eq(categories.platform, platform)));

    // Batch-fetch latest appCount for all children (single query instead of N)
    const childIds = childrenRaw.map((c: any) => c.id);
    const childSnapMap = new Map<number, number | null>();
    if (childIds.length > 0) {
      const childSnaps = await db.execute(sql`
        SELECT DISTINCT ON (category_id) category_id, app_count
        FROM category_snapshots
        WHERE category_id = ANY(${sqlArray(childIds)})
        ORDER BY category_id, scraped_at DESC
      `);
      for (const row of ((childSnaps as any).rows ?? childSnaps) as any[]) {
        childSnapMap.set(row.category_id, row.app_count);
      }
    }
    const children = childrenRaw.map((child: any) => ({
      ...child,
      appCount: childSnapMap.get(child.id) ?? null,
    }));

    // Build breadcrumb by walking up the parent chain
    // Use junction table for parent lookups, falling back to parentSlug
    const breadcrumb: { slug: string; title: string }[] = [];

    // Get parents from junction table
    let junctionParentRows: { parentId: number; parentSlug: string; parentTitle: string }[] = [];
    try {
      junctionParentRows = await db
        .select({
          parentId: categoryParents.parentCategoryId,
          parentSlug: categories.slug,
          parentTitle: categories.title,
        })
        .from(categoryParents)
        .innerJoin(categories, eq(categories.id, categoryParents.parentCategoryId))
        .where(eq(categoryParents.categoryId, category.id));
    } catch {
      // category_parents table may not exist yet (pre-migration)
    }

    if (junctionParentRows.length > 0) {
      // Use first parent for breadcrumb (pick any for single-path display)
      const firstParent = junctionParentRows[0];
      // Walk up from this parent
      const visited = new Set<number>();
      let currentId = firstParent.parentId;
      const parentChain: { slug: string; title: string }[] = [
        { slug: firstParent.parentSlug, title: firstParent.parentTitle },
      ];
      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        try {
          const [grandparent] = await db
            .select({
              parentId: categoryParents.parentCategoryId,
              parentSlug: categories.slug,
              parentTitle: categories.title,
            })
            .from(categoryParents)
            .innerJoin(categories, eq(categories.id, categoryParents.parentCategoryId))
            .where(eq(categoryParents.categoryId, currentId))
            .limit(1);
          if (!grandparent) break;
          parentChain.unshift({ slug: grandparent.parentSlug, title: grandparent.parentTitle });
          currentId = grandparent.parentId;
        } catch {
          break;
        }
      }
      breadcrumb.push(...parentChain);
    } else {
      // Fall back to parentSlug chain
      let currentParent = category.parentSlug;
      const visited = new Set<string>();
      while (currentParent && !visited.has(currentParent)) {
        visited.add(currentParent);
        const [parent] = await db
          .select({ slug: categories.slug, title: categories.title, parentSlug: categories.parentSlug })
          .from(categories)
          .where(eq(categories.slug, currentParent))
          .limit(1);
        if (!parent) break;
        breadcrumb.unshift({ slug: parent.slug, title: parent.title });
        currentParent = parent.parentSlug;
      }
    }

    // Include all parent paths for multi-parent categories
    const allParentPaths = junctionParentRows.length > 1
      ? junctionParentRows.map((p) => ({ slug: p.parentSlug, title: p.parentTitle }))
      : undefined;

    // Fetch ranked apps
    let rankedApps: any[] = [];
    let hubPageApps: any[] = [];

    if (category.isListingPage && latestSnapshot) {
      // Listing page: fetch ranked apps from appCategoryRankings
      try {
        const rankings = await db
          .select({
            position: appCategoryRankings.position,
            appSlug: apps.slug,
            name: apps.name,
            iconUrl: apps.iconUrl,
            isBuiltForShopify: apps.isBuiltForShopify,
            averageRating: apps.averageRating,
            ratingCount: apps.ratingCount,
            pricingHint: apps.pricingHint,
            launchedDate: apps.launchedDate,
          })
          .from(appCategoryRankings)
          .innerJoin(apps, eq(apps.id, appCategoryRankings.appId))
          .where(
            and(
              eq(appCategoryRankings.scrapeRunId, latestSnapshot.scrapeRunId),
              eq(appCategoryRankings.categorySlug, slug),
              eq(apps.platform, platform)
            )
          )
          .orderBy(asc(appCategoryRankings.position));

        rankedApps = rankings.map((r) => ({
          position: r.position,
          slug: r.appSlug,
          name: r.name,
          icon_url: r.iconUrl || null,
          is_built_for_shopify: r.isBuiltForShopify,
          average_rating: r.averageRating ? Number(r.averageRating) : null,
          rating_count: r.ratingCount ?? null,
          pricing_hint: r.pricingHint || null,
          launched_date: r.launchedDate || null,
        }));
      } catch (err) {
        app.log.warn(`Failed to fetch ranked apps for category ${slug}: ${err}`);
      }
    } else if (category.isListingPage && !latestSnapshot) {
      // No snapshot (e.g. categories discovered from app details, not from crawling)
      // Fetch latest ranking per app directly
      try {
        const rankings = await db
          .selectDistinctOn([appCategoryRankings.appId], {
            position: appCategoryRankings.position,
            appSlug: apps.slug,
            name: apps.name,
            iconUrl: apps.iconUrl,
            isBuiltForShopify: apps.isBuiltForShopify,
            averageRating: apps.averageRating,
            ratingCount: apps.ratingCount,
            pricingHint: apps.pricingHint,
            launchedDate: apps.launchedDate,
          })
          .from(appCategoryRankings)
          .innerJoin(apps, eq(apps.id, appCategoryRankings.appId))
          .where(and(eq(appCategoryRankings.categorySlug, slug), eq(apps.platform, platform)))
          .orderBy(appCategoryRankings.appId, desc(appCategoryRankings.scrapedAt));

        rankedApps = rankings.map((r) => ({
          position: r.position,
          slug: r.appSlug,
          name: r.name,
          icon_url: r.iconUrl || null,
          is_built_for_shopify: r.isBuiltForShopify,
          average_rating: r.averageRating ? Number(r.averageRating) : null,
          rating_count: r.ratingCount ?? null,
          pricing_hint: r.pricingHint || null,
          launched_date: r.launchedDate || null,
        }));
      } catch (err) {
        app.log.warn(`Failed to fetch ranked apps for category ${slug} (no snapshot): ${err}`);
      }
    } else if (!category.isListingPage) {
      // Hub page: return featured apps from snapshot + apps from descendant listing categories
      if (latestSnapshot?.firstPageApps) {
        hubPageApps = (latestSnapshot.firstPageApps as any[]).map((a: any) => ({
          slug: a.app_url?.replace("https://apps.shopify.com/", "") || "",
          name: a.name,
          icon_url: a.logo_url || null,
          is_built_for_shopify: !!a.is_built_for_shopify,
          average_rating: a.average_rating || null,
          rating_count: a.rating_count || null,
          pricing_hint: a.pricing_hint || null,
        }));
      }

      // Get apps from descendant listing categories
      try {
        // Get descendant listing categories via junction table first, fall back to slug-based
        let junctionDescendants: { slug: string; title: string }[] = [];
        try {
          junctionDescendants = await db
            .select({ slug: categories.slug, title: categories.title })
            .from(categoryParents)
            .innerJoin(categories, eq(categories.id, categoryParents.categoryId))
            .where(
              and(
                eq(categoryParents.parentCategoryId, category.id),
                eq(categories.isListingPage, true)
              )
            );
        } catch {
          // category_parents table may not exist yet (pre-migration)
        }

        const descendantListingCats = junctionDescendants.length > 0
          ? junctionDescendants
          : await db
              .select({ slug: categories.slug, title: categories.title })
              .from(categories)
              .where(
                and(
                  sql`(${categories.slug} LIKE ${slug + '-%'} OR ${categories.parentSlug} = ${slug})`,
                  eq(categories.isListingPage, true),
                  eq(categories.platform, platform)
                )
              );

        if (descendantListingCats.length > 0) {
          // Batch: get category IDs for all descendants in one query
          const descSlugs = descendantListingCats.map((c) => c.slug);
          const descCatRows = await db
            .select({ id: categories.id, slug: categories.slug })
            .from(categories)
            .where(and(inArray(categories.slug, descSlugs), eq(categories.platform, platform)));

          const descSlugToId = new Map(descCatRows.map((r) => [r.slug, r.id]));
          const descCatIds = descCatRows.map((r) => r.id);

          // Batch: get latest scrape_run_id per descendant category
          const descSnapRows = descCatIds.length > 0
            ? await db.execute(sql`
                SELECT DISTINCT ON (category_id) category_id, scrape_run_id
                FROM category_snapshots
                WHERE category_id = ANY(${sqlArray(descCatIds)})
                ORDER BY category_id, scraped_at DESC
              `)
            : [];
          const descSnapData: any[] = (descSnapRows as any).rows ?? descSnapRows;
          const catIdToRunId = new Map(descSnapData.map((r: any) => [r.category_id, r.scrape_run_id]));

          // Build slug -> scrapeRunId mapping
          const slugRunPairs: { slug: string; scrapeRunId: string }[] = [];
          for (const descCat of descendantListingCats) {
            const catId = descSlugToId.get(descCat.slug);
            if (!catId) continue;
            const runId = catIdToRunId.get(catId);
            if (!runId) continue;
            slugRunPairs.push({ slug: descCat.slug, scrapeRunId: runId });
          }

          // Batch: get all ranked apps for all descendant categories in one query
          if (slugRunPairs.length > 0) {
            const runIds = [...new Set(slugRunPairs.map((p) => p.scrapeRunId))];
            const slugsForRankings = slugRunPairs.map((p) => p.slug);
            const allRanked = await db
              .select({
                categorySlug: appCategoryRankings.categorySlug,
                position: appCategoryRankings.position,
                appSlug: apps.slug,
                name: apps.name,
                iconUrl: apps.iconUrl,
                isBuiltForShopify: apps.isBuiltForShopify,
                averageRating: apps.averageRating,
                ratingCount: apps.ratingCount,
                pricingHint: apps.pricingHint,
                launchedDate: apps.launchedDate,
              })
              .from(appCategoryRankings)
              .innerJoin(apps, eq(apps.id, appCategoryRankings.appId))
              .where(
                and(
                  inArray(appCategoryRankings.categorySlug, slugsForRankings),
                  inArray(appCategoryRankings.scrapeRunId, runIds)
                )
              )
              .orderBy(asc(appCategoryRankings.position));

            // Build title lookup from descendantListingCats
            const slugToTitle = new Map(descendantListingCats.map((c) => [c.slug, c.title]));
            // Only include rankings for valid slug+runId pairs
            const validPairs = new Set(slugRunPairs.map((p) => `${p.slug}:${p.scrapeRunId}`));

            const appMap = new Map<string, any>();
            for (const r of allRanked) {
              // Verify this ranking belongs to a valid slug+runId pair
              const catId = descSlugToId.get(r.categorySlug);
              const runId = catId ? catIdToRunId.get(catId) : undefined;
              if (!runId || !validPairs.has(`${r.categorySlug}:${runId}`)) continue;

              if (!appMap.has(r.appSlug)) {
                appMap.set(r.appSlug, {
                  position: r.position,
                  slug: r.appSlug,
                  name: r.name,
                  icon_url: r.iconUrl || null,
                  is_built_for_shopify: r.isBuiltForShopify,
                  average_rating: r.averageRating ? Number(r.averageRating) : null,
                  rating_count: r.ratingCount ?? null,
                  pricing_hint: r.pricingHint || null,
                  launched_date: r.launchedDate || null,
                  source_categories: [{ title: slugToTitle.get(r.categorySlug) ?? r.categorySlug, slug: r.categorySlug }],
                });
              } else {
                const existing = appMap.get(r.appSlug);
                if (!existing.source_categories.some((sc: any) => sc.slug === r.categorySlug)) {
                  existing.source_categories.push({ title: slugToTitle.get(r.categorySlug) ?? r.categorySlug, slug: r.categorySlug });
                }
              }
            }
            // Keep only leaf categories per app (remove parents when a child is present)
            for (const app of appMap.values()) {
              const cats: { title: string; slug: string }[] = app.source_categories;
              if (cats.length > 1) {
                app.source_categories = cats.filter(
                  (cat) => !cats.some((other) => other.slug !== cat.slug && other.slug.startsWith(cat.slug + '-'))
                );
              }
            }
            rankedApps = [...appMap.values()];
          }
        }
      } catch (err) {
        app.log.warn(`Failed to fetch descendant apps for hub category ${slug}: ${err}`);
      }
    }

    return {
      ...category,
      latestSnapshot: latestSnapshot
        ? { appCount: latestSnapshot.appCount, scrapedAt: latestSnapshot.scrapedAt }
        : null,
      children,
      breadcrumb,
      allParentPaths,
      rankedApps,
      hubPageApps,
    };
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
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const [category] = await db
        .select()
        .from(categories)
        .where(and(eq(categories.slug, slug), eq(categories.platform, platform)))
        .limit(1);

      if (!category) {
        return reply.code(404).send({ error: "Category not found" });
      }

      const snapshots = await db
        .select({
          id: categorySnapshots.id,
          scrapeRunId: categorySnapshots.scrapeRunId,
          scrapedAt: categorySnapshots.scrapedAt,
          appCount: categorySnapshots.appCount,
        })
        .from(categorySnapshots)
        .where(eq(categorySnapshots.categoryId, category.id))
        .orderBy(desc(categorySnapshots.scrapedAt))
        .limit(parseInt(limit, 10))
        .offset(parseInt(offset, 10));

      // Batch-fetch ranking counts for all snapshots (single query instead of N)
      const scrapeRunIds = snapshots.map((s) => s.scrapeRunId);
      const rankCountMap = new Map<string, number>();
      if (scrapeRunIds.length > 0) {
        const rankCounts = await db
          .select({
            scrapeRunId: appCategoryRankings.scrapeRunId,
            rankCount: sql<number>`count(*)::int`,
          })
          .from(appCategoryRankings)
          .where(
            and(
              inArray(appCategoryRankings.scrapeRunId, scrapeRunIds),
              eq(appCategoryRankings.categorySlug, slug)
            )
          )
          .groupBy(appCategoryRankings.scrapeRunId);
        for (const r of rankCounts) {
          rankCountMap.set(r.scrapeRunId, r.rankCount);
        }
      }
      const enriched = snapshots.map((s) => ({
        ...s,
        appCount: s.appCount ?? (rankCountMap.get(s.scrapeRunId) || null),
      }));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(categorySnapshots)
        .where(eq(categorySnapshots.categoryId, category.id));

      return { category, snapshots: enriched, total: count };
    }
  );

  // GET /api/categories/:slug/ads — ad sightings for this category
  app.get<{ Params: { slug: string } }>(
    "/:slug/ads",
    async (request, reply) => {
      const { slug } = request.params;
      const { days = "30" } = request.query as { days?: string };

      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      const sinceStr = since.toISOString().slice(0, 10);

      // Look up category ID
      const [catRow] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);

      if (!catRow) return { adSightings: [] };

      const adSightings = await db
        .select({
          appSlug: apps.slug,
          appName: apps.name,
          iconUrl: apps.iconUrl,
          seenDate: categoryAdSightings.seenDate,
          timesSeenInDay: categoryAdSightings.timesSeenInDay,
        })
        .from(categoryAdSightings)
        .innerJoin(apps, eq(categoryAdSightings.appId, apps.id))
        .where(
          and(
            eq(categoryAdSightings.categoryId, catRow.id),
            sql`${categoryAdSightings.seenDate} >= ${sinceStr}`
          )
        )
        .orderBy(desc(categoryAdSightings.seenDate));

      return { adSightings };
    }
  );

  // GET /api/categories/:slug/scores — power leaderboard (latest day)
  app.get(
    "/:slug/scores",
    async (request) => {
      const { slug } = request.params as { slug: string };
      const { limit: limitStr = String(PAGINATION_DEFAULT_LIMIT) } = request.query as {
        limit?: string;
      };
      const limitNum = Math.min(parseInt(limitStr) || PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT);

      // Get latest computedAt for this category
      const [latestPow] = await db
        .select({ computedAt: appPowerScores.computedAt })
        .from(appPowerScores)
        .where(eq(appPowerScores.categorySlug, slug))
        .orderBy(desc(appPowerScores.computedAt))
        .limit(1);

      if (!latestPow) {
        return { scores: [], computedAt: null };
      }

      const computedAt = latestPow.computedAt;

      // Fetch power scores for latest day
      const powRows = await db
        .select()
        .from(appPowerScores)
        .where(
          and(
            eq(appPowerScores.categorySlug, slug),
            eq(appPowerScores.computedAt, computedAt),
          )
        );

      // Fetch app names by IDs
      const appIdArray = powRows.map((r) => r.appId);
      const appRows = appIdArray.length > 0
        ? await db
            .select({ id: apps.id, slug: apps.slug, name: apps.name, iconUrl: apps.iconUrl })
            .from(apps)
            .where(inArray(apps.id, appIdArray))
        : [];
      const appMap = new Map(appRows.map((r) => [r.id, r]));

      // Get totalApps from latest category snapshot
      // Look up category ID for raw SQL
      const [catForSnap] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);

      const [catSnap] = catForSnap
        ? await db
            .execute(
              sql`
              SELECT app_count FROM category_snapshots
              WHERE category_id = ${catForSnap.id} AND app_count IS NOT NULL
              ORDER BY scraped_at DESC LIMIT 1
            `
            )
            .then((res: any) => (res as any).rows ?? res)
        : [null];
      const totalApps: number | null = catSnap?.app_count ?? null;

      let scores = powRows.map((pow) => {
        const appInfo = appMap.get(pow.appId);
        return {
          appSlug: appInfo?.slug || '',
          appName: appInfo?.name || '',
          iconUrl: appInfo?.iconUrl || null,
          powerScore: pow.powerScore,
          powerRaw: pow.powerRaw,
          ratingScore: pow.ratingScore,
          reviewScore: pow.reviewScore,
          categoryScore: pow.categoryScore,
          momentumScore: pow.momentumScore,
        };
      });

      scores.sort((a, b) => b.powerScore - a.powerScore);
      scores = scores.slice(0, limitNum);

      return { scores, computedAt, totalApps };
    }
  );

  // GET /api/categories/:slug/scores/history — category-level power score trends
  app.get(
    "/:slug/scores/history",
    async (request) => {
      const { slug } = request.params as { slug: string };
      const { days = "30" } = request.query as { days?: string };
      const daysNum = Math.min(parseInt(days) || 30, 90);
      const sinceStr = new Date(Date.now() - daysNum * 86400000).toISOString().slice(0, 10);

      const power = await db
        .select()
        .from(appPowerScores)
        .where(
          and(
            eq(appPowerScores.categorySlug, slug),
            sql`${appPowerScores.computedAt} >= ${sinceStr}`,
          )
        )
        .orderBy(appPowerScores.computedAt);

      return { power };
    }
  );

  // POST /api/categories/batch — batch-fetch category leaders + appCount for multiple slugs
  app.post<{ Body: { slugs: string[] } }>(
    "/batch",
    async (request) => {
      const { slugs } = request.body as { slugs: string[] };
      if (!Array.isArray(slugs) || slugs.length === 0) return {};
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Get category IDs
      const catRows = await db
        .select({ id: categories.id, slug: categories.slug, isListingPage: categories.isListingPage })
        .from(categories)
        .where(and(inArray(categories.slug, slugs), eq(categories.platform, platform)));

      if (catRows.length === 0) return {};

      const catIds = catRows.map((r) => r.id);
      const catIdToSlug = new Map(catRows.map((r) => [r.id, r.slug]));
      const listingSlugs = catRows.filter((r) => r.isListingPage).map((r) => r.slug);

      // Batch-fetch latest snapshots (appCount + scrapeRunId)
      const snapRows = await db.execute(sql`
        SELECT DISTINCT ON (category_id) category_id, app_count, scrape_run_id
        FROM category_snapshots
        WHERE category_id = ANY(${sqlArray(catIds)})
        ORDER BY category_id, scraped_at DESC
      `);
      const snapData: any[] = (snapRows as any).rows ?? snapRows;
      const snapMap = new Map(snapData.map((r: any) => [
        catIdToSlug.get(r.category_id)!,
        { appCount: r.app_count, scrapeRunId: r.scrape_run_id },
      ]));

      // Batch-fetch top 3 ranked apps for all listing categories
      const runIds = [...new Set(snapData
        .filter((r: any) => listingSlugs.includes(catIdToSlug.get(r.category_id)!))
        .map((r: any) => r.scrape_run_id)
        .filter(Boolean)
      )];

      const leadersMap = new Map<string, any[]>();
      if (runIds.length > 0 && listingSlugs.length > 0) {
        const rankedRows = await db
          .select({
            categorySlug: appCategoryRankings.categorySlug,
            position: appCategoryRankings.position,
            appSlug: apps.slug,
            name: apps.name,
            iconUrl: apps.iconUrl,
          })
          .from(appCategoryRankings)
          .innerJoin(apps, eq(apps.id, appCategoryRankings.appId))
          .where(
            and(
              inArray(appCategoryRankings.categorySlug, listingSlugs),
              inArray(appCategoryRankings.scrapeRunId, runIds)
            )
          )
          .orderBy(asc(appCategoryRankings.position));

        for (const r of rankedRows) {
          const list = leadersMap.get(r.categorySlug) ?? [];
          if (list.length < 3) {
            list.push({ slug: r.appSlug, name: r.name, iconUrl: r.iconUrl, position: r.position });
            leadersMap.set(r.categorySlug, list);
          }
        }
      }

      // Build result
      const result: Record<string, { leaders: any[]; appCount: number | null }> = {};
      for (const slug of slugs) {
        const snap = snapMap.get(slug);
        result[slug] = {
          leaders: leadersMap.get(slug) ?? [],
          appCount: snap?.appCount ?? null,
        };
      }
      return result;
    }
  );
};

/** @internal exported for testing */
export function buildTree(
  rows: { id: number; slug: string; parentSlug: string | null; [key: string]: any }[],
  junctionRows?: { categoryId: number; parentCategoryId: number }[]
) {
  const map = new Map<string, any>();
  const roots: any[] = [];

  for (const row of rows) {
    map.set(row.slug, { ...row, children: [] });
  }

  if (junctionRows && junctionRows.length > 0) {
    // Build id→slug lookup
    const idToSlug = new Map<number, string>();
    for (const row of rows) {
      idToSlug.set(row.id, row.slug);
    }

    // Track which categories have junction-table parents
    const hasJunctionParent = new Set<string>();
    for (const jr of junctionRows) {
      const childSlug = idToSlug.get(jr.categoryId);
      const parentSlug = idToSlug.get(jr.parentCategoryId);
      if (childSlug && parentSlug && map.has(childSlug) && map.has(parentSlug)) {
        // Clone node for multi-parent display (same category appears under each parent)
        const child = map.get(childSlug);
        map.get(parentSlug).children.push(child);
        hasJunctionParent.add(childSlug);
      }
    }

    // Fall back to parentSlug for categories not in junction table
    for (const row of rows) {
      if (!hasJunctionParent.has(row.slug)) {
        const node = map.get(row.slug);
        if (row.parentSlug && map.has(row.parentSlug)) {
          map.get(row.parentSlug).children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        // Check if it also has no junction parent match (shouldn't happen, but safety)
        const node = map.get(row.slug);
        const isChild = Array.from(map.values()).some(
          (n) => n.children.includes(node)
        );
        if (!isChild) roots.push(node);
      }
    }
  } else {
    // No junction data — use parentSlug only
    for (const row of rows) {
      const node = map.get(row.slug);
      if (row.parentSlug && map.has(row.parentSlug)) {
        map.get(row.parentSlug).children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  return roots;
}

/**
 * Recursively removes empty leaf nodes from the category tree.
 * A node is kept if it has apps (appCount > 0) OR has children that have apps.
 * This preserves hub/parent categories that don't list apps themselves
 * but contain subcategories that do.
 */
/** @internal exported for testing */
export function pruneEmptyLeaves(nodes: any[]): any[] {
  return nodes
    .map((node) => ({
      ...node,
      children: pruneEmptyLeaves(node.children || []),
    }))
    .filter((node) =>
      (node.appCount != null && node.appCount > 0) || node.children.length > 0
    );
}
