import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and, inArray, desc, asc, isNotNull } from "drizzle-orm";
import { Queue } from "bullmq";
import OpenAI from "openai";
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
  researchVirtualApps,
  aiLogs,
  appPowerScores,
  users,
  accounts,
  categories as categoriesTable,
  categorySnapshots,
  featuredAppSightings,
  similarAppSightings,
} from "@appranks/db";
import {
  extractKeywordsFromAppMetadata,
  computeKeywordOpportunity,
} from "@appranks/shared";
import { requireRole } from "../middleware/authorize.js";
import { getPlatformFromQuery } from "../utils/platform.js";

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

function buildResearchSummary(data: any, projectName: string) {
  const competitors = (data.competitors || []).map((c: any) => ({
    name: c.name,
    averageRating: c.averageRating,
    pricingHint: c.pricingHint,
    minPaidPrice: c.minPaidPrice,
    powerScore: c.powerScore,
    featureCount: (c.features || []).length,
    integrationCount: (c.integrations || []).length,
    languageCount: (c.languages || []).length,
    categories: (c.categories || []).map((cat: any) => cat.title).filter(Boolean),
  }));

  // Top 50 features by count
  const featureCoverage = (data.featureCoverage || [])
    .slice(0, 50)
    .map((f: any) => ({
      title: f.title,
      categoryTitle: f.categoryTitle,
      subcategoryTitle: f.subcategoryTitle,
      count: f.count,
      total: f.total,
      isGap: f.isGap,
    }));

  // Union of all competitor features
  const availableFeatures = Array.from(
    new Set((data.competitors || []).flatMap((c: any) => c.features || []))
  );

  // Union of all competitor integrations
  const availableIntegrations = Array.from(
    new Set((data.competitors || []).flatMap((c: any) => c.integrations || []))
  );

  // Union of all competitor languages
  const availableLanguages = Array.from(
    new Set((data.competitors || []).flatMap((c: any) => c.languages || []))
  );

  // Available categories from competitor data, deduplicated and merged
  const catMap = new Map<string, { title: string; url: string; subcategories: Map<string, { title: string; features: Map<string, { title: string; feature_handle: string; url: string }> }> }>();
  for (const comp of data.competitors || []) {
    for (const cat of comp.categories || []) {
      if (!cat.title || !cat.url) continue;
      if (!catMap.has(cat.url)) {
        catMap.set(cat.url, { title: cat.title, url: cat.url, subcategories: new Map() });
      }
      const catEntry = catMap.get(cat.url)!;
      for (const sub of cat.subcategories || []) {
        if (!sub.title) continue;
        if (!catEntry.subcategories.has(sub.title)) {
          catEntry.subcategories.set(sub.title, { title: sub.title, features: new Map() });
        }
        const subEntry = catEntry.subcategories.get(sub.title)!;
        for (const f of sub.features || []) {
          if (f.feature_handle && !subEntry.features.has(f.feature_handle)) {
            subEntry.features.set(f.feature_handle, {
              title: f.title,
              feature_handle: f.feature_handle,
              url: f.url || "",
            });
          }
        }
      }
    }
  }
  const availableCategories = Array.from(catMap.values()).map((cat) => ({
    title: cat.title,
    url: cat.url,
    subcategories: Array.from(cat.subcategories.values()).map((sub) => ({
      title: sub.title,
      features: Array.from(sub.features.values()),
    })),
  }));

  // Pricing summary
  let competitorsWithFreePlan = 0;
  const allPrices: number[] = [];
  const trialTexts: string[] = [];
  const sampleStructures: any[] = [];

  for (const comp of data.competitors || []) {
    const plans = comp.pricingPlans || [];
    const hasFree = plans.some((p: any) => !p.price || parseFloat(p.price) === 0);
    if (hasFree) competitorsWithFreePlan++;

    for (const p of plans) {
      if (p.price && parseFloat(p.price) > 0) allPrices.push(parseFloat(p.price));
      if (p.trial_text) trialTexts.push(p.trial_text);
    }

    if (sampleStructures.length < 3 && plans.length > 0) {
      sampleStructures.push({
        name: comp.name,
        plans: plans.map((p: any) => ({
          name: p.name,
          price: p.price,
          period: p.period,
          featureCount: (p.features || []).length,
        })),
      });
    }
  }

  const commonTrialTexts = Array.from(new Set(trialTexts)).slice(0, 5);
  const priceRange = allPrices.length > 0
    ? { min: Math.min(...allPrices), max: Math.max(...allPrices) }
    : null;

  // Top 15 opportunities
  const opportunities = (data.opportunities || [])
    .slice(0, 15)
    .map((o: any) => ({
      keyword: o.keyword,
      opportunityScore: o.opportunityScore,
      room: o.room,
      demand: o.demand,
    }));

  // Top 30 market language
  const marketLanguage = (data.wordAnalysis || [])
    .slice(0, 30)
    .map((w: any) => ({
      word: w.word,
      totalScore: w.totalScore,
      appCount: w.appCount,
    }));

  // Category landscape
  const categoryLandscape = (data.categories || []).map((c: any) => ({
    title: c.title,
    competitorCount: c.competitorCount,
  }));

  return {
    projectName,
    keywords: (data.keywords || []).map((k: any) => ({
      keyword: k.keyword,
      totalResults: k.totalResults,
    })),
    competitors,
    featureCoverage,
    availableFeatures,
    availableIntegrations,
    availableLanguages,
    availableCategories,
    pricingSummary: {
      competitorsWithFreePlan,
      priceRange,
      commonTrialTexts,
      sampleStructures,
    },
    opportunities,
    marketLanguage,
    categoryLandscape,
  };
}

