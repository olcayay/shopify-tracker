/**
 * Win celebration email data builder.
 * Aggregates data needed by the win-celebration-template.
 */
import { eq, and, sql, desc, gte } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { apps, accounts, appKeywordRankings, trackedKeywords } from "@appranks/db";
import type { WinCelebrationData } from "../win-celebration-template.js";

export interface WinCelebrationInput {
  accountId: string;
  appId: number;
  platform: string;
  milestoneType: WinCelebrationData["milestoneType"];
  keywordId?: number;
  categoryName?: string;
  position?: number;
  reviewCount?: number;
  rating?: number;
  installCount?: number;
}

export async function buildWinCelebrationData(
  db: Database,
  input: WinCelebrationInput
): Promise<WinCelebrationData> {
  // Fetch account name
  const [account] = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, input.accountId))
    .limit(1);

  // Fetch app details
  const [app] = await db
    .select({ name: apps.name, slug: apps.slug })
    .from(apps)
    .where(eq(apps.id, input.appId))
    .limit(1);

  // Fetch keyword details if provided
  let keyword: string | undefined;
  let keywordSlug: string | undefined;
  if (input.keywordId) {
    const [kw] = await db
      .select({ keyword: trackedKeywords.keyword, slug: trackedKeywords.slug })
      .from(trackedKeywords)
      .where(eq(trackedKeywords.id, input.keywordId))
      .limit(1);
    if (kw) {
      keyword = kw.keyword;
      keywordSlug = kw.slug;
    }
  }

  // Try to find previous best position for ranking milestones
  let previousBest: number | undefined;
  if (input.keywordId && (input.milestoneType === "top1" || input.milestoneType === "top3")) {
    try {
      const [prev]: any[] = await db.execute(sql`
        SELECT MIN(position) AS best_position
        FROM ${appKeywordRankings}
        WHERE app_id = ${input.appId}
          AND keyword_id = ${input.keywordId}
          AND checked_at < NOW() - INTERVAL '1 day'
          AND position IS NOT NULL
      `);
      const row = (prev as any)?.rows?.[0] ?? prev;
      if (row?.best_position != null) {
        previousBest = Number(row.best_position);
      }
    } catch {
      // Non-critical
    }
  }

  return {
    accountName: account?.name || "Your Account",
    appName: app?.name || "Unknown App",
    appSlug: app?.slug || "",
    platform: input.platform,
    milestoneType: input.milestoneType,
    keyword,
    keywordSlug,
    categoryName: input.categoryName,
    position: input.position,
    reviewCount: input.reviewCount,
    rating: input.rating,
    installCount: input.installCount,
    previousBest,
  };
}
