import { eq, and, sql, desc } from "drizzle-orm";
import type { Database } from "@appranks/db";
import {
  accounts,
  users,
  accountTrackedKeywords,
  accountTrackedApps,
  accountCompetitorApps,
  trackedKeywords,
  appKeywordRankings,
  appSnapshots,
  appCategoryRankings,
  categories,
  apps,
  userAppEmailPreferences,
} from "@appranks/db";
import { getLocalDayBoundaries } from "./timezone.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("email:digest-builder");

export interface RankingChange {
  keyword: string;
  keywordSlug: string;
  appName: string;
  appSlug: string;
  yesterdayPosition: number | null;
  todayPosition: number | null;
  change: number | null; // positive = improved (moved up), negative = dropped
  type: "improved" | "dropped" | "new_entry" | "dropped_out" | "unchanged";
}

export interface CategoryRankingChange {
  categorySlug: string;
  categoryName: string;
  yesterdayPosition: number | null;
  todayPosition: number | null;
  change: number | null;
  type: "improved" | "dropped" | "new_entry" | "dropped_out" | "unchanged";
}

export interface TrackedAppDigest {
  appId: number;
  appName: string;
  appSlug: string;
  platform: string;
  keywordChanges: RankingChange[];
  categoryChanges: CategoryRankingChange[];
  ratingToday: number | null;
  ratingYesterday: number | null;
  ratingChange: number | null;
  reviewCountToday: number | null;
  reviewCountYesterday: number | null;
  reviewCountChange: number | null;
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
  platform?: string;
  trackedApps: TrackedAppDigest[];
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
  userId: string;
  email: string;
  name: string;
  accountId: string;
  timezone: string;
  lastDigestSentAt: Date | null;
}

/**
 * Get all users who should receive the daily digest.
 * Includes timezone and lastDigestSentAt for timezone-aware scheduling.
 */
