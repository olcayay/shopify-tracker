/**
 * Per-(platform, category_slug) total ranked-app count cache (PLA-1063).
 *
 * Computing this is the dominant cost in /api/developers/:slug — a full scan
 * of `app_category_rankings` (≥2M rows) just to derive cohort sizes used for
 * the "Top X%" tier display. Cohort numbers are platform-wide and change only
 * when category rankings are scraped, so we cache them per platform with a
 * short TTL (30 min). Cache miss does the scan once; subsequent requests are
 * a single Redis hit.
 */
import { sql } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { cacheGet } from "./cache.js";

const TTL_SECONDS = 30 * 60; // 30 min

export type PlatformCategoryTotals = Record<string, number>;

export async function getCategoryTotalsForPlatform(
  db: Database,
  platform: string,
): Promise<PlatformCategoryTotals> {
  return cacheGet<PlatformCategoryTotals>(
    `cat-totals:${platform}`,
    async () => {
      const rows = (await db.execute(sql`
        SELECT r.category_slug, COUNT(DISTINCT r.app_id)::int AS total_apps
        FROM app_category_rankings r
        JOIN apps a ON a.id = r.app_id
        WHERE a.platform = ${platform}
        GROUP BY r.category_slug
      `)) as any;
      const data: any[] = rows.rows ?? rows;
      const out: PlatformCategoryTotals = {};
      for (const r of data) {
        out[r.category_slug] = Number(r.total_apps) || 0;
      }
      return out;
    },
    TTL_SECONDS,
  );
}
