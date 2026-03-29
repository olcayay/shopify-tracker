/**
 * Weekly summary email data builder.
 * Aggregates 7 days of ranking changes, competitor activity, and review metrics.
 */
import { eq, and, sql, gte, lt, desc } from "drizzle-orm";
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
  apps,
} from "@appranks/db";
import { getLocalDayBoundaries } from "./timezone.js";

export interface WeeklyRankingSummary {
  keyword: string;
  keywordSlug: string;
  appName: string;
  appSlug: string;
  isTracked: boolean;
  startPosition: number | null;
  endPosition: number | null;
  netChange: number | null;
  bestPosition: number | null;
}

export interface WeeklyCompetitorSummary {
  appName: string;
  appSlug: string;
  startRating: string | null;
  endRating: string | null;
  ratingChange: number | null;
  startReviews: number | null;
  endReviews: number | null;
  reviewsChange: number | null;
}

export interface WeeklyDigestData {
  accountName: string;
  weekRange: string;
  platform?: string;
  rankings: WeeklyRankingSummary[];
  competitors: WeeklyCompetitorSummary[];
  summary: {
    improved: number;
    dropped: number;
    unchanged: number;
    totalKeywords: number;
  };
}

export interface WeeklyRecipient {
  email: string;
  name: string;
  accountId: string;
  timezone: string;
}

export async function getWeeklyRecipients(db: Database): Promise<WeeklyRecipient[]> {
  return db
    .select({
      email: users.email,
      name: users.name,
      accountId: users.accountId,
      timezone: users.timezone,
    })
    .from(users)
    .innerJoin(accounts, eq(accounts.id, users.accountId))
    .where(and(eq(users.emailDigestEnabled, true), eq(accounts.isSuspended, false)));
}

export async function buildWeeklyForAccount(
  db: Database,
  accountId: string,
  timezone?: string
): Promise<WeeklyDigestData | null> {
  const [account] = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, accountId));
  if (!account) return null;

  const trackedKws = await db
    .select({
      keywordId: accountTrackedKeywords.keywordId,
      keyword: trackedKeywords.keyword,
      slug: trackedKeywords.slug,
    })
    .from(accountTrackedKeywords)
    .innerJoin(trackedKeywords, eq(trackedKeywords.id, accountTrackedKeywords.keywordId))
    .where(eq(accountTrackedKeywords.accountId, accountId));
  if (trackedKws.length === 0) return null;

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

  const relevantAppIds = new Set([...trackedAppIds, ...competitorAppIds]);
  if (relevantAppIds.size === 0) return null;

  // Date boundaries — 7 days ago to today
  const now = new Date();
  const { todayStart } = timezone
    ? getLocalDayBoundaries(now, timezone)
    : { todayStart: (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; })() };
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const keywordIds = trackedKws.map((k) => k.keywordId);
  const appIdList = [...relevantAppIds];

  // Get first-of-week and latest rankings
  const rankRows = await db.execute(sql`
    WITH first_rank AS (
      SELECT DISTINCT ON (app_id, keyword_id) app_id, keyword_id, position, scraped_at
      FROM app_keyword_rankings
      WHERE keyword_id = ANY(${sql.raw(`ARRAY[${keywordIds.join(',')}]`)})
        AND app_id = ANY(${sql.raw(`ARRAY[${appIdList.join(',')}]`)})
        AND scraped_at >= ${weekStart} AND scraped_at < ${todayStart}
      ORDER BY app_id, keyword_id, scraped_at ASC
    ),
    last_rank AS (
      SELECT DISTINCT ON (app_id, keyword_id) app_id, keyword_id, position, scraped_at
      FROM app_keyword_rankings
      WHERE keyword_id = ANY(${sql.raw(`ARRAY[${keywordIds.join(',')}]`)})
        AND app_id = ANY(${sql.raw(`ARRAY[${appIdList.join(',')}]`)})
        AND scraped_at >= ${weekStart}
      ORDER BY app_id, keyword_id, scraped_at DESC
    )
    SELECT f.app_id, f.keyword_id,
           f.position AS start_pos, l.position AS end_pos
    FROM first_rank f
    FULL OUTER JOIN last_rank l ON f.app_id = l.app_id AND f.keyword_id = l.keyword_id
  `);

  // App names
  const appRows = await db
    .select({ id: apps.id, slug: apps.slug, name: apps.name })
    .from(apps)
    .where(sql`${apps.id} IN (${sql.join(appIdList.map((id) => sql`${id}`), sql`, `)})`);
  const appNameMap = new Map(appRows.map((r) => [r.id, r.name]));
  const appSlugMap = new Map(appRows.map((r) => [r.id, r.slug]));
  const kwMap = new Map(trackedKws.map((k) => [k.keywordId, { keyword: k.keyword, slug: k.slug }]));

  const rankings: WeeklyRankingSummary[] = [];
  const rows = ((rankRows as any).rows ?? rankRows) as any[];

  for (const row of rows) {
    const appId = row.app_id;
    const keywordId = row.keyword_id;
    const kw = kwMap.get(keywordId);
    if (!kw) continue;

    const startPos = row.start_pos != null ? parseInt(row.start_pos, 10) : null;
    const endPos = row.end_pos != null ? parseInt(row.end_pos, 10) : null;
    const netChange = startPos != null && endPos != null ? startPos - endPos : null;

    if (netChange === 0) continue; // Skip unchanged

    rankings.push({
      keyword: kw.keyword,
      keywordSlug: kw.slug,
      appName: appNameMap.get(appId) || String(appId),
      appSlug: appSlugMap.get(appId) || String(appId),
      isTracked: trackedAppIds.has(appId),
      startPosition: startPos,
      endPosition: endPos,
      netChange,
      bestPosition: endPos,
    });
  }

  rankings.sort((a, b) => (b.netChange || 0) - (a.netChange || 0));

  // Competitor summaries
  const competitors: WeeklyCompetitorSummary[] = [];
  for (const compAppId of competitorAppIds) {
    const snapRows = await db.execute(sql`
      SELECT average_rating, rating_count, scraped_at
      FROM app_snapshots
      WHERE app_id = ${compAppId} AND scraped_at >= ${weekStart}
      ORDER BY scraped_at ASC
    `);
    const snaps = ((snapRows as any).rows ?? snapRows) as any[];
    if (snaps.length < 2) continue;

    const first = snaps[0];
    const last = snaps[snaps.length - 1];
    const ratingChange = first.average_rating && last.average_rating
      ? parseFloat(last.average_rating) - parseFloat(first.average_rating)
      : null;
    const reviewsChange = first.rating_count != null && last.rating_count != null
      ? last.rating_count - first.rating_count
      : null;

    if (ratingChange === 0 && reviewsChange === 0) continue;

    competitors.push({
      appName: appNameMap.get(compAppId) || String(compAppId),
      appSlug: appSlugMap.get(compAppId) || String(compAppId),
      startRating: first.average_rating,
      endRating: last.average_rating,
      ratingChange,
      startReviews: first.rating_count,
      endReviews: last.rating_count,
      reviewsChange,
    });
  }

  const improved = rankings.filter((r) => r.netChange != null && r.netChange > 0).length;
  const dropped = rankings.filter((r) => r.netChange != null && r.netChange < 0).length;

  if (rankings.length === 0 && competitors.length === 0) return null;

  const weekRangeStr = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${todayStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return {
    accountName: account.name,
    weekRange: weekRangeStr,
    rankings,
    competitors,
    summary: {
      improved,
      dropped,
      unchanged: rankings.length - improved - dropped,
      totalKeywords: trackedKws.length,
    },
  };
}
