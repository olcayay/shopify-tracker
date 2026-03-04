import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and, inArray, desc, asc, isNotNull } from "drizzle-orm";
import { Queue } from "bullmq";
import {
  createDb,
  apps,
  appSnapshots,
  trackedKeywords,
  keywordSnapshots,
  keywordToSlug,
  appKeywordRankings,
  appCategoryRankings,
  researchProjects,
  researchProjectKeywords,
  researchProjectCompetitors,
  appPowerScores,
  users,
  categories as categoriesTable,
  categorySnapshots,
  featuredAppSightings,
  similarAppSightings,
} from "@shopify-tracking/db";
import {
  extractKeywordsFromAppMetadata,
  computeKeywordOpportunity,
} from "@shopify-tracking/shared";
import { requireRole } from "../middleware/authorize.js";

const INTERACTIVE_QUEUE_NAME = "scraper-jobs-interactive";

function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
  };
}

let scraperQueue: Queue | null = null;

function getScraperQueue(): Queue {
  if (!scraperQueue) {
    scraperQueue = new Queue(INTERACTIVE_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return scraperQueue;
}

function getMinPaidPrice(plans: any[] | null | undefined): number | null {
  if (!plans || plans.length === 0) return null;
  const prices = plans
    .filter((p: any) => p.price != null && parseFloat(p.price) > 0)
    .map((p: any) => parseFloat(p.price));
  return prices.length > 0 ? Math.min(...prices) : null;
}

type Db = ReturnType<typeof createDb>;

export const researchRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // ─── Project CRUD ──────────────────────────────────────────

  // GET /api/research-projects — list projects for account
  app.get("/", async (request) => {
    const { accountId } = request.user;

    const projects = await db
      .select({
        id: researchProjects.id,
        accountId: researchProjects.accountId,
        name: researchProjects.name,
        createdBy: researchProjects.createdBy,
        createdAt: researchProjects.createdAt,
        updatedAt: researchProjects.updatedAt,
        creatorName: users.name,
      })
      .from(researchProjects)
      .leftJoin(users, eq(researchProjects.createdBy, users.id))
      .where(eq(researchProjects.accountId, accountId))
      .orderBy(desc(researchProjects.updatedAt));

    // Get keyword + competitor counts per project
    const projectIds = projects.map((p) => p.id);
    if (projectIds.length === 0) return [];

    const kwCounts = await db
      .select({
        projectId: researchProjectKeywords.researchProjectId,
        count: sql<number>`count(*)::int`,
      })
      .from(researchProjectKeywords)
      .where(inArray(researchProjectKeywords.researchProjectId, projectIds))
      .groupBy(researchProjectKeywords.researchProjectId);

    const compCounts = await db
      .select({
        projectId: researchProjectCompetitors.researchProjectId,
        count: sql<number>`count(*)::int`,
      })
      .from(researchProjectCompetitors)
      .where(inArray(researchProjectCompetitors.researchProjectId, projectIds))
      .groupBy(researchProjectCompetitors.researchProjectId);

    // Get competitor app stats per project using lateral join for latest snapshot
    const compStats = await db.execute<{
      projectId: string; avgRating: number | null; avgReviews: number | null;
      minPrice: number | null; maxPrice: number | null;
    }>(sql`
      SELECT
        rpc.research_project_id AS "projectId",
        round(avg(ls.average_rating)::numeric, 1) AS "avgRating",
        round(avg(ls.rating_count))::int AS "avgReviews",
        min(ls.min_paid) AS "minPrice",
        max(ls.min_paid) AS "maxPrice"
      FROM research_project_competitors rpc
      CROSS JOIN LATERAL (
        SELECT s.average_rating, s.rating_count,
          (SELECT min((plan->>'price')::numeric)
           FROM jsonb_array_elements(
             CASE WHEN s.pricing_plans IS NOT NULL AND jsonb_typeof(s.pricing_plans) = 'array'
                  THEN s.pricing_plans ELSE '[]'::jsonb END
           ) AS plan
           WHERE plan->>'price' IS NOT NULL
             AND (plan->>'price') ~ '^\d+(\.\d+)?$'
             AND (plan->>'price')::numeric > 0
          ) AS min_paid
        FROM app_snapshots s
        WHERE s.app_slug = rpc.app_slug
        ORDER BY s.scraped_at DESC LIMIT 1
      ) ls
      WHERE rpc.research_project_id IN (${sql.join(projectIds.map((id) => sql`${id}`), sql`, `)})
      GROUP BY rpc.research_project_id
    `);

    const powerStats = await db.execute<{
      projectId: string; avgPower: number | null; maxPower: number | null;
    }>(sql`
      SELECT
        rpc.research_project_id AS "projectId",
        round(avg(ps.power_score))::int AS "avgPower",
        max(ps.power_score)::int AS "maxPower"
      FROM research_project_competitors rpc
      INNER JOIN LATERAL (
        SELECT p.power_score FROM app_power_scores p
        WHERE p.app_slug = rpc.app_slug
        ORDER BY p.computed_at DESC LIMIT 1
      ) ps ON true
      WHERE rpc.research_project_id IN (${sql.join(projectIds.map((id) => sql`${id}`), sql`, `)})
      GROUP BY rpc.research_project_id
    `);

    const kwMap = Object.fromEntries(kwCounts.map((r) => [r.projectId, r.count]));
    const compMap = Object.fromEntries(compCounts.map((r) => [r.projectId, r.count]));
    const statsMap = Object.fromEntries([...compStats].map((r: any) => [r.projectId, r]));
    const powerMap = Object.fromEntries([...powerStats].map((r: any) => [r.projectId, r]));

    return projects.map((p) => {
      const stats = statsMap[p.id];
      const power = powerMap[p.id];
      return {
        ...p,
        keywordCount: kwMap[p.id] || 0,
        competitorCount: compMap[p.id] || 0,
        avgRating: stats?.avgRating ? Number(Number(stats.avgRating).toFixed(1)) : null,
        avgReviews: stats?.avgReviews ?? null,
        minPrice: stats?.minPrice ? Number(stats.minPrice) : null,
        maxPrice: stats?.maxPrice ? Number(stats.maxPrice) : null,
        avgPower: power?.avgPower ?? null,
        maxPower: power?.maxPower ?? null,
      };
    });
  });

  // POST /api/research-projects — create project
  app.post<{ Body: { name?: string } }>(
    "/",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const { name } = request.body || {};

      const [project] = await db
        .insert(researchProjects)
        .values({
          accountId,
          name: name || "Untitled Research",
          createdBy: userId,
        })
        .returning();

      return reply.code(201).send(project);
    }
  );

  // PATCH /api/research-projects/:id — rename project
  app.patch<{ Params: { id: string }; Body: { name: string } }>(
    "/:id",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;
      const { name } = request.body;

      if (!name?.trim()) {
        return reply.code(400).send({ error: "Name is required" });
      }

      const [updated] = await db
        .update(researchProjects)
        .set({ name: name.trim(), updatedAt: new Date() })
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)))
        .returning();

      if (!updated) {
        return reply.code(404).send({ error: "Project not found" });
      }
      return updated;
    }
  );

  // DELETE /api/research-projects/:id
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;

      const [deleted] = await db
        .delete(researchProjects)
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)))
        .returning();

      if (!deleted) {
        return reply.code(404).send({ error: "Project not found" });
      }
      return { ok: true };
    }
  );

  // ─── Keywords ──────────────────────────────────────────────

  // POST /api/research-projects/:id/keywords — add keyword
  app.post<{ Params: { id: string }; Body: { keyword: string } }>(
    "/:id/keywords",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;
      const { keyword } = request.body;

      if (!keyword?.trim()) {
        return reply.code(400).send({ error: "Keyword is required" });
      }

      // Verify project belongs to account
      const [project] = await db
        .select({ id: researchProjects.id })
        .from(researchProjects)
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));

      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      // Ensure keyword exists globally (insert or reactivate)
      const slug = keywordToSlug(keyword.trim());
      const [kw] = await db
        .insert(trackedKeywords)
        .values({ keyword: keyword.trim().toLowerCase(), slug })
        .onConflictDoUpdate({
          target: trackedKeywords.keyword,
          set: { isActive: true, updatedAt: new Date() },
        })
        .returning();

      // Add to project
      const [result] = await db
        .insert(researchProjectKeywords)
        .values({ researchProjectId: id, keywordId: kw.id })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply.code(409).send({ error: "Keyword already in project" });
      }

      // Update project timestamp
      await db
        .update(researchProjects)
        .set({ updatedAt: new Date() })
        .where(eq(researchProjects.id, id));

      // Check if keyword needs scraping
      let scraperEnqueued = false;
      const [existingSnapshot] = await db
        .select({ id: keywordSnapshots.id })
        .from(keywordSnapshots)
        .where(eq(keywordSnapshots.keywordId, kw.id))
        .limit(1);

      if (!existingSnapshot) {
        try {
          const queue = getScraperQueue();
          await queue.add("scrape:keyword_search", {
            type: "keyword_search",
            keyword: kw.keyword,
            triggeredBy: "api:research",
          });
          scraperEnqueued = true;
        } catch {
          // Redis unavailable
        }
      }

      return reply.code(201).send({
        ...result,
        keyword: kw.keyword,
        keywordId: kw.id,
        slug: kw.slug,
        scraperEnqueued,
      });
    }
  );

  // DELETE /api/research-projects/:id/keywords/:kwId
  app.delete<{ Params: { id: string; kwId: string } }>(
    "/:id/keywords/:kwId",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id, kwId } = request.params;

      // Verify project belongs to account
      const [project] = await db
        .select({ id: researchProjects.id })
        .from(researchProjects)
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));

      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      const keywordId = parseInt(kwId, 10);
      if (isNaN(keywordId)) {
        return reply.code(400).send({ error: "Invalid keyword ID" });
      }

      const [deleted] = await db
        .delete(researchProjectKeywords)
        .where(
          and(
            eq(researchProjectKeywords.researchProjectId, id),
            eq(researchProjectKeywords.keywordId, keywordId)
          )
        )
        .returning();

      if (!deleted) {
        return reply.code(404).send({ error: "Keyword not in project" });
      }

      await db
        .update(researchProjects)
        .set({ updatedAt: new Date() })
        .where(eq(researchProjects.id, id));

      return { ok: true };
    }
  );

  // ─── Competitors ───────────────────────────────────────────

  // POST /api/research-projects/:id/competitors — add competitor
  app.post<{ Params: { id: string }; Body: { slug: string } }>(
    "/:id/competitors",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;
      const { slug } = request.body;

      if (!slug?.trim()) {
        return reply.code(400).send({ error: "App slug is required" });
      }

      // Verify project belongs to account
      const [project] = await db
        .select({ id: researchProjects.id })
        .from(researchProjects)
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));

      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      // Verify app exists
      const [existingApp] = await db
        .select({ slug: apps.slug })
        .from(apps)
        .where(eq(apps.slug, slug.trim()));

      if (!existingApp) {
        return reply.code(404).send({ error: "App not found" });
      }

      // Get next sort order
      const [{ maxOrder }] = await db
        .select({ maxOrder: sql<number>`coalesce(max(sort_order), -1)::int` })
        .from(researchProjectCompetitors)
        .where(eq(researchProjectCompetitors.researchProjectId, id));

      // Add to project
      const [result] = await db
        .insert(researchProjectCompetitors)
        .values({
          researchProjectId: id,
          appSlug: slug.trim(),
          sortOrder: maxOrder + 1,
        })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply.code(409).send({ error: "Competitor already in project" });
      }

      // Mark app as tracked so scraper picks it up
      await db
        .update(apps)
        .set({ isTracked: true, updatedAt: new Date() })
        .where(eq(apps.slug, slug.trim()));

      // Update project timestamp
      await db
        .update(researchProjects)
        .set({ updatedAt: new Date() })
        .where(eq(researchProjects.id, id));

      // Enqueue scrape if no snapshot exists
      let scraperEnqueued = false;
      const [existingSnapshot] = await db
        .select({ id: appSnapshots.id })
        .from(appSnapshots)
        .where(eq(appSnapshots.appSlug, slug.trim()))
        .limit(1);

      if (!existingSnapshot) {
        try {
          const queue = getScraperQueue();
          await queue.add("scrape:app_details", {
            type: "app_details",
            slug: slug.trim(),
            triggeredBy: "api:research",
          });
          await queue.add("scrape:reviews", {
            type: "reviews",
            slug: slug.trim(),
            triggeredBy: "api:research",
          });
          scraperEnqueued = true;
        } catch {
          // Redis unavailable
        }
      }

      return reply.code(201).send({ ...result, scraperEnqueued });
    }
  );

  // DELETE /api/research-projects/:id/competitors/:slug
  app.delete<{ Params: { id: string; slug: string } }>(
    "/:id/competitors/:slug",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id, slug } = request.params;

      // Verify project belongs to account
      const [project] = await db
        .select({ id: researchProjects.id })
        .from(researchProjects)
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));

      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      const [deleted] = await db
        .delete(researchProjectCompetitors)
        .where(
          and(
            eq(researchProjectCompetitors.researchProjectId, id),
            eq(researchProjectCompetitors.appSlug, slug)
          )
        )
        .returning();

      if (!deleted) {
        return reply.code(404).send({ error: "Competitor not in project" });
      }

      await db
        .update(researchProjects)
        .set({ updatedAt: new Date() })
        .where(eq(researchProjects.id, id));

      return { ok: true };
    }
  );

  // ─── Data Endpoint (single fetch) ─────────────────────────

  // GET /api/research-projects/:id/data — everything the frontend needs
  app.get<{ Params: { id: string } }>("/:id/data", async (request, reply) => {
    const { accountId } = request.user;
    const { id } = request.params;

    // 1. Verify project
    const [project] = await db
      .select()
      .from(researchProjects)
      .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));

    if (!project) {
      return reply.code(404).send({ error: "Project not found" });
    }

    // 2. Get project keywords
    const projectKeywordRows = await db
      .select({
        rpkId: researchProjectKeywords.id,
        keywordId: trackedKeywords.id,
        keyword: trackedKeywords.keyword,
        slug: trackedKeywords.slug,
      })
      .from(researchProjectKeywords)
      .innerJoin(trackedKeywords, eq(researchProjectKeywords.keywordId, trackedKeywords.id))
      .where(eq(researchProjectKeywords.researchProjectId, id))
      .orderBy(asc(researchProjectKeywords.createdAt));

    const keywordIds = projectKeywordRows.map((k) => k.keywordId);

    // 3. Get latest keyword snapshots for totalResults
    let keywordData: any[] = [];
    if (keywordIds.length > 0) {
      const latestSnapshots = await db
        .select({
          keywordId: keywordSnapshots.keywordId,
          totalResults: keywordSnapshots.totalResults,
          scrapedAt: keywordSnapshots.scrapedAt,
        })
        .from(keywordSnapshots)
        .where(
          and(
            inArray(keywordSnapshots.keywordId, keywordIds),
            eq(
              keywordSnapshots.id,
              db
                .select({ id: sql<number>`max(${keywordSnapshots.id})` })
                .from(keywordSnapshots)
                .where(eq(keywordSnapshots.keywordId, keywordSnapshots.keywordId))
            )
          )
        );

      // Simpler approach: get latest per keyword
      const snapshotMap = new Map<number, { totalResults: number | null; scrapedAt: Date }>();
      for (const kwId of keywordIds) {
        const [snap] = await db
          .select({
            totalResults: keywordSnapshots.totalResults,
            scrapedAt: keywordSnapshots.scrapedAt,
          })
          .from(keywordSnapshots)
          .where(eq(keywordSnapshots.keywordId, kwId))
          .orderBy(desc(keywordSnapshots.scrapedAt))
          .limit(1);
        if (snap) snapshotMap.set(kwId, snap);
      }

      keywordData = projectKeywordRows.map((k) => {
        const snap = snapshotMap.get(k.keywordId);
        return {
          id: k.keywordId,
          keyword: k.keyword,
          slug: k.slug,
          totalResults: snap?.totalResults ?? null,
          scrapedAt: snap?.scrapedAt ?? null,
        };
      });
    }

    // 4. Get project competitors
    const projectCompRows = await db
      .select({
        rpcId: researchProjectCompetitors.id,
        appSlug: researchProjectCompetitors.appSlug,
        sortOrder: researchProjectCompetitors.sortOrder,
      })
      .from(researchProjectCompetitors)
      .where(eq(researchProjectCompetitors.researchProjectId, id))
      .orderBy(asc(researchProjectCompetitors.sortOrder));

    const competitorSlugs = projectCompRows.map((c) => c.appSlug);

    // 5. Enrich competitors with app data + latest snapshot
    let competitorData: any[] = [];
    if (competitorSlugs.length > 0) {
      const appRows = await db
        .select({
          slug: apps.slug,
          name: apps.name,
          iconUrl: apps.iconUrl,
          averageRating: apps.averageRating,
          ratingCount: apps.ratingCount,
          pricingHint: apps.pricingHint,
          launchedDate: apps.launchedDate,
        })
        .from(apps)
        .where(inArray(apps.slug, competitorSlugs));

      const appMap = new Map(appRows.map((a) => [a.slug, a]));

      // Get latest snapshot per competitor for categories + pricing plans
      const snapshotMap = new Map<string, any>();
      for (const slug of competitorSlugs) {
        const [snap] = await db
          .select({
            categories: appSnapshots.categories,
            pricingPlans: appSnapshots.pricingPlans,
            features: appSnapshots.features,
            appIntroduction: appSnapshots.appIntroduction,
            appDetails: appSnapshots.appDetails,
          })
          .from(appSnapshots)
          .where(eq(appSnapshots.appSlug, slug))
          .orderBy(desc(appSnapshots.scrapedAt))
          .limit(1);
        if (snap) snapshotMap.set(slug, snap);
      }

      // Get latest power scores per competitor
      const powerMap = new Map<string, number>();
      for (const slug of competitorSlugs) {
        const [score] = await db
          .select({ powerScore: appPowerScores.powerScore })
          .from(appPowerScores)
          .where(eq(appPowerScores.appSlug, slug))
          .orderBy(desc(appPowerScores.computedAt))
          .limit(1);
        if (score) powerMap.set(slug, score.powerScore);
      }

      // Get category rankings per competitor
      const compCatRankings = await db
        .select({
          appSlug: appCategoryRankings.appSlug,
          categorySlug: appCategoryRankings.categorySlug,
          position: appCategoryRankings.position,
          scrapedAt: appCategoryRankings.scrapedAt,
        })
        .from(appCategoryRankings)
        .where(inArray(appCategoryRankings.appSlug, competitorSlugs))
        .orderBy(desc(appCategoryRankings.scrapedAt));

      // Latest per (app, category)
      const compLatestCatRank = new Map<string, { categorySlug: string; position: number }[]>();
      const seenCompCatKeys = new Set<string>();
      for (const r of compCatRankings) {
        const key = `${r.appSlug}:${r.categorySlug}`;
        if (seenCompCatKeys.has(key)) continue;
        seenCompCatKeys.add(key);
        if (!compLatestCatRank.has(r.appSlug)) compLatestCatRank.set(r.appSlug, []);
        compLatestCatRank.get(r.appSlug)!.push({ categorySlug: r.categorySlug, position: r.position });
      }

      // Collect all unique category slugs from rankings
      const allRankedCatSlugs = new Set<string>();
      for (const ranks of compLatestCatRank.values()) {
        for (const r of ranks) allRankedCatSlugs.add(r.categorySlug);
      }

      // Fetch category metadata (title, parentSlug, level) + build hierarchy
      const catMetaMap = new Map<string, { title: string; parentSlug: string | null; level: number }>();
      if (allRankedCatSlugs.size > 0) {
        const catRows = await db
          .select({
            slug: categoriesTable.slug,
            title: categoriesTable.title,
            parentSlug: categoriesTable.parentSlug,
            level: categoriesTable.categoryLevel,
          })
          .from(categoriesTable);
        for (const c of catRows) {
          catMetaMap.set(c.slug, { title: c.title, parentSlug: c.parentSlug, level: c.level });
        }
      }

      // Fetch latest appCount per category from category_snapshots
      const catAppCountMap = new Map<string, number>();
      if (allRankedCatSlugs.size > 0) {
        const appCountRows = await db
          .select({
            categorySlug: categorySnapshots.categorySlug,
            appCount: categorySnapshots.appCount,
          })
          .from(categorySnapshots)
          .where(inArray(categorySnapshots.categorySlug, Array.from(allRankedCatSlugs)))
          .orderBy(desc(categorySnapshots.scrapedAt));

        for (const r of appCountRows) {
          if (!catAppCountMap.has(r.categorySlug) && r.appCount != null) {
            catAppCountMap.set(r.categorySlug, r.appCount);
          }
        }
      }

      // Build breadcrumb path for a category
      function buildBreadcrumb(slug: string): string {
        const parts: string[] = [];
        let current = slug;
        while (current) {
          const meta = catMetaMap.get(current);
          if (!meta) break;
          parts.unshift(meta.title);
          current = meta.parentSlug || "";
        }
        return parts.join(" > ");
      }

      // Identify leaf categories: categories that are NOT a parent of another ranked category
      function isLeafAmongRanked(slug: string, allSlugs: string[]): boolean {
        return !allSlugs.some((s) => s !== slug && catMetaMap.get(s)?.parentSlug === slug);
      }

      // Featured section counts (last 30 days)
      const featuredSince = new Date();
      featuredSince.setDate(featuredSince.getDate() - 30);
      const featuredSinceStr = featuredSince.toISOString().slice(0, 10);
      const featuredCounts = await db
        .select({
          appSlug: featuredAppSightings.appSlug,
          sectionCount: sql<number>`count(distinct ${featuredAppSightings.surface} || ':' || ${featuredAppSightings.surfaceDetail} || ':' || ${featuredAppSightings.sectionHandle})`,
        })
        .from(featuredAppSightings)
        .where(
          and(
            inArray(featuredAppSightings.appSlug, competitorSlugs),
            sql`${featuredAppSightings.seenDate} >= ${featuredSinceStr}`
          )
        )
        .groupBy(featuredAppSightings.appSlug);
      const featuredMap = new Map(featuredCounts.map((r) => [r.appSlug, r.sectionCount]));

      // Reverse similar counts (how many apps list this competitor as similar)
      const similarCounts = await db
        .select({
          similarAppSlug: similarAppSightings.similarAppSlug,
          count: sql<number>`count(distinct ${similarAppSightings.appSlug})::int`,
        })
        .from(similarAppSightings)
        .where(inArray(similarAppSightings.similarAppSlug, competitorSlugs))
        .groupBy(similarAppSightings.similarAppSlug);
      const similarMap = new Map(similarCounts.map((r) => [r.similarAppSlug, r.count]));

      competitorData = projectCompRows.map((c) => {
        const appInfo = appMap.get(c.appSlug);
        const snap = snapshotMap.get(c.appSlug);
        const rawRanks = compLatestCatRank.get(c.appSlug) || [];
        const rankedSlugs = rawRanks.map((r) => r.categorySlug);
        const catRanks = rawRanks
          .filter((r) => isLeafAmongRanked(r.categorySlug, rankedSlugs))
          .sort((a, b) => a.position - b.position)
          .map((r) => ({
            slug: r.categorySlug,
            breadcrumb: buildBreadcrumb(r.categorySlug),
            position: r.position,
            totalApps: catAppCountMap.get(r.categorySlug) ?? null,
          }));
        return {
          slug: c.appSlug,
          name: appInfo?.name ?? c.appSlug,
          iconUrl: appInfo?.iconUrl ?? null,
          averageRating: appInfo?.averageRating ? parseFloat(appInfo.averageRating) : null,
          ratingCount: appInfo?.ratingCount ?? null,
          pricingHint: appInfo?.pricingHint ?? null,
          minPaidPrice: getMinPaidPrice(snap?.pricingPlans),
          powerScore: powerMap.get(c.appSlug) ?? null,
          categories: snap?.categories ?? [],
          categoryRankings: catRanks,
          features: snap?.features ?? [],
          launchedAt: appInfo?.launchedDate?.toISOString() ?? null,
          featuredSections: featuredMap.get(c.appSlug) ?? 0,
          reverseSimilarCount: similarMap.get(c.appSlug) ?? 0,
        };
      });
    }

    // 6. Keyword rankings matrix
    let keywordRankings: Record<string, Record<string, number>> = {};
    if (keywordIds.length > 0 && competitorSlugs.length > 0) {
      // Get latest rankings for project keywords x competitors
      for (const kw of projectKeywordRows) {
        const rankings = await db
          .select({
            appSlug: appKeywordRankings.appSlug,
            position: appKeywordRankings.position,
          })
          .from(appKeywordRankings)
          .where(
            and(
              eq(appKeywordRankings.keywordId, kw.keywordId),
              inArray(appKeywordRankings.appSlug, competitorSlugs),
              isNotNull(appKeywordRankings.position)
            )
          )
          .orderBy(desc(appKeywordRankings.scrapedAt))
          .limit(competitorSlugs.length * 2); // Get enough for latest per app

        // Pick latest per app
        const latestPerApp = new Map<string, number>();
        for (const r of rankings) {
          if (r.position != null && !latestPerApp.has(r.appSlug)) {
            latestPerApp.set(r.appSlug, r.position);
          }
        }
        if (latestPerApp.size > 0) {
          keywordRankings[kw.slug] = Object.fromEntries(latestPerApp);
        }
      }
    }

    // 7. Competitor suggestions (from keyword rankings)
    let competitorSuggestions: any[] = [];
    if (keywordIds.length > 0) {
      const suggestRows = await db
        .select({
          appSlug: appKeywordRankings.appSlug,
          matched: sql<number>`count(distinct ${appKeywordRankings.keywordId})::int`,
          avgPos: sql<number>`avg(${appKeywordRankings.position})::float`,
        })
        .from(appKeywordRankings)
        .where(
          and(
            inArray(appKeywordRankings.keywordId, keywordIds),
            isNotNull(appKeywordRankings.position)
          )
        )
        .groupBy(appKeywordRankings.appSlug)
        .orderBy(
          desc(sql`count(distinct ${appKeywordRankings.keywordId})`),
          asc(sql`avg(${appKeywordRankings.position})`)
        )
        .limit(30);

      // Filter out already-added competitors
      const existingSet = new Set(competitorSlugs);
      const filteredSuggestions = suggestRows.filter((r) => !existingSet.has(r.appSlug));

      if (filteredSuggestions.length > 0) {
        const slugsToEnrich = filteredSuggestions.map((r) => r.appSlug);
        const enrichedApps = await db
          .select({
            slug: apps.slug,
            name: apps.name,
            iconUrl: apps.iconUrl,
            averageRating: apps.averageRating,
            ratingCount: apps.ratingCount,
          })
          .from(apps)
          .where(inArray(apps.slug, slugsToEnrich));

        const enrichMap = new Map(enrichedApps.map((a) => [a.slug, a]));

        // Get which keywords each suggested app matches
        const matchDetails = await db
          .select({
            appSlug: appKeywordRankings.appSlug,
            keywordId: appKeywordRankings.keywordId,
          })
          .from(appKeywordRankings)
          .where(
            and(
              inArray(appKeywordRankings.appSlug, slugsToEnrich),
              inArray(appKeywordRankings.keywordId, keywordIds),
              isNotNull(appKeywordRankings.position)
            )
          );

        const kwIdToName = new Map(projectKeywordRows.map((k) => [k.keywordId, k.keyword]));
        const matchesByApp = new Map<string, Set<string>>();
        for (const m of matchDetails) {
          if (!matchesByApp.has(m.appSlug)) matchesByApp.set(m.appSlug, new Set());
          const kwName = kwIdToName.get(m.keywordId);
          if (kwName) matchesByApp.get(m.appSlug)!.add(kwName);
        }

        competitorSuggestions = filteredSuggestions.slice(0, 20).map((r) => {
          const appInfo = enrichMap.get(r.appSlug);
          return {
            slug: r.appSlug,
            name: appInfo?.name ?? r.appSlug,
            iconUrl: appInfo?.iconUrl ?? null,
            averageRating: appInfo?.averageRating ? parseFloat(appInfo.averageRating) : null,
            ratingCount: appInfo?.ratingCount ?? null,
            matchedKeywords: Array.from(matchesByApp.get(r.appSlug) ?? []),
            matchedCount: r.matched,
            avgPosition: Math.round(r.avgPos),
          };
        });
      }
    }

    // 8. Keyword suggestions (from competitor rankings + metadata)
    let keywordSuggestions: any[] = [];
    if (competitorSlugs.length > 0) {
      const existingKeywordIds = new Set(keywordIds);

      // Source A: Keywords that competitors rank for
      const rankingSuggestions = await db
        .select({
          keywordId: appKeywordRankings.keywordId,
          keyword: trackedKeywords.keyword,
          slug: trackedKeywords.slug,
          compCount: sql<number>`count(distinct ${appKeywordRankings.appSlug})::int`,
          bestPos: sql<number>`min(${appKeywordRankings.position})::int`,
        })
        .from(appKeywordRankings)
        .innerJoin(trackedKeywords, eq(trackedKeywords.id, appKeywordRankings.keywordId))
        .where(
          and(
            inArray(appKeywordRankings.appSlug, competitorSlugs),
            isNotNull(appKeywordRankings.position)
          )
        )
        .groupBy(appKeywordRankings.keywordId, trackedKeywords.keyword, trackedKeywords.slug)
        .orderBy(
          desc(sql`count(distinct ${appKeywordRankings.appSlug})`),
          asc(sql`min(${appKeywordRankings.position})`)
        )
        .limit(50);

      const rankingMap = new Map<string, any>();
      for (const r of rankingSuggestions) {
        if (!existingKeywordIds.has(r.keywordId)) {
          rankingMap.set(r.keyword, {
            keyword: r.keyword,
            slug: r.slug,
            competitorCount: r.compCount,
            bestPosition: r.bestPos,
            source: "ranking" as const,
          });
        }
      }

      // Source B: Keywords from competitor metadata
      const metadataKeywords = new Map<string, { count: number; sources: string[] }>();
      for (const slug of competitorSlugs) {
        const [snap] = await db
          .select({
            name: apps.name,
            appCardSubtitle: apps.appCardSubtitle,
            appIntroduction: appSnapshots.appIntroduction,
            appDetails: appSnapshots.appDetails,
            features: appSnapshots.features,
            categories: appSnapshots.categories,
          })
          .from(appSnapshots)
          .innerJoin(apps, eq(apps.slug, appSnapshots.appSlug))
          .where(eq(appSnapshots.appSlug, slug))
          .orderBy(desc(appSnapshots.scrapedAt))
          .limit(1);

        if (snap) {
          const extracted = extractKeywordsFromAppMetadata({
            name: snap.name,
            subtitle: snap.appCardSubtitle ?? null,
            introduction: snap.appIntroduction || null,
            description: snap.appDetails || null,
            features: snap.features || [],
            categories: snap.categories || [],
          });

          for (const kw of extracted.slice(0, 30)) {
            const existing = metadataKeywords.get(kw.keyword);
            if (existing) {
              existing.count += 1;
            } else {
              metadataKeywords.set(kw.keyword, {
                count: 1,
                sources: kw.sources.map((s) => s.field),
              });
            }
          }
        }
      }

      // Merge: ranking source has priority
      const existingKeywordNames = new Set(projectKeywordRows.map((k) => k.keyword));
      const merged = new Map<string, any>();

      for (const [keyword, data] of rankingMap) {
        if (!existingKeywordNames.has(keyword)) {
          merged.set(keyword, data);
        }
      }

      for (const [keyword, data] of metadataKeywords) {
        if (data.count >= 2 && !merged.has(keyword) && !existingKeywordNames.has(keyword)) {
          merged.set(keyword, {
            keyword,
            competitorCount: data.count,
            source: "metadata" as const,
          });
        }
      }

      keywordSuggestions = Array.from(merged.values())
        .sort((a, b) => (b.competitorCount || 0) - (a.competitorCount || 0))
        .slice(0, 30);
    }

    // 9. Word analysis (market language)
    let wordAnalysis: any[] = [];
    if (competitorSlugs.length >= 2) {
      const allExtracted = new Map<
        string,
        { totalScore: number; appCount: number; apps: Set<string>; sourceCounts: Map<string, Set<string>> }
      >();

      for (const slug of competitorSlugs) {
        const [snap] = await db
          .select({
            name: apps.name,
            appCardSubtitle: apps.appCardSubtitle,
            appIntroduction: appSnapshots.appIntroduction,
            appDetails: appSnapshots.appDetails,
            features: appSnapshots.features,
            categories: appSnapshots.categories,
          })
          .from(appSnapshots)
          .innerJoin(apps, eq(apps.slug, appSnapshots.appSlug))
          .where(eq(appSnapshots.appSlug, slug))
          .orderBy(desc(appSnapshots.scrapedAt))
          .limit(1);

        if (snap) {
          const extracted = extractKeywordsFromAppMetadata({
            name: snap.name,
            subtitle: snap.appCardSubtitle ?? null,
            introduction: snap.appIntroduction || null,
            description: snap.appDetails || null,
            features: snap.features || [],
            categories: snap.categories || [],
          });

          for (const kw of extracted) {
            const existing = allExtracted.get(kw.keyword);
            if (existing) {
              existing.totalScore += kw.score;
              existing.apps.add(slug);
              existing.appCount = existing.apps.size;
              for (const s of kw.sources) {
                if (!existing.sourceCounts.has(s.field)) existing.sourceCounts.set(s.field, new Set());
                existing.sourceCounts.get(s.field)!.add(slug);
              }
            } else {
              const sc = new Map<string, Set<string>>();
              for (const s of kw.sources) sc.set(s.field, new Set([slug]));
              allExtracted.set(kw.keyword, {
                totalScore: kw.score,
                appCount: 1,
                apps: new Set([slug]),
                sourceCounts: sc,
              });
            }
          }
        }
      }

      wordAnalysis = Array.from(allExtracted.entries())
        .filter(([, data]) => data.appCount >= 2)
        .map(([word, data]) => ({
          word,
          totalScore: Math.round(data.totalScore * 10) / 10,
          appCount: data.appCount,
          sources: Object.fromEntries(
            Array.from(data.sourceCounts.entries()).map(([field, appSet]) => [field, appSet.size])
          ),
        }))
        .sort((a, b) => b.appCount - a.appCount || b.totalScore - a.totalScore)
        .slice(0, 50);
    }

    // 10. Category landscape
    let categories: any[] = [];
    if (competitorSlugs.length >= 2) {
      // Get category rankings for all competitors
      const catRankings = await db
        .select({
          appSlug: appCategoryRankings.appSlug,
          categorySlug: appCategoryRankings.categorySlug,
          position: appCategoryRankings.position,
          scrapedAt: appCategoryRankings.scrapedAt,
        })
        .from(appCategoryRankings)
        .where(inArray(appCategoryRankings.appSlug, competitorSlugs))
        .orderBy(desc(appCategoryRankings.scrapedAt));

      // Latest per (app, category)
      const latestCatRank = new Map<string, { appSlug: string; categorySlug: string; position: number }>();
      for (const r of catRankings) {
        const key = `${r.appSlug}:${r.categorySlug}`;
        if (!latestCatRank.has(key)) {
          latestCatRank.set(key, { appSlug: r.appSlug, categorySlug: r.categorySlug, position: r.position });
        }
      }

      // Group by category
      const catMap = new Map<string, { slug: string; competitors: { slug: string; position: number }[] }>();
      for (const [, r] of latestCatRank) {
        if (!catMap.has(r.categorySlug)) {
          catMap.set(r.categorySlug, { slug: r.categorySlug, competitors: [] });
        }
        catMap.get(r.categorySlug)!.competitors.push({ slug: r.appSlug, position: r.position });
      }

      // Sort competitors within each category by position
      for (const cat of catMap.values()) {
        cat.competitors.sort((a, b) => a.position - b.position);
      }

      // Get category titles from snapshot data
      const catTitleMap = new Map<string, string>();
      for (const comp of competitorData) {
        for (const cat of comp.categories || []) {
          if (cat.url) {
            const catSlug = cat.url.replace(/.*\/categories\//, "").replace(/\?.*/, "");
            if (!catTitleMap.has(catSlug) && cat.title) {
              catTitleMap.set(catSlug, cat.title);
            }
          }
          for (const sub of cat.subcategories || []) {
            if (sub.title) {
              // Generate slug from title
              const subSlug = sub.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
              if (!catTitleMap.has(subSlug)) {
                catTitleMap.set(subSlug, sub.title);
              }
            }
          }
        }
      }

      categories = Array.from(catMap.values())
        .map((cat) => ({
          slug: cat.slug,
          title: catTitleMap.get(cat.slug) || cat.slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          competitorCount: cat.competitors.length,
          total: competitorSlugs.length,
          competitors: cat.competitors,
        }))
        .filter((c) => c.competitorCount >= 2)
        .sort((a, b) => b.competitorCount - a.competitorCount);
    }

    // 11. Feature coverage (grouped by category type → subcategory)
    let featureCoverage: any[] = [];
    if (competitorSlugs.length >= 2) {
      const featureMap = new Map<
        string,
        {
          title: string;
          categoryType: string;
          categoryTitle: string;
          subcategoryTitle: string;
          competitors: Set<string>;
        }
      >();

      for (const comp of competitorData) {
        for (const cat of comp.categories || []) {
          const catType = cat.type || "other";
          const catTitle = cat.title || "";
          for (const sub of cat.subcategories || []) {
            for (const feat of sub.features || []) {
              const existing = featureMap.get(feat.feature_handle);
              if (!existing) {
                featureMap.set(feat.feature_handle, {
                  title: feat.title,
                  categoryType: catType,
                  categoryTitle: catTitle,
                  subcategoryTitle: sub.title || "",
                  competitors: new Set([comp.slug]),
                });
              } else {
                existing.competitors.add(comp.slug);
              }
            }
          }
        }
      }

      featureCoverage = Array.from(featureMap.entries())
        .map(([handle, data]) => ({
          feature: handle,
          title: data.title,
          categoryType: data.categoryType,
          categoryTitle: data.categoryTitle,
          subcategoryTitle: data.subcategoryTitle,
          count: data.competitors.size,
          total: competitorSlugs.length,
          competitors: Array.from(data.competitors),
          isGap: data.competitors.size < competitorSlugs.length / 2,
        }))
        .sort((a, b) => b.count - a.count);
    }

    // 12. Keyword opportunities
    let opportunities: any[] = [];
    if (keywordIds.length >= 3 && competitorSlugs.length >= 2) {
      for (const kw of projectKeywordRows) {
        const [snap] = await db
          .select({
            totalResults: keywordSnapshots.totalResults,
            results: keywordSnapshots.results,
          })
          .from(keywordSnapshots)
          .where(eq(keywordSnapshots.keywordId, kw.keywordId))
          .orderBy(desc(keywordSnapshots.scrapedAt))
          .limit(1);

        if (snap?.results && Array.isArray(snap.results) && snap.results.length > 0) {
          const metrics = computeKeywordOpportunity(snap.results, snap.totalResults);

          // How many of our competitors rank?
          const kwRankings = keywordRankings[kw.slug] || {};
          const rankingComps = Object.keys(kwRankings).length;

          opportunities.push({
            keyword: kw.keyword,
            slug: kw.slug,
            opportunityScore: metrics.opportunityScore,
            room: metrics.scores.room,
            demand: metrics.scores.demand,
            competitorCount: rankingComps,
            totalResults: snap.totalResults,
          });
        }
      }

      opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);
    }

    return {
      project,
      keywords: keywordData,
      competitors: competitorData,
      keywordRankings,
      competitorSuggestions,
      keywordSuggestions,
      wordAnalysis,
      categories,
      featureCoverage,
      opportunities,
    };
  });
};
