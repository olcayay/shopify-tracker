import { eq, and, sql, gte, lt, desc } from "drizzle-orm";
import type { Database } from "@shopify-tracking/db";
import {
  accounts,
  users,
  accountTrackedKeywords,
  accountTrackedApps,
  accountCompetitorApps,
  trackedKeywords,
  appKeywordRankings,
  appSnapshots,
  apps,
} from "@shopify-tracking/db";

export interface RankingChange {
  keyword: string;
  keywordSlug: string;
  appName: string;
  appSlug: string;
  isTracked: boolean;
  isCompetitor: boolean;
  yesterdayPosition: number | null;
  todayPosition: number | null;
  change: number | null; // positive = improved (moved up), negative = dropped
  type: "improved" | "dropped" | "new_entry" | "dropped_out" | "unchanged";
}

export interface CompetitorSummary {
  appName: string;
  appSlug: string;
  todayRating: string | null;
  yesterdayRating: string | null;
  ratingChange: number | null;
  todayReviews: number | null;
  yesterdayReviews: number | null;
  reviewsChange: number | null;
  keywordPositions: Array<{
    keyword: string;
    position: number | null;
    change: number | null;
  }>;
}

export interface DigestData {
  accountName: string;
  date: string;
  rankingChanges: RankingChange[];
  competitorSummaries: CompetitorSummary[];
  summary: {
    improved: number;
    dropped: number;
    newEntries: number;
    droppedOut: number;
    unchanged: number;
  };
}

export interface DigestRecipient {
  email: string;
  name: string;
  accountId: string;
}

/**
 * Get all users who should receive the daily digest
 */
export async function getDigestRecipients(
  db: Database
): Promise<DigestRecipient[]> {
  const rows = await db
    .select({
      email: users.email,
      name: users.name,
      accountId: users.accountId,
    })
    .from(users)
    .innerJoin(accounts, eq(accounts.id, users.accountId))
    .where(
      and(
        eq(users.emailDigestEnabled, true),
        eq(accounts.isSuspended, false)
      )
    );

  return rows;
}

/**
 * Build digest data for a specific account
 */
