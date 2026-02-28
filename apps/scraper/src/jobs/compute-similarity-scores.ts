import { eq, sql } from "drizzle-orm";
import type { Database } from "@shopify-tracking/db";
import { scrapeRuns, appSimilarityScores, accountCompetitorApps } from "@shopify-tracking/db";
import { createLogger } from "@shopify-tracking/shared";

const log = createLogger("compute-similarity-scores");

// Weights for each component (must sum to 1)
const W_CATEGORY = 0.25;
const W_FEATURE = 0.25;
const W_KEYWORD = 0.25;
const W_TEXT = 0.25;

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "am", "was", "were", "be", "been", "being",
  "in", "on", "at", "to", "for", "of", "and", "or", "but", "not", "with",
  "by", "from", "as", "it", "its", "this", "that", "these", "those",
  "i", "you", "he", "she", "we", "they", "my", "your", "our", "his", "her", "their",
  "me", "us", "him", "them", "do", "does", "did", "have", "has", "had",
  "will", "would", "can", "could", "shall", "should", "may", "might", "must",
  "so", "if", "then", "than", "no", "all", "any", "each", "every", "some",
  "such", "very", "just", "about", "up", "out", "how", "what", "which", "who",
  "when", "where", "also", "more", "other", "into", "over", "after", "before",
  // Shopify-specific stop words
  "app", "apps", "shopify", "store", "stores", "shop", "shops", "your", "our",
]);

/** Jaccard index: |A ∩ B| / |A ∪ B| */
function jaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const item of smaller) {
    if (larger.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Tokenize text into a set of normalized words */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  );
}