export async function getDigestRecipients(
  db: Database
): Promise<DigestRecipient[]> {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      accountId: users.accountId,
      timezone: users.timezone,
      lastDigestSentAt: users.lastDigestSentAt,
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
 * Build digest data for a specific account.
 * @param timezone - IANA timezone for date boundaries (defaults to UTC)
 */
export async function buildDigestForAccount(
  db: Database,
  accountId: string,
  timezone?: string,
  userId?: string,
): Promise<DigestData | null> {
  const startMs = Date.now();
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

  // Get tracked app IDs and competitor app IDs
  const trackedAppRows = await db
    .select({ appId: accountTrackedApps.appId })
    .from(accountTrackedApps)
    .where(eq(accountTrackedApps.accountId, accountId));
  const trackedAppIds = new Set(trackedAppRows.map((r) => r.appId));

  const competitorAppRows = await db
    .select({ competitorAppId: accountCompetitorApps.competitorAppId })
    .from(accountCompetitorApps)
    .where(eq(accountCompetitorApps.accountId, accountId));
  const competitorAppIds = new Set(competitorAppRows.map((r) => r.competitorAppId));

  // Filter out apps the user has opted out of daily digest
  if (userId) {
    const optedOutApps = await db
      .select({ appId: userAppEmailPreferences.appId })
      .from(userAppEmailPreferences)
      .where(
        and(
          eq(userAppEmailPreferences.userId, userId),
          eq(userAppEmailPreferences.dailyDigestEnabled, false),
        ),
      );
    const optedOutIds = new Set(optedOutApps.map((r) => r.appId));
    for (const id of optedOutIds) {
      trackedAppIds.delete(id);
      competitorAppIds.delete(id);
    }
  }

  // Relevant app IDs (tracked + competitors)
  const relevantAppIds = new Set([...trackedAppIds, ...competitorAppIds]);
  if (relevantAppIds.size === 0) return null;

  // Date boundaries (timezone-aware if timezone is provided)
  const now = new Date();
  const { todayStart, yesterdayStart } = timezone
    ? getLocalDayBoundaries(now, timezone)
    : (() => {
        const ts = new Date(now);
        ts.setHours(0, 0, 0, 0);
        const ys = new Date(ts);
        ys.setDate(ys.getDate() - 1);
        return { todayStart: ts, yesterdayStart: ys };
      })();

  const keywordIds = trackedKws.map((k) => k.keywordId);

  // Get today's latest rankings for relevant apps x keywords
  const todayRankings = await db
    .select({
      appId: appKeywordRankings.appId,
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
        sql`${appKeywordRankings.scrapedAt} >= ${todayStart.toISOString()}`,
        sql`${appKeywordRankings.appId} IN (${sql.join(
          [...relevantAppIds].map((id) => sql`${id}`),
          sql`, `
        )})`
      )
    )
    .orderBy(desc(appKeywordRankings.scrapedAt));

  // Get yesterday's rankings
  const yesterdayRankings = await db
    .select({
      appId: appKeywordRankings.appId,
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
        sql`${appKeywordRankings.scrapedAt} >= ${yesterdayStart.toISOString()}`,
        sql`${appKeywordRankings.scrapedAt} < ${todayStart.toISOString()}`,
        sql`${appKeywordRankings.appId} IN (${sql.join(
          [...relevantAppIds].map((id) => sql`${id}`),
          sql`, `
        )})`
      )
    )
    .orderBy(desc(appKeywordRankings.scrapedAt));

  // Build maps: (appId, keywordId) -> latest position
  // For today, take the latest (first due to desc order)
  const todayMap = new Map<string, number>();
  for (const r of todayRankings) {
    const key = `${r.appId}::${r.keywordId}`;
    if (!todayMap.has(key) && r.position != null) todayMap.set(key, r.position);
  }

  const yesterdayMap = new Map<string, number>();
  for (const r of yesterdayRankings) {
    const key = `${r.appId}::${r.keywordId}`;
    if (!yesterdayMap.has(key) && r.position != null) yesterdayMap.set(key, r.position);
  }

  // Get app names and slugs for all relevant app IDs
  const allAppIds = [...relevantAppIds];
  const appRows = await db
    .select({ id: apps.id, slug: apps.slug, name: apps.name, platform: apps.platform })
    .from(apps)
    .where(
      sql`${apps.id} IN (${sql.join(
        allAppIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );
  const appNameMap = new Map(appRows.map((r) => [r.id, r.name]));
  const appSlugMap = new Map(appRows.map((r) => [r.id, r.slug]));

  // Build keyword map
  const keywordMap = new Map(
    trackedKws.map((k) => [k.keywordId, { keyword: k.keyword, slug: k.slug }])
  );

  // Compare rankings — only for tracked apps (competitor keyword data stays in todayMap/yesterdayMap for competitor loop)
  const trackedRankingChanges: RankingChange[] = [];
  const allKeys = new Set([...todayMap.keys(), ...yesterdayMap.keys()]);

  for (const key of allKeys) {
    const [appIdStr, keywordIdStr] = key.split("::");
    const appId = parseInt(appIdStr, 10);

    // Only build ranking changes for tracked apps
    if (!trackedAppIds.has(appId)) continue;

    const keywordId = parseInt(keywordIdStr, 10);
    const kwInfo = keywordMap.get(keywordId);
    if (!kwInfo) continue;

    const appSlug = appSlugMap.get(appId) || String(appId);
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

    trackedRankingChanges.push({
      keyword: kwInfo.keyword,
      keywordSlug: kwInfo.slug,
      appName: appNameMap.get(appId) || appSlug,
      appSlug,
      yesterdayPosition: yesterdayPos,
      todayPosition: todayPos,
      change,
      type,
    });
  }

  // --- Build per-tracked-app digests ---
  const trackedAppDigests: TrackedAppDigest[] = [];

  // Batch fetch app snapshots for all relevant apps (today + yesterday) — avoids N+1
  const allAppIdList = [...relevantAppIds];
  const snapshotDeltaMap = new Map<number, { todaySnap: any; yesterdaySnap: any }>();

  if (allAppIdList.length > 0) {
    const todaySnaps = await db
      .select({
        appId: appSnapshots.appId,
        averageRating: appSnapshots.averageRating,
        ratingCount: appSnapshots.ratingCount,
        scrapedAt: appSnapshots.scrapedAt,
      })
      .from(appSnapshots)
      .where(
        and(
          sql`${appSnapshots.appId} IN (${sql.join(
            allAppIdList.map((id) => sql`${id}`),
            sql`, `
          )})`,
          sql`${appSnapshots.scrapedAt} >= ${todayStart.toISOString()}`
        )
      )
      .orderBy(desc(appSnapshots.scrapedAt));

    const yesterdaySnaps = await db
      .select({
        appId: appSnapshots.appId,
        averageRating: appSnapshots.averageRating,
        ratingCount: appSnapshots.ratingCount,
        scrapedAt: appSnapshots.scrapedAt,
      })
      .from(appSnapshots)
      .where(
        and(
          sql`${appSnapshots.appId} IN (${sql.join(
            allAppIdList.map((id) => sql`${id}`),
            sql`, `
          )})`,
          sql`${appSnapshots.scrapedAt} >= ${yesterdayStart.toISOString()}`,
          sql`${appSnapshots.scrapedAt} < ${todayStart.toISOString()}`
        )
      )
      .orderBy(desc(appSnapshots.scrapedAt));

    // Group by appId, take latest per app (results are ordered by scrapedAt DESC)
    for (const snap of todaySnaps) {
      if (!snapshotDeltaMap.has(snap.appId)) {
        snapshotDeltaMap.set(snap.appId, { todaySnap: snap, yesterdaySnap: null });
      }
    }
    for (const snap of yesterdaySnaps) {
      const entry = snapshotDeltaMap.get(snap.appId);
      if (entry && !entry.yesterdaySnap) {
        entry.yesterdaySnap = snap;
      } else if (!entry) {
        snapshotDeltaMap.set(snap.appId, { todaySnap: null, yesterdaySnap: snap });
      }
    }
  }

  function getAppSnapshotDelta(appId: number) {
    const entry = snapshotDeltaMap.get(appId);
    return { todaySnap: entry?.todaySnap ?? null, yesterdaySnap: entry?.yesterdaySnap ?? null };
  }

  // Get category rankings for tracked apps
  const trackedAppIdList = [...trackedAppIds];
  let todayCatRankings: Array<{ appId: number; categorySlug: string; position: number }> = [];
  let yesterdayCatRankings: Array<{ appId: number; categorySlug: string; position: number }> = [];

  if (trackedAppIdList.length > 0) {
    todayCatRankings = await db
      .select({
        appId: appCategoryRankings.appId,
        categorySlug: appCategoryRankings.categorySlug,
        position: appCategoryRankings.position,
      })
      .from(appCategoryRankings)
      .where(
        and(
          sql`${appCategoryRankings.appId} IN (${sql.join(
            trackedAppIdList.map((id) => sql`${id}`),
            sql`, `
          )})`,
          sql`${appCategoryRankings.scrapedAt} >= ${todayStart.toISOString()}`
        )
      )
      .orderBy(desc(appCategoryRankings.scrapedAt));

    yesterdayCatRankings = await db
      .select({
        appId: appCategoryRankings.appId,
        categorySlug: appCategoryRankings.categorySlug,
        position: appCategoryRankings.position,
      })
      .from(appCategoryRankings)
      .where(
        and(
          sql`${appCategoryRankings.appId} IN (${sql.join(
            trackedAppIdList.map((id) => sql`${id}`),
            sql`, `
          )})`,
          sql`${appCategoryRankings.scrapedAt} >= ${yesterdayStart.toISOString()}`,
          sql`${appCategoryRankings.scrapedAt} < ${todayStart.toISOString()}`
        )
      )
      .orderBy(desc(appCategoryRankings.scrapedAt));
  }

  // Build category ranking maps: (appId::categorySlug) -> latest position
  const todayCatMap = new Map<string, number>();
  for (const r of todayCatRankings) {
    const key = `${r.appId}::${r.categorySlug}`;
    if (!todayCatMap.has(key)) todayCatMap.set(key, r.position);
  }
  const yesterdayCatMap = new Map<string, number>();
  for (const r of yesterdayCatRankings) {
    const key = `${r.appId}::${r.categorySlug}`;
    if (!yesterdayCatMap.has(key)) yesterdayCatMap.set(key, r.position);
  }

  // Get category display names for all slugs
  const allCatSlugs = new Set<string>();
  for (const key of [...todayCatMap.keys(), ...yesterdayCatMap.keys()]) {
    allCatSlugs.add(key.split("::")[1]);
  }
  const categoryNameMap = new Map<string, string>();
  if (allCatSlugs.size > 0) {
    const catRows = await db
      .select({ slug: categories.slug, title: categories.title })
      .from(categories)
      .where(
        sql`${categories.slug} IN (${sql.join(
          [...allCatSlugs].map((s) => sql`${s}`),
          sql`, `
        )})`
      );
    for (const r of catRows) {
      categoryNameMap.set(r.slug, r.title);
    }
  }

  // Get app platform info
  const appPlatformMap = new Map<number, string>();
  for (const r of appRows) {
    appPlatformMap.set(r.id, r.platform);
  }

  for (const trackedAppId of trackedAppIds) {
    const appSlug = appSlugMap.get(trackedAppId) || String(trackedAppId);
    const appName = appNameMap.get(trackedAppId) || appSlug;

    // Keyword changes for this tracked app (sorted by absolute change desc)
    const appKeywordChanges = trackedRankingChanges
      .filter((r) => r.appSlug === appSlug)
      .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0));

    // Category ranking changes for this tracked app
    const appCatChanges: CategoryRankingChange[] = [];
    const appCatKeys = new Set<string>();
    for (const key of [...todayCatMap.keys(), ...yesterdayCatMap.keys()]) {
      if (key.startsWith(`${trackedAppId}::`)) {
        appCatKeys.add(key);
      }
    }
    for (const key of appCatKeys) {
      const catSlug = key.split("::")[1];
      const todayPos = todayCatMap.get(key) ?? null;
      const yesterdayPos = yesterdayCatMap.get(key) ?? null;

      let catType: CategoryRankingChange["type"];
      let catChange: number | null = null;

      if (todayPos !== null && yesterdayPos !== null) {
        catChange = yesterdayPos - todayPos;
        if (catChange > 0) catType = "improved";
        else if (catChange < 0) catType = "dropped";
        else catType = "unchanged";
      } else if (todayPos !== null && yesterdayPos === null) {
        catType = "new_entry";
      } else {
        catType = "dropped_out";
      }

      if (catType === "unchanged") continue;

      appCatChanges.push({
        categorySlug: catSlug,
        categoryName: categoryNameMap.get(catSlug) || catSlug,
        yesterdayPosition: yesterdayPos,
        todayPosition: todayPos,
        change: catChange,
        type: catType,
      });
    }
    appCatChanges.sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0));

    // Rating/review changes
    const { todaySnap, yesterdaySnap } = getAppSnapshotDelta(trackedAppId);
    const ratingToday = todaySnap?.averageRating ? parseFloat(todaySnap.averageRating) : null;
    const ratingYesterday = yesterdaySnap?.averageRating ? parseFloat(yesterdaySnap.averageRating) : null;
    const ratingChange = ratingToday !== null && ratingYesterday !== null
      ? Math.round((ratingToday - ratingYesterday) * 100) / 100
      : null;
    const reviewCountToday = todaySnap?.ratingCount ?? null;
    const reviewCountYesterday = yesterdaySnap?.ratingCount ?? null;
    const reviewCountChange = reviewCountToday !== null && reviewCountYesterday !== null
      ? reviewCountToday - reviewCountYesterday
      : null;

    trackedAppDigests.push({
      appId: trackedAppId,
      appName,
      appSlug,
      platform: appPlatformMap.get(trackedAppId) || "shopify",
      keywordChanges: appKeywordChanges,
      categoryChanges: appCatChanges,
      ratingToday,
      ratingYesterday,
      ratingChange,
      reviewCountToday,
      reviewCountYesterday,
      reviewCountChange,
    });
  }

  // Build competitor summaries
  const competitorSummaries: CompetitorSummary[] = [];

  for (const compAppId of competitorAppIds) {
    const { todaySnap, yesterdaySnap } = getAppSnapshotDelta(compAppId);

    const compSlug = appSlugMap.get(compAppId) || String(compAppId);

    // Keyword positions for this competitor
    const keywordPositions = trackedKws.map((kw) => {
      const key = `${compAppId}::${kw.keywordId}`;
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
      appName: appNameMap.get(compAppId) || compSlug,
      appSlug: compSlug,
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

  // Summary counts only for tracked app changes
  const summary = {
    improved: trackedRankingChanges.filter((r) => r.type === "improved").length,
    dropped: trackedRankingChanges.filter((r) => r.type === "dropped").length,
    newEntries: trackedRankingChanges.filter((r) => r.type === "new_entry").length,
    droppedOut: trackedRankingChanges.filter((r) => r.type === "dropped_out").length,
    unchanged: 0,
  };

  // If no changes at all, skip
  const hasTrackedChanges = trackedAppDigests.some(
    (a) =>
      a.keywordChanges.length > 0 ||
      a.categoryChanges.length > 0 ||
      a.ratingChange !== null ||
      a.reviewCountChange !== null
  );
  if (
    !hasTrackedChanges &&
    competitorSummaries.every(
      (c) => c.ratingChange === null && c.reviewsChange === null
    )
  ) {
    return null;
  }

  const dateStr = now.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  log.info("digest built for account", {
    accountId,
    trackedApps: trackedAppDigests.length,
    competitors: competitorSummaries.length,
    keywords: keywordIds.length,
    elapsedMs: Date.now() - startMs,
  });

  return {
    accountName: account.name,
    date: dateStr,
    trackedApps: trackedAppDigests,
    competitorSummaries,
    summary,
  };
}

/**
 * Split a combined DigestData into per-platform DigestData objects.
 * Each returned digest contains only apps and competitors for one platform,
 * with recalculated summary counts. Platforms with no changes are omitted.
 */
export function splitDigestByPlatform(data: DigestData): DigestData[] {
  // Collect all unique platforms from tracked apps and competitors
  const platformSet = new Set<string>();
  for (const app of data.trackedApps) {
    platformSet.add(app.platform);
  }

  // We need competitor platforms too — get them from the app data
  // Competitors don't have a platform field in CompetitorSummary,
  // so we include them in ALL platform digests (they are relevant across platforms)
  // Actually, competitors are account-level (not platform-specific), so we skip them
  // in per-platform digests and only include them if the user tracks apps on that platform.

  const results: DigestData[] = [];

  for (const platform of platformSet) {
    const platformApps = data.trackedApps.filter((a) => a.platform === platform);

    // Recalculate summary for this platform's apps only
    const allKwChanges = platformApps.flatMap((a) => a.keywordChanges);
    const summary = {
      improved: allKwChanges.filter((r) => r.type === "improved").length,
      dropped: allKwChanges.filter((r) => r.type === "dropped").length,
      newEntries: allKwChanges.filter((r) => r.type === "new_entry").length,
      droppedOut: allKwChanges.filter((r) => r.type === "dropped_out").length,
      unchanged: 0,
    };

    // Check if this platform has any actual changes
    const hasTrackedChanges = platformApps.some(
      (a) =>
        a.keywordChanges.length > 0 ||
        a.categoryChanges.length > 0 ||
        a.ratingChange !== null ||
        a.reviewCountChange !== null
    );

    // Include competitors in each platform digest (they're account-level)
    const hasCompetitorChanges = data.competitorSummaries.some(
      (c) => c.ratingChange !== null || c.reviewsChange !== null
    );

    if (!hasTrackedChanges && !hasCompetitorChanges) continue;

    results.push({
      accountName: data.accountName,
      date: data.date,
      platform,
      trackedApps: platformApps,
      competitorSummaries: data.competitorSummaries,
      summary,
    });
  }

  return results;
}
