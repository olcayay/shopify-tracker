/**
 * Ranking alert email data builder.
 * Aggregates data needed by the ranking-alert-template.
 */
import { eq, and, sql, desc, gte } from "drizzle-orm";
import type { Database } from "@appranks/db";
import {
  apps,
  accounts,
  trackedKeywords,
  appKeywordRankings,
} from "@appranks/db";
import type { RankingAlertData } from "../ranking-alert-template.js";

export interface RankingAlertInput {
  accountId: string;
  appId: number;
  keywordId: number;
  oldPosition: number | null;
  newPosition: number | null;
  platform: string;
  categoryName?: string;
}

export async function buildRankingAlertData(
  db: Database,
  input: RankingAlertInput
): Promise<RankingAlertData> {
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

  // Fetch keyword details
  const [keyword] = await db
    .select({ keyword: trackedKeywords.keyword, slug: trackedKeywords.slug })
    .from(trackedKeywords)
    .where(eq(trackedKeywords.id, input.keywordId))
    .limit(1);

  const change =
    input.oldPosition != null && input.newPosition != null
      ? input.oldPosition - input.newPosition
      : null;

  // Determine alert type
  let alertType: RankingAlertData["alertType"] = "significant_change";
  if (input.newPosition != null && input.newPosition <= 3 && (input.oldPosition == null || input.oldPosition > 3)) {
    alertType = "top3_entry";
  } else if (input.oldPosition != null && input.oldPosition <= 3 && (input.newPosition == null || input.newPosition > 3)) {
    alertType = "top3_exit";
  } else if (input.oldPosition == null && input.newPosition != null) {
    alertType = "new_entry";
  } else if (input.oldPosition != null && input.newPosition == null) {
    alertType = "dropped_out";
  }

  // Fetch other recent ranking changes for the same app (last 24h)
  const otherChanges: RankingAlertData["otherChanges"] = [];
  try {
    const recentRankings: any[] = await db.execute(sql`
      SELECT tk.keyword, r1.position AS current_position, r2.position AS previous_position
      FROM ${appKeywordRankings} r1
      JOIN ${trackedKeywords} tk ON tk.id = r1.keyword_id
      LEFT JOIN LATERAL (
        SELECT position FROM ${appKeywordRankings}
        WHERE app_id = ${input.appId} AND keyword_id = r1.keyword_id
          AND checked_at < r1.checked_at
        ORDER BY checked_at DESC LIMIT 1
      ) r2 ON true
      WHERE r1.app_id = ${input.appId}
        AND r1.keyword_id != ${input.keywordId}
        AND r1.checked_at >= NOW() - INTERVAL '24 hours'
        AND r2.position IS NOT NULL
        AND r1.position != r2.position
      ORDER BY ABS(r1.position - r2.position) DESC
      LIMIT 3
    `);
    const rows = (recentRankings as any).rows ?? recentRankings;
    for (const r of rows) {
      otherChanges.push({
        keyword: r.keyword,
        position: r.current_position,
        change: r.previous_position != null && r.current_position != null
          ? r.previous_position - r.current_position
          : null,
      });
    }
  } catch {
    // Non-critical — proceed without other changes
  }

  return {
    accountName: account?.name || "Your Account",
    appName: app?.name || "Unknown App",
    appSlug: app?.slug || "",
    platform: input.platform,
    alertType,
    keyword: keyword?.keyword || "",
    keywordSlug: keyword?.slug || "",
    categoryName: input.categoryName,
    previousPosition: input.oldPosition,
    currentPosition: input.newPosition,
    change,
    otherChanges: otherChanges.length > 0 ? otherChanges : undefined,
  };
}