/** Extract category slugs from snapshot categories JSONB */
function extractCategorySlugs(categories: any[]): Set<string> {
  const slugs = new Set<string>();
  for (const c of categories) {
    if (c.url) {
      const slug = c.url.replace(/.*\/categories\//, "").replace(/\/.*/, "");
      if (slug) slugs.add(slug);
    }
  }
  return slugs;
}

/** Extract feature_handle values from snapshot categories JSONB */
function extractFeatureHandles(categories: any[]): Set<string> {
  const handles = new Set<string>();
  for (const c of categories) {
    for (const sub of c.subcategories ?? []) {
      for (const f of sub.features ?? []) {
        if (f.feature_handle) handles.add(f.feature_handle);
      }
    }
  }
  return handles;
}

export async function computeSimilarityScores(db: Database, triggeredBy: string, queue?: string): Promise<void> {
  const startTime = Date.now();

  const [run] = await db
    .insert(scrapeRuns)
    .values({
      scraperType: "compute_similarity_scores",
      status: "running",
      createdAt: new Date(),
      startedAt: new Date(),
      triggeredBy,
      queue,
    })
    .returning();

  try {
    // Collect all unique (trackedAppSlug, competitorSlug) pairs across all accounts
    const pairRows = await db
      .selectDistinct({
        trackedAppSlug: accountCompetitorApps.trackedAppSlug,
        appSlug: accountCompetitorApps.appSlug,
      })
      .from(accountCompetitorApps);

    if (pairRows.length === 0) {
      log.info("no competitor pairs found");
      await db
        .update(scrapeRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          metadata: { pairs_computed: 0, duration_ms: Date.now() - startTime },
        })
        .where(eq(scrapeRuns.id, run.id));
      return;
    }

    // Collect all unique app slugs
    const allSlugs = new Set<string>();
    for (const p of pairRows) {
      allSlugs.add(p.trackedAppSlug);
      allSlugs.add(p.appSlug);
    }
    const slugArray = [...allSlugs];
    const slugList = sql.join(slugArray.map((s) => sql`${s}`), sql`, `);

    // Batch-fetch latest snapshots (categories + appIntroduction)
    const snapshotRows: any[] = await db
      .execute(
        sql`
      SELECT DISTINCT ON (app_slug)
        app_slug, categories, app_introduction
      FROM app_snapshots
      WHERE app_slug IN (${slugList})
      ORDER BY app_slug, scraped_at DESC
    `
      )
      .then((res: any) => (res as any).rows ?? res);

    // Batch-fetch app info (name + subtitle)
    const appInfoRows: any[] = await db
      .execute(
        sql`
      SELECT slug, name, app_card_subtitle
      FROM apps
      WHERE slug IN (${slugList})
    `
      )
      .then((res: any) => (res as any).rows ?? res);

    // Build lookup maps
    const snapshotMap = new Map<string, any>();
    for (const r of snapshotRows) snapshotMap.set(r.app_slug, r);

    const appInfoMap = new Map<string, { name: string; subtitle: string | null }>();
    for (const r of appInfoRows) appInfoMap.set(r.slug, { name: r.name, subtitle: r.app_card_subtitle });

    // Batch-fetch keyword rankings: latest per (appSlug, keywordId) where position IS NOT NULL
    const kwRows: any[] = await db
      .execute(
        sql`
      SELECT DISTINCT ON (app_slug, keyword_id) app_slug, keyword_id
      FROM app_keyword_rankings
      WHERE app_slug IN (${slugList})
        AND position IS NOT NULL
      ORDER BY app_slug, keyword_id, scraped_at DESC
    `
      )
      .then((res: any) => (res as any).rows ?? res);

    const keywordMap = new Map<string, Set<string>>();
    for (const r of kwRows) {
      if (!keywordMap.has(r.app_slug)) keywordMap.set(r.app_slug, new Set());
      keywordMap.get(r.app_slug)!.add(String(r.keyword_id));
    }

    // Pre-compute per-app derived data
    const categorySlugMap = new Map<string, Set<string>>();
    const featureHandleMap = new Map<string, Set<string>>();
    const tokenMap = new Map<string, Set<string>>();

    for (const slug of slugArray) {
      const snap = snapshotMap.get(slug);
      const info = appInfoMap.get(slug);
      const cats = snap?.categories ?? [];

      categorySlugMap.set(slug, extractCategorySlugs(cats));
      featureHandleMap.set(slug, extractFeatureHandles(cats));

      const textParts = [info?.name ?? "", info?.subtitle ?? "", snap?.app_introduction ?? ""].join(" ");
      tokenMap.set(slug, tokenize(textParts));
    }

    // Compute similarity for each pair
    const today = new Date().toISOString().slice(0, 10);
    let computed = 0;

    // Deduplicate: if (A,B) and (B,A) both exist as competitor pairs, only compute once
    const seen = new Set<string>();

    for (const pair of pairRows) {
      const slugA = pair.trackedAppSlug;
      const slugB = pair.appSlug;
      const [canonA, canonB] = slugA < slugB ? [slugA, slugB] : [slugB, slugA];
      const pairKey = `${canonA}:${canonB}`;

      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const catScore = jaccard(categorySlugMap.get(slugA) ?? new Set(), categorySlugMap.get(slugB) ?? new Set());
      const featScore = jaccard(featureHandleMap.get(slugA) ?? new Set(), featureHandleMap.get(slugB) ?? new Set());
      const kwScore = jaccard(keywordMap.get(slugA) ?? new Set(), keywordMap.get(slugB) ?? new Set());
      const txtScore = jaccard(tokenMap.get(slugA) ?? new Set(), tokenMap.get(slugB) ?? new Set());

      const overall = W_CATEGORY * catScore + W_FEATURE * featScore + W_KEYWORD * kwScore + W_TEXT * txtScore;

      await db
        .insert(appSimilarityScores)
        .values({
          appSlugA: canonA,
          appSlugB: canonB,
          overallScore: overall.toFixed(4),
          categoryScore: catScore.toFixed(4),
          featureScore: featScore.toFixed(4),
          keywordScore: kwScore.toFixed(4),
          textScore: txtScore.toFixed(4),
          computedAt: today,
        })
        .onConflictDoUpdate({
          target: [appSimilarityScores.appSlugA, appSimilarityScores.appSlugB],
          set: {
            overallScore: overall.toFixed(4),
            categoryScore: catScore.toFixed(4),
            featureScore: featScore.toFixed(4),
            keywordScore: kwScore.toFixed(4),
            textScore: txtScore.toFixed(4),
            computedAt: today,
          },
        });

      computed++;
    }

    const durationMs = Date.now() - startTime;
    log.info("similarity scores computed", { computed, durationMs });

    await db
      .update(scrapeRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        metadata: { pairs_computed: computed, duration_ms: durationMs },
      })
      .where(eq(scrapeRuns.id, run.id));
  } catch (error) {
    log.error("failed to compute similarity scores", { error: String(error) });
    await db
      .update(scrapeRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: String(error),
      })
      .where(eq(scrapeRuns.id, run.id));
    throw error;
  }
}
