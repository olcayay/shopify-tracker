import { getAppRankings } from "@/lib/api";
import { PLATFORMS, type PlatformId } from "@appranks/shared";
import { formatDateOnly } from "@/lib/format-date";
import { formatCategoryTitle } from "@/lib/platform-urls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RankingChart } from "@/components/ranking-chart";
import { DataFreshness } from "@/components/data-freshness";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  RANKINGS_DATE_RANGE_CONFIG,
  getDateRangeFromSearchParams,
  getFetchDaysFromStart,
  isDateWithinRange,
} from "@/lib/date-range";

export default async function V2RankingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string; slug: string }>;
  searchParams: Promise<{ days?: string; from?: string; to?: string }>;
}) {
  const { platform, slug } = await params;
  const resolvedSearchParams = await searchParams;
  const dateRange = getDateRangeFromSearchParams(resolvedSearchParams, RANKINGS_DATE_RANGE_CONFIG);

  let rankings: any;
  try {
    rankings = await getAppRankings(
      slug,
      getFetchDaysFromStart(dateRange, RANKINGS_DATE_RANGE_CONFIG),
      platform as PlatformId
    );
  } catch {
    rankings = {};
  }

  rankings = {
    ...rankings,
    categoryRankings: (rankings?.categoryRankings || []).filter((ranking: any) =>
      isDateWithinRange(ranking.scrapedAt, dateRange.from, dateRange.to)
    ),
    keywordRankings: (rankings?.keywordRankings || []).filter((ranking: any) =>
      isDateWithinRange(ranking.scrapedAt, dateRange.from, dateRange.to)
    ),
  };

  const allRankings = [...(rankings?.categoryRankings || []), ...(rankings?.keywordRankings || [])];
  const latestRanking = allRankings.length > 0
    ? allRankings.reduce((a: any, b: any) => new Date(a.scrapedAt) > new Date(b.scrapedAt) ? a : b)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DataFreshness dateStr={latestRanking?.scrapedAt} />
        <DateRangePicker config={RANKINGS_DATE_RANGE_CONFIG} />
      </div>

      {rankings?.categoryRankings?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Category Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingChart
              data={rankings.categoryRankings.map((r: any) => ({
                date: formatDateOnly(r.scrapedAt),
                position: r.position,
                label: formatCategoryTitle(platform as PlatformId, r.categorySlug, r.categoryTitle || r.categorySlug),
                slug: r.categorySlug,
                linkPrefix: `/${platform}/categories/`,
              }))}
              pageSize={PLATFORMS[platform as PlatformId]?.pageSize ?? 24}
            />
          </CardContent>
        </Card>
      )}

      {rankings?.keywordRankings?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Keyword Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingChart
              data={rankings.keywordRankings.map((r: any) => ({
                date: formatDateOnly(r.scrapedAt),
                position: r.position,
                label: r.keyword,
                slug: r.keywordSlug,
                linkPrefix: `/${platform}/keywords/`,
              }))}
              pageSize={PLATFORMS[platform as PlatformId]?.pageSize ?? 24}
            />
          </CardContent>
        </Card>
      )}

      {!rankings?.categoryRankings?.length && !rankings?.keywordRankings?.length && (
        <p className="text-muted-foreground text-center py-8">
          No ranking data yet. Rankings are collected during scheduled scrapes.
        </p>
      )}
    </div>
  );
}
