import { eq, desc, inArray } from "drizzle-orm";
import type { Database } from "@shopify-tracking/db";
import { scrapeRuns, apps, appSnapshots, categories } from "@shopify-tracking/db";
import { createLogger } from "@shopify-tracking/shared";

const log = createLogger("backfill-categories");

/**
 * One-time backfill: read category data from existing app snapshots
 * and register any missing categories in the categories table.
 */
export async function backfillCategories(db: Database, triggeredBy: string, queue?: string): Promise<void> {
  const startTime = Date.now();

  const [run] = await db
    .insert(scrapeRuns)
    .values({
      scraperType: "backfill_categories",
      status: "running",
      createdAt: new Date(),
      startedAt: new Date(),
      triggeredBy,
      queue,
    })
    .returning();

  try {
    // Get latest snapshot per tracked app
    const trackedApps = await db
      .select({ slug: apps.slug })
      .from(apps)
      .where(eq(apps.isTracked, true));

    // Collect all unique category slugs from snapshots
    const categoryMap = new Map<string, { title: string; url: string }>();

    for (const app of trackedApps) {
      const [snapshot] = await db
        .select({ categories: appSnapshots.categories })
        .from(appSnapshots)
        .where(eq(appSnapshots.appSlug, app.slug))
        .orderBy(desc(appSnapshots.scrapedAt))
        .limit(1);

      if (!snapshot?.categories || !Array.isArray(snapshot.categories)) continue;

      for (const cat of snapshot.categories as { title: string; url: string }[]) {
        const slugMatch = cat.url?.match(/\/categories\/([^/]+)/);
        if (!slugMatch) continue;
        const catSlug = slugMatch[1];
        if (!categoryMap.has(catSlug)) {
          categoryMap.set(catSlug, { title: cat.title || catSlug, url: cat.url });
        }
      }
    }

    // Check which already exist
    const allSlugs = [...categoryMap.keys()];
    const existingSlugs = new Set<string>();
    if (allSlugs.length > 0) {
      // Batch in chunks of 100
      for (let i = 0; i < allSlugs.length; i += 100) {
        const chunk = allSlugs.slice(i, i + 100);
        const rows = await db
          .select({ slug: categories.slug })
          .from(categories)
          .where(inArray(categories.slug, chunk));
        for (const r of rows) existingSlugs.add(r.slug);
      }
    }

    // Insert only missing ones
    let registered = 0;
    for (const [catSlug, data] of categoryMap) {
      if (existingSlugs.has(catSlug)) continue;
      await db
        .insert(categories)
        .values({
          slug: catSlug,
          title: data.title,
          url: data.url,
          parentSlug: null,
          categoryLevel: 0,
          isTracked: false,
          isListingPage: true,
        })
        .onConflictDoNothing({ target: categories.slug });
      registered++;
    }

    const skipped = categoryMap.size - registered;

    await db
      .update(scrapeRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        metadata: {
          apps_checked: trackedApps.length,
          categories_found: categoryMap.size,
          categories_registered: registered,
          categories_skipped: skipped,
          duration_ms: Date.now() - startTime,
        },
      })
      .where(eq(scrapeRuns.id, run.id));

    log.info("backfill complete", {
      appsChecked: trackedApps.length,
      found: categoryMap.size,
      registered,
      skipped,
    });
  } catch (error) {
    await db
      .update(scrapeRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: String(error),
        metadata: { duration_ms: Date.now() - startTime },
      })
      .where(eq(scrapeRuns.id, run.id));
    throw error;
  }
}