export const researchRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // ─── Project CRUD ──────────────────────────────────────────

  // GET /api/research-projects — list projects for account
  app.get("/", async (request) => {
    const { accountId } = request.user;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    const projects = await db
      .select({
        id: researchProjects.id,
        name: researchProjects.name,
        createdAt: researchProjects.createdAt,
        updatedAt: researchProjects.updatedAt,
        creatorName: users.name,
      })
      .from(researchProjects)
      .leftJoin(users, eq(researchProjects.createdBy, users.id))
      .where(and(eq(researchProjects.accountId, accountId), eq(researchProjects.platform, platform)))
      .orderBy(desc(researchProjects.updatedAt));

    return projects;
  });

  // POST /api/research-projects — create project
  app.post<{ Body: { name?: string } }>(
    "/",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const { name } = request.body || {};
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Check limit
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(researchProjects)
        .where(eq(researchProjects.accountId, accountId));

      if (count >= account.maxResearchProjects) {
        return reply.code(403).send({
          error: "Research projects limit reached",
          current: count,
          max: account.maxResearchProjects,
        });
      }

      const [project] = await db
        .insert(researchProjects)
        .values({
          accountId,
          platform,
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
        .select({ id: apps.id, slug: apps.slug, platform: apps.platform })
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
          appId: existingApp.id,
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
        .where(eq(appSnapshots.appId, existingApp.id))
        .limit(1);

      if (!existingSnapshot) {
        try {
          const queue = getScraperQueue();
          await queue.add("scrape:app_details", {
            type: "app_details",
            slug: slug.trim(),
            platform: existingApp.platform,
            triggeredBy: "api:research",
          });
          await queue.add("scrape:reviews", {
            type: "reviews",
            slug: slug.trim(),
            platform: existingApp.platform,
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

      // Look up app ID from slug
      const [appRow] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(eq(apps.slug, slug))
        .limit(1);

      if (!appRow) {
        return reply.code(404).send({ error: "Competitor not in project" });
      }

      const [deleted] = await db
        .delete(researchProjectCompetitors)
        .where(
          and(
            eq(researchProjectCompetitors.researchProjectId, id),
            eq(researchProjectCompetitors.appId, appRow.id)
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
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

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
        appId: researchProjectCompetitors.appId,
        appSlug: apps.slug,
        sortOrder: researchProjectCompetitors.sortOrder,
      })
      .from(researchProjectCompetitors)
      .innerJoin(apps, eq(apps.id, researchProjectCompetitors.appId))
      .where(eq(researchProjectCompetitors.researchProjectId, id))
      .orderBy(asc(researchProjectCompetitors.sortOrder));

    const competitorSlugs = projectCompRows.map((c) => c.appSlug);
    const competitorAppIds = projectCompRows.map((c) => c.appId);

    // 5. Enrich competitors with app data + latest snapshot
    // Build a slug->id map for competitor lookups
    const slugToIdMap = new Map(projectCompRows.map((c) => [c.appSlug, c.appId]));
    const idToSlugMap = new Map(projectCompRows.map((c) => [c.appId, c.appSlug]));
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
      for (const comp of projectCompRows) {
        const [snap] = await db
          .select({
            categories: appSnapshots.categories,
            pricingPlans: appSnapshots.pricingPlans,
            features: appSnapshots.features,
            integrations: appSnapshots.integrations,
            languages: appSnapshots.languages,
            appIntroduction: appSnapshots.appIntroduction,
            appDetails: appSnapshots.appDetails,
          })
          .from(appSnapshots)
          .where(eq(appSnapshots.appId, comp.appId))
          .orderBy(desc(appSnapshots.scrapedAt))
          .limit(1);
        if (snap) snapshotMap.set(comp.appSlug, snap);
      }

      // Get latest power scores per competitor
      const powerMap = new Map<string, number>();
      for (const comp of projectCompRows) {
        const [score] = await db
          .select({ powerScore: appPowerScores.powerScore })
          .from(appPowerScores)
          .where(eq(appPowerScores.appId, comp.appId))
          .orderBy(desc(appPowerScores.computedAt))
          .limit(1);
        if (score) powerMap.set(comp.appSlug, score.powerScore);
      }

      // Get category rankings per competitor
      const compCatRankings = await db
        .select({
          appId: appCategoryRankings.appId,
          categorySlug: appCategoryRankings.categorySlug,
          position: appCategoryRankings.position,
          scrapedAt: appCategoryRankings.scrapedAt,
        })
        .from(appCategoryRankings)
        .where(inArray(appCategoryRankings.appId, competitorAppIds))
        .orderBy(desc(appCategoryRankings.scrapedAt));

      // Latest per (app, category)
      const compLatestCatRank = new Map<string, { categorySlug: string; position: number }[]>();
      const seenCompCatKeys = new Set<string>();
      for (const r of compCatRankings) {
        const appSlug = idToSlugMap.get(r.appId) || '';
        const key = `${appSlug}:${r.categorySlug}`;
        if (seenCompCatKeys.has(key)) continue;
        seenCompCatKeys.add(key);
        if (!compLatestCatRank.has(appSlug)) compLatestCatRank.set(appSlug, []);
        compLatestCatRank.get(appSlug)!.push({ categorySlug: r.categorySlug, position: r.position });
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
        // Look up category IDs from slugs
        const catIdRows = await db
          .select({ id: categoriesTable.id, slug: categoriesTable.slug })
          .from(categoriesTable)
          .where(inArray(categoriesTable.slug, Array.from(allRankedCatSlugs)));
        const catSlugToId = new Map(catIdRows.map((c) => [c.slug, c.id]));
        const catIdToSlug = new Map(catIdRows.map((c) => [c.id, c.slug]));
        const catIds = catIdRows.map((c) => c.id);

        if (catIds.length > 0) {
          const appCountRows = await db
            .select({
              categoryId: categorySnapshots.categoryId,
              appCount: categorySnapshots.appCount,
            })
            .from(categorySnapshots)
            .where(inArray(categorySnapshots.categoryId, catIds))
            .orderBy(desc(categorySnapshots.scrapedAt));

          for (const r of appCountRows) {
            const catSlug = catIdToSlug.get(r.categoryId);
            if (catSlug && !catAppCountMap.has(catSlug) && r.appCount != null) {
              catAppCountMap.set(catSlug, r.appCount);
            }
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
          appSlug: apps.slug,
          sectionCount: sql<number>`count(distinct ${featuredAppSightings.surface} || ':' || ${featuredAppSightings.surfaceDetail} || ':' || ${featuredAppSightings.sectionHandle})`,
        })
        .from(featuredAppSightings)
        .innerJoin(apps, eq(apps.id, featuredAppSightings.appId))
        .where(
          and(
            inArray(featuredAppSightings.appId, competitorAppIds),
            sql`${featuredAppSightings.seenDate} >= ${featuredSinceStr}`
          )
        )
        .groupBy(apps.slug);
      const featuredMap = new Map(featuredCounts.map((r) => [r.appSlug, r.sectionCount]));

      // Reverse similar counts (how many apps list this competitor as similar)
      const similarCounts = await db
        .select({
          similarAppId: similarAppSightings.similarAppId,
          count: sql<number>`count(distinct ${similarAppSightings.appId})::int`,
        })
        .from(similarAppSightings)
        .where(inArray(similarAppSightings.similarAppId, competitorAppIds))
        .groupBy(similarAppSightings.similarAppId);
      const similarMap = new Map(similarCounts.map((r) => [idToSlugMap.get(r.similarAppId) || '', r.count]));

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
          pricingPlans: snap?.pricingPlans ?? [],
          powerScore: powerMap.get(c.appSlug) ?? null,
          categories: snap?.categories ?? [],
          categoryRankings: catRanks,
          features: snap?.features ?? [],
          integrations: snap?.integrations ?? [],
          languages: snap?.languages ?? [],
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
            appSlug: apps.slug,
            position: appKeywordRankings.position,
          })
          .from(appKeywordRankings)
          .innerJoin(apps, eq(apps.id, appKeywordRankings.appId))
          .where(
            and(
              eq(appKeywordRankings.keywordId, kw.keywordId),
              inArray(appKeywordRankings.appId, competitorAppIds),
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
          appSlug: apps.slug,
          appId: appKeywordRankings.appId,
          matched: sql<number>`count(distinct ${appKeywordRankings.keywordId})::int`,
          avgPos: sql<number>`avg(${appKeywordRankings.position})::float`,
        })
        .from(appKeywordRankings)
        .innerJoin(apps, eq(apps.id, appKeywordRankings.appId))
        .where(
          and(
            inArray(appKeywordRankings.keywordId, keywordIds),
            isNotNull(appKeywordRankings.position)
          )
        )
        .groupBy(appKeywordRankings.appId, apps.slug)
        .orderBy(
          desc(sql`count(distinct ${appKeywordRankings.keywordId})`),
          asc(sql`avg(${appKeywordRankings.position})`)
        )
        .limit(30);

      // Filter out already-added competitors
      const existingSet = new Set(competitorSlugs);
      const filteredSuggestions = suggestRows.filter((r) => !existingSet.has(r.appSlug));

      if (filteredSuggestions.length > 0) {
        const idsToEnrich = filteredSuggestions.map((r) => r.appId);
        const enrichedApps = await db
          .select({
            slug: apps.slug,
            name: apps.name,
            iconUrl: apps.iconUrl,
            averageRating: apps.averageRating,
            ratingCount: apps.ratingCount,
          })
          .from(apps)
          .where(inArray(apps.id, idsToEnrich));

        const enrichMap = new Map(enrichedApps.map((a) => [a.slug, a]));

        // Get which keywords each suggested app matches
        const matchDetails = await db
          .select({
            appSlug: apps.slug,
            keywordId: appKeywordRankings.keywordId,
          })
          .from(appKeywordRankings)
          .innerJoin(apps, eq(apps.id, appKeywordRankings.appId))
          .where(
            and(
              inArray(appKeywordRankings.appId, idsToEnrich),
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
          compCount: sql<number>`count(distinct ${appKeywordRankings.appId})::int`,
          bestPos: sql<number>`min(${appKeywordRankings.position})::int`,
        })
        .from(appKeywordRankings)
        .innerJoin(trackedKeywords, eq(trackedKeywords.id, appKeywordRankings.keywordId))
        .where(
          and(
            inArray(appKeywordRankings.appId, competitorAppIds),
            isNotNull(appKeywordRankings.position)
          )
        )
        .groupBy(appKeywordRankings.keywordId, trackedKeywords.keyword, trackedKeywords.slug)
        .orderBy(
          desc(sql`count(distinct ${appKeywordRankings.appId})`),
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
      for (const comp of projectCompRows) {
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
          .innerJoin(apps, eq(apps.id, appSnapshots.appId))
          .where(eq(appSnapshots.appId, comp.appId))
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

      for (const comp of projectCompRows) {
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
          .innerJoin(apps, eq(apps.id, appSnapshots.appId))
          .where(eq(appSnapshots.appId, comp.appId))
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
              existing.apps.add(comp.appSlug);
              existing.appCount = existing.apps.size;
              for (const s of kw.sources) {
                if (!existing.sourceCounts.has(s.field)) existing.sourceCounts.set(s.field, new Set());
                existing.sourceCounts.get(s.field)!.add(comp.appSlug);
              }
            } else {
              const sc = new Map<string, Set<string>>();
              for (const s of kw.sources) sc.set(s.field, new Set([comp.appSlug]));
              allExtracted.set(kw.keyword, {
                totalScore: kw.score,
                appCount: 1,
                apps: new Set([comp.appSlug]),
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
          appSlug: apps.slug,
          categorySlug: appCategoryRankings.categorySlug,
          position: appCategoryRankings.position,
          scrapedAt: appCategoryRankings.scrapedAt,
        })
        .from(appCategoryRankings)
        .innerJoin(apps, eq(apps.id, appCategoryRankings.appId))
        .where(inArray(appCategoryRankings.appId, competitorAppIds))
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

    // 13. Virtual apps
    const virtualApps = await db
      .select()
      .from(researchVirtualApps)
      .where(eq(researchVirtualApps.researchProjectId, id))
      .orderBy(desc(researchVirtualApps.updatedAt));

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
      virtualApps,
    };
  });

  // ─── Virtual Apps CRUD ─────────────────────────────────────

  // GET /:id/virtual-apps — list all virtual apps
  app.get<{ Params: { id: string } }>("/:id/virtual-apps", async (request, reply) => {
    const { accountId } = request.user;
    const { id } = request.params;

    const [project] = await db
      .select({ id: researchProjects.id })
      .from(researchProjects)
      .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));

    if (!project) return reply.code(404).send({ error: "Project not found" });

    const rows = await db
      .select({
        id: researchVirtualApps.id,
        researchProjectId: researchVirtualApps.researchProjectId,
        name: researchVirtualApps.name,
        icon: researchVirtualApps.icon,
        color: researchVirtualApps.color,
        iconUrl: researchVirtualApps.iconUrl,
        appCardSubtitle: researchVirtualApps.appCardSubtitle,
        appIntroduction: researchVirtualApps.appIntroduction,
        appDetails: researchVirtualApps.appDetails,
        seoTitle: researchVirtualApps.seoTitle,
        seoMetaDescription: researchVirtualApps.seoMetaDescription,
        features: researchVirtualApps.features,
        integrations: researchVirtualApps.integrations,
        languages: researchVirtualApps.languages,
        categories: researchVirtualApps.categories,
        pricingPlans: researchVirtualApps.pricingPlans,
        generatedByAi: researchVirtualApps.generatedByAi,
        createdBy: researchVirtualApps.createdBy,
        creatorName: users.name,
        createdAt: researchVirtualApps.createdAt,
        updatedAt: researchVirtualApps.updatedAt,
      })
      .from(researchVirtualApps)
      .leftJoin(users, eq(researchVirtualApps.createdBy, users.id))
      .where(eq(researchVirtualApps.researchProjectId, id))
      .orderBy(desc(researchVirtualApps.updatedAt));

    return rows;
  });

  // POST /:id/virtual-apps/generate — AI-powered virtual app generation
  app.post<{ Params: { id: string } }>(
    "/:id/virtual-apps/generate",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return reply.code(503).send({ error: "AI generation is not configured" });
      }

      const { accountId } = request.user;
      const { id } = request.params;
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Verify project ownership
      const [project] = await db
        .select({ id: researchProjects.id, name: researchProjects.name })
        .from(researchProjects)
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));

      if (!project) return reply.code(404).send({ error: "Project not found" });

      // Fetch research data via internal inject
      const token = request.headers.authorization;
      const dataRes = await request.server.inject({
        method: "GET",
        url: `/api/research-projects/${id}/data?platform=${platform}`,
        headers: { authorization: token || "" },
      });

      if (dataRes.statusCode !== 200) {
        request.log.error({ statusCode: dataRes.statusCode, body: dataRes.body }, "inject /data failed");
        return reply.code(500).send({ error: "Failed to fetch research data" });
      }

      let data: any;
      try {
        data = JSON.parse(dataRes.body);
      } catch (e) {
        request.log.error({ body: dataRes.body?.slice(0, 500) }, "Failed to parse research data");
        return reply.code(500).send({ error: "Failed to parse research data" });
      }

      if (!data.competitors || data.competitors.length < 2) {
        return reply.code(400).send({ error: "At least 2 competitors needed for AI generation" });
      }

      // Build compressed summary
      const summary = buildResearchSummary(data, project.name);

      // Call OpenAI
      const openai = new OpenAI({ apiKey });

      const systemPrompt = `You are a Shopify app market analyst and product strategist. Given competitive research data, generate 2-4 distinct virtual app concepts for the Shopify App Store.

Each app MUST target a DIFFERENT market positioning or niche — e.g., budget/simple, enterprise/comprehensive, niche-specific, all-in-one.

RULES:
1. features[] — ONLY use strings from "availableFeatures". Never invent features. Each app MUST have at least 5 features.
2. integrations[] — ONLY use strings from "availableIntegrations". Never invent integrations.
3. languages[] — ONLY use strings from "availableLanguages".
4. categories[] — Pick 1-2 categories from "availableCategories". You MUST copy the EXACT title, url, subcategory titles, and feature objects (title, feature_handle, url) from availableCategories. Do NOT invent or modify any category/subcategory/feature values. Select the subcategories and features relevant to the app's positioning.
5. pricingPlans[] — Each app MUST have at least 3 pricing plans (e.g., Free, Basic, Pro). Plans should be competitive based on market data.
6. icon must be a SINGLE standard emoji character (e.g., 🚀, 💡, ⚡, 🎯, 💎, 🛒, 📦, 🔄, 📊). Do NOT use text or special unicode symbols.
7. color must be a hex color code like #3B82F6.
8. All text must be in English. App names should be catchy and marketable.

KEYWORD & SEO STRATEGY:
- Naturally weave the most valuable keywords (from "keywords" and "opportunities" data) into ALL text fields: name, subtitle, introduction, details, seoTitle, seoMetaDescription.
- Keywords must flow naturally — NEVER sacrifice readability or grammar for keyword stuffing.
- Prioritize high opportunity-score keywords and high search-volume keywords.

TEXT LENGTH GUIDELINES — use the available space efficiently, aim for the UPPER end of each range:
- name: Use as close to 30 characters as possible. Include 1-2 top keywords naturally (e.g., "FormFlow ‑ Survey & Quiz App", "InvenSync Order Manager").
- appCardSubtitle: 50-62 characters. Describe the key value prop with relevant keywords.
- appIntroduction: 80-100 characters. One compelling sentence with primary keyword naturally included.
- appDetails: 3-4 paragraphs, up to 500 characters of plain text (not HTML). Be thorough — describe features, benefits, use cases. Weave in keywords throughout.
- seoTitle: 40-60 characters. Include primary keyword and brand name.
- seoMetaDescription: 120-160 characters. Compelling description with keywords and call to action.
- Each app should pick features/integrations that support its unique positioning — not just copy everything.`;

      const userPrompt = `Research data for "${project.name}":
${JSON.stringify(summary)}

Generate differentiated app concepts. Consider:
- Feature gaps (isGap=true) as opportunities
- High-scoring keyword opportunities
- Market language patterns
- How to position each app distinctly`;

      const responseSchema = {
        name: "virtual_app_suggestions",
        strict: true,
        schema: {
          type: "object" as const,
          properties: {
            apps: {
              type: "array" as const,
              items: {
                type: "object" as const,
                properties: {
                  name: { type: "string" as const },
                  icon: { type: "string" as const },
                  color: { type: "string" as const },
                  appCardSubtitle: { type: "string" as const },
                  appIntroduction: { type: "string" as const },
                  appDetails: { type: "string" as const },
                  seoTitle: { type: "string" as const },
                  seoMetaDescription: { type: "string" as const },
                  positioning: { type: "string" as const },
                  features: { type: "array" as const, items: { type: "string" as const } },
                  integrations: { type: "array" as const, items: { type: "string" as const } },
                  languages: { type: "array" as const, items: { type: "string" as const } },
                  categories: {
                    type: "array" as const,
                    items: {
                      type: "object" as const,
                      properties: {
                        title: { type: "string" as const },
                        url: { type: "string" as const },
                        subcategories: {
                          type: "array" as const,
                          items: {
                            type: "object" as const,
                            properties: {
                              title: { type: "string" as const },
                              features: {
                                type: "array" as const,
                                items: {
                                  type: "object" as const,
                                  properties: {
                                    title: { type: "string" as const },
                                    feature_handle: { type: "string" as const },
                                    url: { type: "string" as const },
                                  },
                                  required: ["title", "feature_handle", "url"] as const,
                                  additionalProperties: false as const,
                                },
                              },
                            },
                            required: ["title", "features"] as const,
                            additionalProperties: false as const,
                          },
                        },
                      },
                      required: ["title", "url", "subcategories"] as const,
                      additionalProperties: false as const,
                    },
                  },
                  pricingPlans: {
                    type: "array" as const,
                    items: {
                      type: "object" as const,
                      properties: {
                        name: { type: "string" as const },
                        price: { type: ["string", "null"] as const },
                        period: { type: ["string", "null"] as const },
                        trial_text: { type: ["string", "null"] as const },
                        features: { type: "array" as const, items: { type: "string" as const } },
                      },
                      required: ["name", "price", "period", "trial_text", "features"] as const,
                      additionalProperties: false as const,
                    },
                  },
                },
                required: [
                  "name", "icon", "color", "appCardSubtitle", "appIntroduction",
                  "appDetails", "seoTitle", "seoMetaDescription", "positioning",
                  "features", "integrations", "languages", "categories", "pricingPlans",
                ] as const,
                additionalProperties: false as const,
              },
            },
          },
          required: ["apps"] as const,
          additionalProperties: false as const,
        },
      };

      let aiResponse: any;
      const aiStartTime = Date.now();
      let aiStatus: "success" | "error" | "timeout" = "success";
      let aiErrorMessage: string | undefined;
      let aiResponseContent: string | undefined;
      let aiPromptTokens = 0;
      let aiCompletionTokens = 0;
      let aiTotalTokens = 0;
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          temperature: 0.8,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: responseSchema,
          },
        }, { timeout: 120000 });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error("Empty response from AI");
        aiResponseContent = content;
        aiResponse = JSON.parse(content);

        aiPromptTokens = completion.usage?.prompt_tokens ?? 0;
        aiCompletionTokens = completion.usage?.completion_tokens ?? 0;
        aiTotalTokens = completion.usage?.total_tokens ?? 0;
      } catch (err: any) {
        aiStatus = err?.code === "ETIMEDOUT" || err?.message?.includes("timeout") ? "timeout" : "error";
        aiErrorMessage = err?.message || String(err);
        if (err?.status === 429 || err?.code === "insufficient_quota") {
          const isQuota = err?.code === "insufficient_quota" || err?.error?.code === "insufficient_quota";
          return reply.code(429).send({
            error: isQuota
              ? "OpenAI quota exceeded — check your plan and billing at platform.openai.com"
              : "AI service busy, try again",
          });
        }
        request.log.error(err, "OpenAI error");
        return reply.code(502).send({ error: "AI service error, try again" });
      } finally {
        const durationMs = Date.now() - aiStartTime;
        const costUsd = ((aiPromptTokens * 2.5 + aiCompletionTokens * 10) / 1_000_000).toFixed(6);
        db.insert(aiLogs)
          .values({
            accountId,
            userId: request.user.userId,
            platform,
            productType: "research_virtual_app",
            triggerType: "manual",
            productId: id,
            model: "gpt-4o",
            systemPrompt,
            userPrompt,
            responseContent: aiResponseContent ?? null,
            promptTokens: aiPromptTokens,
            completionTokens: aiCompletionTokens,
            totalTokens: aiTotalTokens,
            costUsd,
            durationMs,
            status: aiStatus,
            errorMessage: aiErrorMessage ?? null,
            metadata: {
              temperature: 0.8,
              responseFormat: "json_schema",
              outputCount: aiResponse?.apps?.length ?? 0,
            },
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"] ?? null,
          })
          .catch((logErr: any) => request.log.error(logErr, "Failed to insert AI log"));
      }

      // Post-validate: filter features/integrations/languages to known values
      const allowedFeatures = new Set(summary.availableFeatures);
      const allowedIntegrations = new Set(summary.availableIntegrations);
      const allowedLanguages = new Set(summary.availableLanguages);

      // Build lookup for valid categories
      const validCatMap = new Map<string, any>();
      for (const cat of summary.availableCategories) {
        validCatMap.set(cat.title, cat);
      }

      const createdVAs: any[] = [];
      for (const appConcept of aiResponse.apps) {
        // Validate categories against known structure
        const validatedCategories: any[] = [];
        for (const cat of (appConcept.categories || []).slice(0, 2)) {
          const knownCat = validCatMap.get(cat.title);
          if (!knownCat) continue;
          // Use the known category's url, filter subcategories/features to known values
          const knownSubMap = new Map<string, any>();
          for (const sub of knownCat.subcategories || []) {
            knownSubMap.set(sub.title, sub);
          }
          const validSubs: any[] = [];
          for (const sub of cat.subcategories || []) {
            const knownSub = knownSubMap.get(sub.title);
            if (!knownSub) continue;
            const knownFeatureHandles = new Set((knownSub.features || []).map((f: any) => f.feature_handle));
            const validFeatures = (sub.features || []).filter((f: any) => knownFeatureHandles.has(f.feature_handle));
            if (validFeatures.length > 0) {
              // Use feature data from the known source
              validSubs.push({
                title: knownSub.title,
                features: validFeatures.map((f: any) => {
                  const knownF = (knownSub.features || []).find((kf: any) => kf.feature_handle === f.feature_handle);
                  return knownF || f;
                }),
              });
            }
          }
          if (validSubs.length > 0) {
            validatedCategories.push({ title: knownCat.title, url: knownCat.url, subcategories: validSubs });
          }
        }

        // Truncate fields to respect limits
        const name = (appConcept.name || "My App").slice(0, 30);
        const appCardSubtitle = (appConcept.appCardSubtitle || "").slice(0, 62);
        const appIntroduction = (appConcept.appIntroduction || "").slice(0, 100);
        const seoTitle = (appConcept.seoTitle || "").slice(0, 60);
        const seoMetaDescription = (appConcept.seoMetaDescription || "").slice(0, 160);
        // Icon is varchar(10) — validate it's a real emoji, fallback to random
        const VA_ICONS = ["🚀", "💡", "⚡", "🎯", "🔮", "🌟", "💎", "🎨", "🔥", "🌊", "🦋", "🍀", "🎲", "🪐", "🎸", "🦄"];
        const iconRaw = appConcept.icon || "";
        const firstChar = [...iconRaw][0] || "";
        // Check if it's an actual emoji (Unicode > 0xFF) and fits in varchar(10)
        const isEmoji = firstChar && firstChar.codePointAt(0)! > 0xFF && Buffer.byteLength(firstChar, "utf8") <= 10;
        const icon = isEmoji ? firstChar : VA_ICONS[Math.floor(Math.random() * VA_ICONS.length)];
        // Color is varchar(7) — e.g. #3B82F6
        const color = (appConcept.color || "#3B82F6").slice(0, 7);

        const values: Record<string, any> = {
          researchProjectId: id,
          name,
          icon,
          color,
          appCardSubtitle,
          appIntroduction,
          appDetails: appConcept.appDetails || "",
          seoTitle,
          seoMetaDescription,
          features: (appConcept.features || []).filter((f: string) => allowedFeatures.has(f)),
          integrations: (appConcept.integrations || []).filter((i: string) => allowedIntegrations.has(i)),
          languages: (appConcept.languages || []).filter((l: string) => allowedLanguages.has(l)),
          categories: validatedCategories,
          pricingPlans: appConcept.pricingPlans || [],
          generatedByAi: true,
          createdBy: request.user.userId,
        };

        const [va] = await db
          .insert(researchVirtualApps)
          .values(values as any)
          .returning();

        createdVAs.push(va);
      }

      return { virtualApps: createdVAs };
      } catch (outerErr: any) {
        request.log.error(outerErr, "Virtual app generation failed");
        return reply.code(502).send({ error: "AI generation failed unexpectedly" });
      }
    }
  );

  // GET /:id/virtual-apps/:vaId — get single virtual app
  app.get<{ Params: { id: string; vaId: string } }>("/:id/virtual-apps/:vaId", async (request, reply) => {
    const { accountId } = request.user;
    const { id, vaId } = request.params;

    const [project] = await db
      .select({ id: researchProjects.id })
      .from(researchProjects)
      .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));

    if (!project) return reply.code(404).send({ error: "Project not found" });

    const [va] = await db
      .select()
      .from(researchVirtualApps)
      .where(and(eq(researchVirtualApps.id, vaId), eq(researchVirtualApps.researchProjectId, id)));

    if (!va) return reply.code(404).send({ error: "Virtual app not found" });
    return va;
  });

  // POST /:id/virtual-apps — create virtual app
  app.post<{ Params: { id: string }; Body: Record<string, any> }>(
    "/:id/virtual-apps",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;
      const body = request.body || {};

      const [project] = await db
        .select({ id: researchProjects.id })
        .from(researchProjects)
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));

      if (!project) return reply.code(404).send({ error: "Project not found" });

      const VA_ICONS = ["🚀", "💡", "⚡", "🎯", "🔮", "🌟", "💎", "🎨", "🔥", "🌊", "🦋", "🍀", "🎲", "🪐", "🎸", "🦄"];
      const VA_COLORS = ["#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4", "#6366F1", "#D946EF"];

      const values: Record<string, any> = {
        researchProjectId: id,
        name: body.name || "My App",
        icon: body.icon || VA_ICONS[Math.floor(Math.random() * VA_ICONS.length)],
        color: body.color || VA_COLORS[Math.floor(Math.random() * VA_COLORS.length)],
        createdBy: request.user.userId,
      };

      // Accept optional fields for full-data creation
      const optionalFields = [
        "iconUrl", "appCardSubtitle", "appIntroduction", "appDetails",
        "seoTitle", "seoMetaDescription", "features", "integrations",
        "languages", "categories", "pricingPlans",
      ];
      for (const key of optionalFields) {
        if (body[key] !== undefined) values[key] = body[key];
      }

      const [va] = await db
        .insert(researchVirtualApps)
        .values(values as any)
        .returning();

      return reply.code(201).send(va);
    }
  );

  // PATCH /:id/virtual-apps/:vaId — update virtual app
  app.patch<{ Params: { id: string; vaId: string }; Body: Record<string, any> }>(
    "/:id/virtual-apps/:vaId",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id, vaId } = request.params;
      const body = request.body || {};

      const [project] = await db
        .select({ id: researchProjects.id })
        .from(researchProjects)
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));

      if (!project) return reply.code(404).send({ error: "Project not found" });

      const allowedFields: Record<string, any> = {};
      const fieldMap: Record<string, keyof typeof researchVirtualApps> = {
        name: "name",
        icon: "icon",
        color: "color",
        iconUrl: "iconUrl",
        appCardSubtitle: "appCardSubtitle",
        appIntroduction: "appIntroduction",
        appDetails: "appDetails",
        seoTitle: "seoTitle",
        seoMetaDescription: "seoMetaDescription",
        features: "features",
        integrations: "integrations",
        languages: "languages",
        categories: "categories",
        pricingPlans: "pricingPlans",
      };

      for (const [key, col] of Object.entries(fieldMap)) {
        if (body[key] !== undefined) {
          allowedFields[col] = body[key];
        }
      }

      if (Object.keys(allowedFields).length === 0) {
        return reply.code(400).send({ error: "No valid fields to update" });
      }

      allowedFields.updatedAt = new Date();

      const [updated] = await db
        .update(researchVirtualApps)
        .set(allowedFields)
        .where(and(eq(researchVirtualApps.id, vaId), eq(researchVirtualApps.researchProjectId, id)))
        .returning();

      if (!updated) return reply.code(404).send({ error: "Virtual app not found" });
      return updated;
    }
  );

  // DELETE /:id/virtual-apps/:vaId — delete virtual app
  app.delete<{ Params: { id: string; vaId: string } }>(
    "/:id/virtual-apps/:vaId",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id, vaId } = request.params;

      const [project] = await db
        .select({ id: researchProjects.id })
        .from(researchProjects)
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));

      if (!project) return reply.code(404).send({ error: "Project not found" });

      const [deleted] = await db
        .delete(researchVirtualApps)
        .where(and(eq(researchVirtualApps.id, vaId), eq(researchVirtualApps.researchProjectId, id)))
        .returning({ id: researchVirtualApps.id });

      if (!deleted) return reply.code(404).send({ error: "Virtual app not found" });
      return { success: true };
    }
  );

  // ─── Virtual App Feature Helpers ───────────────────────────

  // POST /:id/virtual-apps/:vaId/add-category-feature
  app.post<{
    Params: { id: string; vaId: string };
    Body: { categoryTitle: string; subcategoryTitle: string; featureTitle: string; featureHandle: string; featureUrl?: string };
  }>(
    "/:id/virtual-apps/:vaId/add-category-feature",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id, vaId } = request.params;
      const { categoryTitle, subcategoryTitle, featureTitle, featureHandle, featureUrl } = request.body;

      const [project] = await db
        .select({ id: researchProjects.id })
        .from(researchProjects)
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const [va] = await db
        .select({ categories: researchVirtualApps.categories })
        .from(researchVirtualApps)
        .where(and(eq(researchVirtualApps.id, vaId), eq(researchVirtualApps.researchProjectId, id)));
      if (!va) return reply.code(404).send({ error: "Virtual app not found" });

      const cats: any[] = (va.categories as any[]) || [];
      let cat = cats.find((c: any) => c.title === categoryTitle);
      if (!cat) {
        cat = { title: categoryTitle, url: "", subcategories: [] };
        cats.push(cat);
      }
      let sub = cat.subcategories.find((s: any) => s.title === subcategoryTitle);
      if (!sub) {
        sub = { title: subcategoryTitle, features: [] };
        cat.subcategories.push(sub);
      }
      const exists = sub.features.some((f: any) => f.feature_handle === featureHandle);
      if (!exists) {
        sub.features.push({ title: featureTitle, feature_handle: featureHandle, url: featureUrl || "" });
      }

      const [updated] = await db
        .update(researchVirtualApps)
        .set({ categories: cats, updatedAt: new Date() })
        .where(eq(researchVirtualApps.id, vaId))
        .returning();

      return updated;
    }
  );

  // DELETE /:id/virtual-apps/:vaId/remove-category-feature
  app.delete<{
    Params: { id: string; vaId: string };
    Body: { categoryTitle: string; subcategoryTitle: string; featureHandle: string };
  }>(
    "/:id/virtual-apps/:vaId/remove-category-feature",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id, vaId } = request.params;
      const { categoryTitle, subcategoryTitle, featureHandle } = request.body;

      const [project] = await db
        .select({ id: researchProjects.id })
        .from(researchProjects)
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const [va] = await db
        .select({ categories: researchVirtualApps.categories })
        .from(researchVirtualApps)
        .where(and(eq(researchVirtualApps.id, vaId), eq(researchVirtualApps.researchProjectId, id)));
      if (!va) return reply.code(404).send({ error: "Virtual app not found" });

      const cats: any[] = (va.categories as any[]) || [];
      const cat = cats.find((c: any) => c.title === categoryTitle);
      if (cat) {
        const sub = cat.subcategories.find((s: any) => s.title === subcategoryTitle);
        if (sub) {
          sub.features = sub.features.filter((f: any) => f.feature_handle !== featureHandle);
          if (sub.features.length === 0) {
            cat.subcategories = cat.subcategories.filter((s: any) => s.title !== subcategoryTitle);
          }
        }
        if (cat.subcategories.length === 0) {
          const idx = cats.indexOf(cat);
          if (idx >= 0) cats.splice(idx, 1);
        }
      }

      const [updated] = await db
        .update(researchVirtualApps)
        .set({ categories: cats, updatedAt: new Date() })
        .where(eq(researchVirtualApps.id, vaId))
        .returning();

      return updated;
    }
  );

  // POST /:id/virtual-apps/:vaId/add-feature
  app.post<{ Params: { id: string; vaId: string }; Body: { feature: string } }>(
    "/:id/virtual-apps/:vaId/add-feature",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id, vaId } = request.params;
      const { feature } = request.body;

      const [project] = await db
        .select({ id: researchProjects.id })
        .from(researchProjects)
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const [va] = await db
        .select({ features: researchVirtualApps.features })
        .from(researchVirtualApps)
        .where(and(eq(researchVirtualApps.id, vaId), eq(researchVirtualApps.researchProjectId, id)));
      if (!va) return reply.code(404).send({ error: "Virtual app not found" });

      const features: string[] = (va.features as string[]) || [];
      if (!features.includes(feature)) {
        features.push(feature);
      }

      const [updated] = await db
        .update(researchVirtualApps)
        .set({ features, updatedAt: new Date() })
        .where(eq(researchVirtualApps.id, vaId))
        .returning();

      return updated;
    }
  );

  // DELETE /:id/virtual-apps/:vaId/remove-feature
  app.delete<{ Params: { id: string; vaId: string }; Body: { feature: string } }>(
    "/:id/virtual-apps/:vaId/remove-feature",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id, vaId } = request.params;
      const { feature } = request.body;

      const [project] = await db
        .select({ id: researchProjects.id })
        .from(researchProjects)
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const [va] = await db
        .select({ features: researchVirtualApps.features })
        .from(researchVirtualApps)
        .where(and(eq(researchVirtualApps.id, vaId), eq(researchVirtualApps.researchProjectId, id)));
      if (!va) return reply.code(404).send({ error: "Virtual app not found" });

      const features: string[] = (va.features as string[]) || [];
      const filtered = features.filter((f) => f !== feature);

      const [updated] = await db
        .update(researchVirtualApps)
        .set({ features: filtered, updatedAt: new Date() })
        .where(eq(researchVirtualApps.id, vaId))
        .returning();

      return updated;
    }
  );

  // POST /:id/virtual-apps/:vaId/add-integration
  app.post<{ Params: { id: string; vaId: string }; Body: { integration: string } }>(
    "/:id/virtual-apps/:vaId/add-integration",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id, vaId } = request.params;
      const { integration } = request.body;

      const [project] = await db
        .select({ id: researchProjects.id })
        .from(researchProjects)
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const [va] = await db
        .select({ integrations: researchVirtualApps.integrations })
        .from(researchVirtualApps)
        .where(and(eq(researchVirtualApps.id, vaId), eq(researchVirtualApps.researchProjectId, id)));
      if (!va) return reply.code(404).send({ error: "Virtual app not found" });

      const integrations: string[] = (va.integrations as string[]) || [];
      if (!integrations.includes(integration)) {
        integrations.push(integration);
      }

      const [updated] = await db
        .update(researchVirtualApps)
        .set({ integrations, updatedAt: new Date() })
        .where(eq(researchVirtualApps.id, vaId))
        .returning();

      return updated;
    }
  );

  // DELETE /:id/virtual-apps/:vaId/remove-integration
  app.delete<{ Params: { id: string; vaId: string }; Body: { integration: string } }>(
    "/:id/virtual-apps/:vaId/remove-integration",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id, vaId } = request.params;
      const { integration } = request.body;

      const [project] = await db
        .select({ id: researchProjects.id })
        .from(researchProjects)
        .where(and(eq(researchProjects.id, id), eq(researchProjects.accountId, accountId)));
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const [va] = await db
        .select({ integrations: researchVirtualApps.integrations })
        .from(researchVirtualApps)
        .where(and(eq(researchVirtualApps.id, vaId), eq(researchVirtualApps.researchProjectId, id)));
      if (!va) return reply.code(404).send({ error: "Virtual app not found" });

      const integrations: string[] = (va.integrations as string[]) || [];
      const filtered = integrations.filter((i) => i !== integration);

      const [updated] = await db
        .update(researchVirtualApps)
        .set({ integrations: filtered, updatedAt: new Date() })
        .where(eq(researchVirtualApps.id, vaId))
        .returning();

      return updated;
    }
  );
};
