import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and, desc, inArray } from "drizzle-orm";
import {
  apps,
  appSnapshots,
  accounts,
  accountTrackedApps,
  accountTrackedKeywords,
  accountCompetitorApps,
  accountStarredCategories,
  accountStarredDevelopers,
  accountPlatforms,
  accountTrackedFeatures,
  categories,
  categorySnapshots,
  appCategoryRankings,
  keywordTags,
  keywordTagAssignments,
  categoryParents,
  platformRequests,
  globalDevelopers,
  sqlArray,
} from "@appranks/db";
import { requireRole } from "../middleware/authorize.js";
import { getPlatformFromQuery } from "../utils/platform.js";
import {
  addStarredCategorySchema,
  addStarredFeatureSchema,
  createKeywordTagSchema,
  updateKeywordTagSchema,
  platformRequestSchema,
} from "../schemas/account.js";


export const accountExtrasRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // --- Starred Categories ---

  // GET /api/account/starred-categories
  app.get("/starred-categories", async (request) => {
    const { accountId } = request.user;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    // Parallelize: starred categories, tracked apps, and competitor apps are independent
    const [starredRows, trackedAppsRows2, competitorAppsRows2] = await Promise.all([
      db
        .select({
          categorySlug: categories.slug,
          createdAt: accountStarredCategories.createdAt,
          categoryTitle: categories.title,
          parentSlug: categories.parentSlug,
        })
        .from(accountStarredCategories)
        .innerJoin(
          categories,
          eq(categories.id, accountStarredCategories.categoryId)
        )
        .where(and(eq(accountStarredCategories.accountId, accountId), eq(categories.platform, platform))),
      db.select({ appId: apps.id, appSlug: apps.slug }).from(accountTrackedApps).innerJoin(apps, eq(apps.id, accountTrackedApps.appId)).where(and(eq(accountTrackedApps.accountId, accountId), eq(apps.platform, platform))),
      db.select({ appId: apps.id, appSlug: apps.slug }).from(accountCompetitorApps).innerJoin(apps, eq(apps.id, accountCompetitorApps.competitorAppId)).where(and(eq(accountCompetitorApps.accountId, accountId), eq(apps.platform, platform))),
    ]);
    const trackedSet = new Set(trackedAppsRows2.map((a) => a.appSlug));
    const competitorSet = new Set(competitorAppsRows2.map((a) => a.appSlug));

    // Auto-detect categories from tracked/competitor apps via appCategoryRankings
    const allAppIds = [...new Set([...trackedAppsRows2.map((a) => a.appId), ...competitorAppsRows2.map((a) => a.appId)])];
    const autoCategories = new Map<string, { categorySlug: string; categoryTitle: string; parentSlug: string | null }>();
    if (allAppIds.length > 0) {
      const autoRows = await db
        .selectDistinctOn([appCategoryRankings.appId, appCategoryRankings.categorySlug], {
          appId: appCategoryRankings.appId,
          categorySlug: appCategoryRankings.categorySlug,
          categoryTitle: categories.title,
          parentSlug: categories.parentSlug,
        })
        .from(appCategoryRankings)
        .innerJoin(categories, and(
          eq(categories.slug, appCategoryRankings.categorySlug),
          eq(categories.platform, platform),
          eq(categories.isListingPage, true),
        ))
        .where(inArray(appCategoryRankings.appId, allAppIds))
        .orderBy(appCategoryRankings.appId, appCategoryRankings.categorySlug, desc(appCategoryRankings.scrapedAt));

      for (const r of autoRows) {
        if (!autoCategories.has(r.categorySlug)) {
          autoCategories.set(r.categorySlug, { categorySlug: r.categorySlug, categoryTitle: r.categoryTitle, parentSlug: r.parentSlug });
        }
      }
    }

    // Merge starred + auto-detected, compute source
    const starredSlugSet = new Set(starredRows.map((r) => r.categorySlug));
    const autoSlugSet = new Set(autoCategories.keys());

    type MergedRow = { categorySlug: string; categoryTitle: string; parentSlug: string | null; createdAt: Date | null; source: "starred" | "auto" | "both" };
    const rows: MergedRow[] = [];

    // Add all starred
    for (const r of starredRows) {
      const source = autoSlugSet.has(r.categorySlug) ? "both" : "starred";
      rows.push({ ...r, source });
    }
    // Add auto-only
    for (const [slug, info] of autoCategories) {
      if (!starredSlugSet.has(slug)) {
        rows.push({ categorySlug: info.categorySlug, categoryTitle: info.categoryTitle, parentSlug: info.parentSlug, createdAt: null, source: "auto" });
      }
    }

    if (rows.length === 0) return rows;

    // Get latest snapshot per category for firstPageApps + appCount
    const categorySlugs = rows.map((r) => r.categorySlug);
    const catRows = await db
      .select({ id: categories.id, slug: categories.slug })
      .from(categories)
      .where(inArray(categories.slug, categorySlugs));
    const catSlugToId = new Map(catRows.map((c) => [c.slug, c.id]));
    const catIdToSlug = new Map(catRows.map((c) => [c.id, c.slug]));
    const categoryIds = catRows.map((c) => c.id);

    // Use DISTINCT ON instead of correlated subquery for latest category snapshots
    const snapshots: { categoryId: number; appCount: number | null; firstPageApps: unknown; scrapeRunId: string }[] = categoryIds.length > 0
      ? await db.execute(sql`
          SELECT DISTINCT ON (category_id)
            category_id, app_count, first_page_apps, scrape_run_id
          FROM category_snapshots
          WHERE category_id = ANY(${sqlArray(categoryIds)})
          ORDER BY category_id, scraped_at DESC
        `).then((res: any) => ((res as any).rows ?? res).map((r: any) => ({
          categoryId: r.category_id as number,
          appCount: r.app_count as number | null,
          firstPageApps: r.first_page_apps,
          scrapeRunId: r.scrape_run_id as string,
        })))
      : [];

    const snapshotMap = new Map(snapshots.map((s) => [catIdToSlug.get(s.categoryId) ?? "", s]));

    function extractSlug(appUrl: string): string {
      return appUrl.replace(/^https?:\/\/apps\.shopify\.com\//, "").replace(/^\/apps\//, "").split("?")[0];
    }

    // For categories without firstPageApps (e.g. Salesforce), load ranked app slugs from appCategoryRankings
    const slugsNeedingRankings = rows
      .filter((r) => {
        const snap = snapshotMap.get(r.categorySlug);
        return !snap?.firstPageApps || (snap.firstPageApps as any[]).length === 0;
      })
      .map((r) => r.categorySlug);

    const rankingsMap = new Map<string, { app_slug: string; name: string; logo_url: string | null; position: number }[]>();
    if (slugsNeedingRankings.length > 0) {
      // Get scrape_run_ids from already-fetched snapshots (no correlated subquery needed)
      const scrapeRunIds = slugsNeedingRankings
        .map((slug) => snapshotMap.get(slug)?.scrapeRunId)
        .filter((id): id is string => id != null);

      if (scrapeRunIds.length > 0) {
        const rankingRows = await db
          .select({
            categorySlug: appCategoryRankings.categorySlug,
            appSlug: apps.slug,
            name: apps.name,
            iconUrl: apps.iconUrl,
            position: appCategoryRankings.position,
          })
          .from(appCategoryRankings)
          .innerJoin(apps, eq(apps.id, appCategoryRankings.appId))
          .where(
            and(
              inArray(appCategoryRankings.categorySlug, slugsNeedingRankings),
              inArray(appCategoryRankings.scrapeRunId, scrapeRunIds)
            )
          );
        for (const r of rankingRows) {
          const list = rankingsMap.get(r.categorySlug) ?? [];
          list.push({ app_slug: r.appSlug, name: r.name, logo_url: r.iconUrl, position: r.position });
          rankingsMap.set(r.categorySlug, list);
        }
      }
    }

    // Enrich with all parent titles from junction table
    const parentTitlesMap = new Map<string, { slug: string; title: string }[]>();
    try {
      const catIds = [...catSlugToId.values()];
      if (catIds.length > 0) {
        const parentRows = await db
          .select({
            categoryId: categoryParents.categoryId,
            parentSlug: categories.slug,
            parentTitle: categories.title,
          })
          .from(categoryParents)
          .innerJoin(categories, eq(categories.id, categoryParents.parentCategoryId))
          .where(inArray(categoryParents.categoryId, catIds));
        for (const pr of parentRows) {
          const slug = catIdToSlug.get(pr.categoryId) ?? "";
          const list = parentTitlesMap.get(slug) ?? [];
          list.push({ slug: pr.parentSlug, title: pr.parentTitle });
          parentTitlesMap.set(slug, list);
        }
      }
    } catch { /* category_parents table may not exist yet */ }

    return rows.map((row) => {
      const snap = snapshotMap.get(row.categorySlug);
      const fpApps = (snap?.firstPageApps ?? []) as any[];

      let trackedAppsInResults: any[];
      let competitorAppsInResults: any[];

      if (fpApps.length > 0) {
        // Shopify path: use firstPageApps from snapshot
        trackedAppsInResults = fpApps
          .filter((a) => trackedSet.has(extractSlug(a.app_url)))
          .map((a) => ({ ...a, app_slug: extractSlug(a.app_url) }));
        competitorAppsInResults = fpApps
          .filter((a) => competitorSet.has(extractSlug(a.app_url)))
          .map((a) => ({ ...a, app_slug: extractSlug(a.app_url) }));
      } else {
        // Non-Shopify path: use appCategoryRankings
        const rankedApps = rankingsMap.get(row.categorySlug) ?? [];
        trackedAppsInResults = rankedApps.filter((a) => trackedSet.has(a.app_slug));
        competitorAppsInResults = rankedApps.filter((a) => competitorSet.has(a.app_slug));
      }

      // Use junction table parents if available, fall back to single parentSlug
      const parents = parentTitlesMap.get(row.categorySlug) ?? (row.parentSlug ? [{ slug: row.parentSlug, title: row.parentSlug }] : []);

      return {
        ...row,
        parents,
        appCount: snap?.appCount ?? null,
        trackedInResults: trackedAppsInResults.length,
        competitorInResults: competitorAppsInResults.length,
        trackedAppsInResults,
        competitorAppsInResults,
      };
    });
  });

  // POST /api/account/starred-categories
  app.post(
    "/starred-categories",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { slug } = addStarredCategorySchema.parse(request.body);

      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up category ID from slug + platform
      const [catRow] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.slug, slug), eq(categories.platform, platform)))
        .limit(1);
      if (!catRow) {
        return reply.code(404).send({ error: "Category not found" });
      }

      const [result] = await db
        .insert(accountStarredCategories)
        .values({ accountId, categoryId: catRow.id })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply.code(409).send({ error: "Category already starred" });
      }

      return result;
    }
  );

  // DELETE /api/account/starred-categories/:slug
  app.delete<{ Params: { slug: string } }>(
    "/starred-categories/:slug",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up category ID from slug + platform
      const [delCatRow] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.slug, slug), eq(categories.platform, platform)))
        .limit(1);

      if (!delCatRow) {
        return reply.code(404).send({ error: "Category not found" });
      }

      const deleted = await db
        .delete(accountStarredCategories)
        .where(
          and(
            eq(accountStarredCategories.accountId, accountId),
            eq(accountStarredCategories.categoryId, delCatRow.id)
          )
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Starred category not found" });
      }

      return { message: "Category unstarred" };
    }
  );

  // --- Tracked Features ---

  // GET /api/account/starred-features
  app.get("/starred-features", async (request) => {
    const { accountId } = request.user;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    const rows = await db
      .select({
        featureHandle: accountTrackedFeatures.featureHandle,
        featureTitle: accountTrackedFeatures.featureTitle,
        createdAt: accountTrackedFeatures.createdAt,
      })
      .from(accountTrackedFeatures)
      .where(eq(accountTrackedFeatures.accountId, accountId));

    if (rows.length === 0) return rows;

    const handles = rows.map((r) => r.featureHandle);
    const handleList = sql.join(handles.map((h) => sql`${h}`), sql`,`);

    // Get tracked + competitor app IDs first (for scoped feature counting)
    const [trackedAppsRows, competitorAppsRows] = await Promise.all([
      db.select({ appId: accountTrackedApps.appId, appSlug: apps.slug })
        .from(accountTrackedApps)
        .innerJoin(apps, eq(apps.id, accountTrackedApps.appId))
        .where(eq(accountTrackedApps.accountId, accountId)),
      db.select({ appId: accountCompetitorApps.competitorAppId, appSlug: apps.slug })
        .from(accountCompetitorApps)
        .innerJoin(apps, eq(apps.id, accountCompetitorApps.competitorAppId))
        .where(eq(accountCompetitorApps.accountId, accountId)),
    ]);
    const trackedSet = new Set(trackedAppsRows.map((a) => a.appSlug));
    const competitorSet = new Set(competitorAppsRows.map((a) => a.appSlug));

    // Get category info + app slugs per feature — platform-filtered, LATERAL join
    // avoids cartesian explosion by only expanding features for matching apps
    const enrichResult = await db.execute(sql`
      SELECT
        f->>'feature_handle' AS handle,
        cat->>'title' AS category_title,
        sub->>'title' AS subcategory_title,
        a.slug AS app_slug
      FROM (
        SELECT DISTINCT ON (s.app_id) s.id, s.app_id, s.categories
        FROM app_snapshots s
        INNER JOIN apps a2 ON a2.id = s.app_id AND a2.platform = ${platform}
        ORDER BY s.app_id, s.scraped_at DESC
      ) s
      INNER JOIN apps a ON a.id = s.app_id,
      jsonb_array_elements(s.categories) AS cat,
      jsonb_array_elements(cat->'subcategories') AS sub,
      jsonb_array_elements(sub->'features') AS f
      WHERE f->>'feature_handle' IN (${handleList})
    `);
    const enrichRows: any[] = (enrichResult as any).rows ?? enrichResult;

    // Build category map (first match per handle) and app slugs per feature
    const catMap = new Map<string, { category_title: string; subcategory_title: string }>();
    const featureAppsMap = new Map<string, Set<string>>();
    for (const r of enrichRows) {
      if (!catMap.has(r.handle)) {
        catMap.set(r.handle, { category_title: r.category_title, subcategory_title: r.subcategory_title });
      }
      if (!featureAppsMap.has(r.handle)) featureAppsMap.set(r.handle, new Set());
      featureAppsMap.get(r.handle)!.add(r.app_slug);
    }

    return rows.map((r) => {
      const cat = catMap.get(r.featureHandle);
      const appSlugs = featureAppsMap.get(r.featureHandle) ?? new Set<string>();
      const trackedInFeature = [...appSlugs].filter((s) => trackedSet.has(s)).length;
      const competitorInFeature = [...appSlugs].filter((s) => competitorSet.has(s)).length;
      return {
        ...r,
        categoryTitle: cat?.category_title || null,
        subcategoryTitle: cat?.subcategory_title || null,
        appCount: appSlugs.size,
        trackedInFeature,
        competitorInFeature,
      };
    });
  });

  // POST /api/account/starred-features
  app.post(
    "/starred-features",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { handle, title } = addStarredFeatureSchema.parse(request.body);

      const [result] = await db
        .insert(accountTrackedFeatures)
        .values({
          accountId,
          featureHandle: handle,
          featureTitle: title,
        })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply.code(409).send({ error: "Feature already starred" });
      }

      return result;
    }
  );

  // DELETE /api/account/starred-features/:handle
  app.delete<{ Params: { handle: string } }>(
    "/starred-features/:handle",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { handle } = request.params;

      const deleted = await db
        .delete(accountTrackedFeatures)
        .where(
          and(
            eq(accountTrackedFeatures.accountId, accountId),
            eq(accountTrackedFeatures.featureHandle, handle)
          )
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Starred feature not found" });
      }

      return { message: "Feature unstarred" };
    }
  );

  // -- Keyword Tags --

  const TAG_COLORS = [
    "red",
    "orange",
    "amber",
    "emerald",
    "cyan",
    "blue",
    "violet",
    "pink",
    "slate",
    "rose",
  ];

  // GET /api/account/keyword-tags
  app.get("/keyword-tags", async (request) => {
    const { accountId } = request.user;
    return db
      .select()
      .from(keywordTags)
      .where(eq(keywordTags.accountId, accountId))
      .orderBy(keywordTags.name);
  });

  // POST /api/account/keyword-tags
  app.post(
    "/keyword-tags",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { name, color } = createKeywordTagSchema.parse(request.body);

      try {
        const [result] = await db
          .insert(keywordTags)
          .values({ accountId, name: name.trim(), color })
          .returning();
        return result;
      } catch (err: any) {
        if (err.code === "23505") {
          return reply
            .code(409)
            .send({ error: "Tag name already exists" });
        }
        throw err;
      }
    }
  );

  // PATCH /api/account/keyword-tags/:id
  app.patch<{ Params: { id: string } }>(
    "/keyword-tags/:id",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;
      const { color, name } = updateKeywordTagSchema.parse(request.body);

      const updates: Record<string, any> = {};
      if (color) {
        updates.color = color;
      }
      if (name?.trim()) {
        updates.name = name.trim();
      }

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: "Nothing to update" });
      }

      const [updated] = await db
        .update(keywordTags)
        .set(updates)
        .where(
          and(eq(keywordTags.id, id), eq(keywordTags.accountId, accountId))
        )
        .returning();

      if (!updated) {
        return reply.code(404).send({ error: "Tag not found" });
      }
      return updated;
    }
  );

  // DELETE /api/account/keyword-tags/:id
  app.delete<{ Params: { id: string } }>(
    "/keyword-tags/:id",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;

      const deleted = await db
        .delete(keywordTags)
        .where(
          and(eq(keywordTags.id, id), eq(keywordTags.accountId, accountId))
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Tag not found" });
      }
      return { message: "Tag deleted" };
    }
  );

  // POST /api/account/keyword-tags/:id/keywords/:keywordId — assign tag
  app.post<{ Params: { id: string; keywordId: string } }>(
    "/keyword-tags/:id/keywords/:keywordId",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id: tagId, keywordId } = request.params;

      // Verify tag belongs to account
      const [tag] = await db
        .select({ id: keywordTags.id })
        .from(keywordTags)
        .where(
          and(eq(keywordTags.id, tagId), eq(keywordTags.accountId, accountId))
        );
      if (!tag) {
        return reply.code(404).send({ error: "Tag not found" });
      }

      try {
        const [result] = await db
          .insert(keywordTagAssignments)
          .values({ tagId, keywordId: parseInt(keywordId, 10) })
          .returning();
        return result;
      } catch (err: any) {
        if (err.code === "23505") {
          return reply.code(409).send({ error: "Tag already assigned" });
        }
        throw err;
      }
    }
  );

  // DELETE /api/account/keyword-tags/:id/keywords/:keywordId — unassign tag
  app.delete<{ Params: { id: string; keywordId: string } }>(
    "/keyword-tags/:id/keywords/:keywordId",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id: tagId, keywordId } = request.params;

      // Verify tag belongs to account
      const [tag] = await db
        .select({ id: keywordTags.id })
        .from(keywordTags)
        .where(
          and(eq(keywordTags.id, tagId), eq(keywordTags.accountId, accountId))
        );
      if (!tag) {
        return reply.code(404).send({ error: "Tag not found" });
      }

      const deleted = await db
        .delete(keywordTagAssignments)
        .where(
          and(
            eq(keywordTagAssignments.tagId, tagId),
            eq(
              keywordTagAssignments.keywordId,
              parseInt(keywordId, 10)
            )
          )
        )
        .returning();

      if (deleted.length === 0) {
        return reply
          .code(404)
          .send({ error: "Assignment not found" });
      }
      return { message: "Tag removed from keyword" };
    }
  );

  // NOTE: Platform enable/disable is system-admin only (via /api/system-admin/accounts/:id/platforms).
  // Regular users cannot enable or disable platforms for their account.

  // POST /api/account/platform-requests — submit a platform request
  app.post<{ Body: { platformName: string; marketplaceUrl?: string; notes?: string } }>(
    "/platform-requests",
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const { platformName, marketplaceUrl, notes } = platformRequestSchema.parse(request.body);

      const [row] = await db
        .insert(platformRequests)
        .values({
          accountId,
          userId,
          platformName: platformName.trim(),
          marketplaceUrl: marketplaceUrl?.trim() || null,
          notes: notes?.trim() || null,
        })
        .returning();

      return { message: "Platform request submitted", id: row.id };
    }
  );

  // ── Starred Developers ──────────────────────────────────────────

  // GET /api/account/starred-developers
  app.get("/starred-developers", async (request) => {
    const { accountId } = request.user;

    const rows = await db
      .select({
        id: accountStarredDevelopers.id,
        globalDeveloperId: accountStarredDevelopers.globalDeveloperId,
        createdAt: accountStarredDevelopers.createdAt,
        name: globalDevelopers.name,
        slug: globalDevelopers.slug,
        website: globalDevelopers.website,
        logoUrl: globalDevelopers.logoUrl,
        totalApps: globalDevelopers.totalApps,
        totalReviews: globalDevelopers.totalReviews,
        avgRating: globalDevelopers.avgRating,
        platformsActive: globalDevelopers.platformsActive,
      })
      .from(accountStarredDevelopers)
      .innerJoin(
        globalDevelopers,
        eq(accountStarredDevelopers.globalDeveloperId, globalDevelopers.id)
      )
      .where(eq(accountStarredDevelopers.accountId, accountId))
      .orderBy(desc(accountStarredDevelopers.createdAt));

    return rows;
  });

  // POST /api/account/starred-developers/:id
  app.post<{ Params: { id: string } }>(
    "/starred-developers/:id",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const globalDeveloperId = parseInt(request.params.id, 10);

      if (isNaN(globalDeveloperId)) {
        return reply.code(400).send({ error: "Invalid developer ID" });
      }

      // Verify developer exists
      const [dev] = await db
        .select({ id: globalDevelopers.id })
        .from(globalDevelopers)
        .where(eq(globalDevelopers.id, globalDeveloperId))
        .limit(1);

      if (!dev) {
        return reply.code(404).send({ error: "Developer not found" });
      }

      const [result] = await db
        .insert(accountStarredDevelopers)
        .values({ accountId, globalDeveloperId })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply.code(409).send({ error: "Developer already starred" });
      }

      return result;
    }
  );

  // DELETE /api/account/starred-developers/:id
  app.delete<{ Params: { id: string } }>(
    "/starred-developers/:id",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const globalDeveloperId = parseInt(request.params.id, 10);

      if (isNaN(globalDeveloperId)) {
        return reply.code(400).send({ error: "Invalid developer ID" });
      }

      const deleted = await db
        .delete(accountStarredDevelopers)
        .where(
          and(
            eq(accountStarredDevelopers.accountId, accountId),
            eq(accountStarredDevelopers.globalDeveloperId, globalDeveloperId)
          )
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Starred developer not found" });
      }

      return { message: "Developer unstarred" };
    }
  );

  // GET /api/account/platforms — list enabled platforms for account
  app.get("/platforms", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });
    const rows = await db
      .select({ platform: accountPlatforms.platform })
      .from(accountPlatforms)
      .where(eq(accountPlatforms.accountId, request.user.accountId));
    return { platforms: rows.map((r) => r.platform) };
  });

  // POST /api/account/platforms/:platform — enable a platform
  app.post("/platforms/:platform", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });
    if (request.user.role !== "owner") return reply.code(403).send({ error: "Only owners can manage platforms" });
    const { platform } = request.params as { platform: string };

    // Check maxPlatforms limit
    const [account] = await db.select({ maxPlatforms: accounts.maxPlatforms }).from(accounts).where(eq(accounts.id, request.user.accountId));
    const [count] = await db.select({ count: sql<number>`count(*)::int` }).from(accountPlatforms).where(eq(accountPlatforms.accountId, request.user.accountId));
    if (count.count >= account.maxPlatforms) {
      return reply.code(403).send({ error: "Platform limit reached", code: "PLAN_LIMIT_REACHED", max: account.maxPlatforms, current: count.count });
    }

    await db.insert(accountPlatforms)
      .values({ accountId: request.user.accountId, platform })
      .onConflictDoNothing();
    import("../utils/activity-log.js").then(m => m.logActivity(db, request.user.accountId, request.user.userId, "platform_enabled", "platform", platform, { platform })).catch(() => {});
    return { message: `Platform ${platform} enabled` };
  });

  // DELETE /api/account/platforms/:platform — disable a platform
  app.delete("/platforms/:platform", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });
    if (request.user.role !== "owner") return reply.code(403).send({ error: "Only owners can manage platforms" });
    const { platform } = request.params as { platform: string };
    await db.delete(accountPlatforms)
      .where(and(eq(accountPlatforms.accountId, request.user.accountId), eq(accountPlatforms.platform, platform)));
    import("../utils/activity-log.js").then(m => m.logActivity(db, request.user.accountId, request.user.userId, "platform_disabled", "platform", platform, { platform })).catch(() => {});
    return { message: `Platform ${platform} disabled` };
  });

  // POST /api/account/refresh-app/:slug — trigger a manual scrape for a tracked app
  app.post("/refresh-app/:slug", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });
    const { slug } = request.params as { slug: string };

    // Verify app is tracked by this account
    const [tracked] = await db
      .select({ appId: accountTrackedApps.appId })
      .from(accountTrackedApps)
      .innerJoin(apps, eq(apps.id, accountTrackedApps.appId))
      .where(and(
        eq(accountTrackedApps.accountId, request.user.accountId),
        eq(apps.slug, slug),
      ))
      .limit(1);

    if (!tracked) {
      return reply.code(404).send({ error: "App not tracked or not found" });
    }

    // Enqueue interactive scrape job
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const parsed = new URL(redisUrl);
    const { Queue } = await import("bullmq");
    const queue = new Queue("scraper-jobs-interactive", {
      connection: { host: parsed.hostname, port: parseInt(parsed.port || "6379"), password: parsed.password || undefined },
    });

    try {
      const [appRow] = await db.select({ platform: apps.platform }).from(apps).where(eq(apps.slug, slug)).limit(1);
      const job = await queue.add("scrape:app_details", {
        type: "app_details",
        slug,
        platform: appRow.platform,
        triggeredBy: "user",
      }, { attempts: 2, backoff: { type: "exponential", delay: 30_000 } });

      return { message: "Scrape queued", jobId: job.id };
    } finally {
      await queue.close();
    }
  });
};