export async function buildDigestForAccount(
  db: Database,
  accountId: string
): Promise<DigestData | null> {
  // Get account name
  const [account] = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (!account) return null;

  // Get account's tracked keywords
  const trackedKws = await db
    .select({
      keywordId: accountTrackedKeywords.keywordId,
      keyword: trackedKeywords.keyword,
      slug: trackedKeywords.slug,
    })
    .from(accountTrackedKeywords)
    .innerJoin(
      trackedKeywords,
      eq(trackedKeywords.id, accountTrackedKeywords.keywordId)
    )
    .where(eq(accountTrackedKeywords.accountId, accountId));

  if (trackedKws.length === 0) return null;

  // Get tracked app slugs and competitor app slugs
  const trackedAppRows = await db
    .select({ appSlug: accountTrackedApps.appSlug })
    .from(accountTrackedApps)
    .where(eq(accountTrackedApps.accountId, accountId));
  const trackedSlugs = new Set(trackedAppRows.map((r) => r.appSlug));

  const competitorAppRows = await db
    .select({ appSlug: accountCompetitorApps.appSlug })
    .from(accountCompetitorApps)
    .where(eq(accountCompetitorApps.accountId, accountId));
  const competitorSlugs = new Set(competitorAppRows.map((r) => r.appSlug));

  // Relevant app slugs (tracked + competitors)
  const relevantSlugs = new Set([...trackedSlugs, ...competitorSlugs]);
  if (relevantSlugs.size === 0) return null;

  // Date boundaries
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const keywordIds = trackedKws.map((k) => k.keywordId);

  // Get today's latest rankings for relevant apps × keywords
  const todayRankings = await db
    .select({
      appSlug: appKeywordRankings.appSlug,
      keywordId: appKeywordRankings.keywordId,
      position: appKeywordRankings.position,
      scrapedAt: appKeywordRankings.scrapedAt,
    })
    .from(appKeywordRankings)
    .where(
      and(
        sql`${appKeywordRankings.keywordId} IN (${sql.join(
          keywordIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        gte(appKeywordRankings.scrapedAt, todayStart),
        sql`${appKeywordRankings.appSlug} IN (${sql.join(
          [...relevantSlugs].map((s) => sql`${s}`),
          sql`, `
        )})`
      )
    )
    .orderBy(desc(appKeywordRankings.scrapedAt));

  // Get yesterday's rankings
  const yesterdayRankings = await db
    .select({
      appSlug: appKeywordRankings.appSlug,
      keywordId: appKeywordRankings.keywordId,
      position: appKeywordRankings.position,
      scrapedAt: appKeywordRankings.scrapedAt,
    })
    .from(appKeywordRankings)
    .where(
      and(
        sql`${appKeywordRankings.keywordId} IN (${sql.join(
          keywordIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        gte(appKeywordRankings.scrapedAt, yesterdayStart),
        lt(appKeywordRankings.scrapedAt, todayStart),
        sql`${appKeywordRankings.appSlug} IN (${sql.join(
          [...relevantSlugs].map((s) => sql`${s}`),
          sql`, `
        )})`
      )
    )
    .orderBy(desc(appKeywordRankings.scrapedAt));

  // Build maps: (appSlug, keywordId) → latest position
  // For today, take the latest (first due to desc order)
  const todayMap = new Map<string, number>();
  for (const r of todayRankings) {
    const key = `${r.appSlug}::${r.keywordId}`;
    if (!todayMap.has(key) && r.position != null) todayMap.set(key, r.position);
  }

  const yesterdayMap = new Map<string, number>();
  for (const r of yesterdayRankings) {
    const key = `${r.appSlug}::${r.keywordId}`;
    if (!yesterdayMap.has(key) && r.position != null) yesterdayMap.set(key, r.position);
  }

  // Get app names
  const allAppSlugs = [...relevantSlugs];
  const appNameRows = await db
    .select({ slug: apps.slug, name: apps.name })
    .from(apps)
    .where(
      sql`${apps.slug} IN (${sql.join(
        allAppSlugs.map((s) => sql`${s}`),
        sql`, `
      )})`
    );
  const appNameMap = new Map(appNameRows.map((r) => [r.slug, r.name]));

  // Build keyword map
  const keywordMap = new Map(
    trackedKws.map((k) => [k.keywordId, { keyword: k.keyword, slug: k.slug }])
  );

  // Compare rankings
  const rankingChanges: RankingChange[] = [];
  const allKeys = new Set([...todayMap.keys(), ...yesterdayMap.keys()]);

  for (const key of allKeys) {
    const [appSlug, keywordIdStr] = key.split("::");
    const keywordId = parseInt(keywordIdStr, 10);
    const kwInfo = keywordMap.get(keywordId);
    if (!kwInfo) continue;

    const todayPos = todayMap.get(key) ?? null;
    const yesterdayPos = yesterdayMap.get(key) ?? null;

    let type: RankingChange["type"];
    let change: number | null = null;

    if (todayPos !== null && yesterdayPos !== null) {
      change = yesterdayPos - todayPos; // positive = improved (lower position number = better)
      if (change > 0) type = "improved";
      else if (change < 0) type = "dropped";
      else type = "unchanged";
    } else if (todayPos !== null && yesterdayPos === null) {
      type = "new_entry";
    } else {
      type = "dropped_out";
    }

    if (type === "unchanged") continue; // Skip unchanged

    rankingChanges.push({
      keyword: kwInfo.keyword,
      keywordSlug: kwInfo.slug,
      appName: appNameMap.get(appSlug) || appSlug,
      appSlug,
      isTracked: trackedSlugs.has(appSlug),
      isCompetitor: competitorSlugs.has(appSlug),
      yesterdayPosition: yesterdayPos,
      todayPosition: todayPos,
      change,
      type,
    });
  }

  // Sort: improved first, then new entries, dropped, dropped out
  const typeOrder = { improved: 0, new_entry: 1, dropped: 2, dropped_out: 3, unchanged: 4 };
  rankingChanges.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

  // Build competitor summaries
  const competitorSummaries: CompetitorSummary[] = [];

  for (const slug of competitorSlugs) {
    // Get latest app snapshots for today and yesterday
    const [todaySnap] = await db
      .select({
        averageRating: appSnapshots.averageRating,
        ratingCount: appSnapshots.ratingCount,
      })
      .from(appSnapshots)
      .where(
        and(
          eq(appSnapshots.appSlug, slug),
          gte(appSnapshots.scrapedAt, todayStart)
        )
      )
      .orderBy(desc(appSnapshots.scrapedAt))
      .limit(1);

    const [yesterdaySnap] = await db
      .select({
        averageRating: appSnapshots.averageRating,
        ratingCount: appSnapshots.ratingCount,
      })
      .from(appSnapshots)
      .where(
        and(
          eq(appSnapshots.appSlug, slug),
          gte(appSnapshots.scrapedAt, yesterdayStart),
          lt(appSnapshots.scrapedAt, todayStart)
        )
      )
      .orderBy(desc(appSnapshots.scrapedAt))
      .limit(1);

    // Keyword positions for this competitor
    const keywordPositions = trackedKws.map((kw) => {
      const key = `${slug}::${kw.keywordId}`;
      const todayPos = todayMap.get(key) ?? null;
      const yesterdayPos = yesterdayMap.get(key) ?? null;
      const change =
        todayPos !== null && yesterdayPos !== null
          ? yesterdayPos - todayPos
          : null;
      return { keyword: kw.keyword, position: todayPos, change };
    });

    const todayRating = todaySnap?.averageRating ?? null;
    const yesterdayRating = yesterdaySnap?.averageRating ?? null;
    const ratingChange =
      todayRating !== null && yesterdayRating !== null
        ? parseFloat(todayRating) - parseFloat(yesterdayRating)
        : null;

    competitorSummaries.push({
      appName: appNameMap.get(slug) || slug,
      appSlug: slug,
      todayRating,
      yesterdayRating,
      ratingChange,
      todayReviews: todaySnap?.ratingCount ?? null,
      yesterdayReviews: yesterdaySnap?.ratingCount ?? null,
      reviewsChange:
        todaySnap?.ratingCount != null && yesterdaySnap?.ratingCount != null
          ? todaySnap.ratingCount - yesterdaySnap.ratingCount
          : null,
      keywordPositions,
    });
  }

  const summary = {
    improved: rankingChanges.filter((r) => r.type === "improved").length,
    dropped: rankingChanges.filter((r) => r.type === "dropped").length,
    newEntries: rankingChanges.filter((r) => r.type === "new_entry").length,
    droppedOut: rankingChanges.filter((r) => r.type === "dropped_out").length,
    unchanged: 0,
  };

  // If no changes at all, skip
  if (
    rankingChanges.length === 0 &&
    competitorSummaries.every(
      (c) => c.ratingChange === null && c.reviewsChange === null
    )
  ) {
    return null;
  }

  const dateStr = now.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return {
    accountName: account.name,
    date: dateStr,
    rankingChanges,
    competitorSummaries,
    summary,
  };
}
