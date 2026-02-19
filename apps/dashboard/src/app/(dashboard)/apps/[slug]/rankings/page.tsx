import Link from "next/link";
import { formatDateOnly } from "@/lib/format-date";
import { getAppRankings } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RankingChart } from "@/components/ranking-chart";
import { AdHeatmap } from "@/components/ad-heatmap";

export default async function RankingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let rankings: any;
  try {
    rankings = await getAppRankings(slug);
  } catch {
    rankings = {};
  }

  // Group keyword ads
  const adsByKeyword = new Map<string, { keyword: string; keywordSlug: string; lastSeen: string; totalSightings: number; sightings: any[] }>();
  if (rankings?.keywordAds?.length > 0) {
    for (const ad of rankings.keywordAds) {
      const existing = adsByKeyword.get(ad.keyword);
      if (existing) {
        existing.totalSightings += ad.timesSeenInDay;
        existing.sightings.push(ad);
        if (ad.seenDate > existing.lastSeen) existing.lastSeen = ad.seenDate;
      } else {
        adsByKeyword.set(ad.keyword, {
          keyword: ad.keyword,
          keywordSlug: ad.keywordSlug,
          lastSeen: ad.seenDate,
          totalSightings: ad.timesSeenInDay,
          sightings: [ad],
        });
      }
    }
  }
  const groupedAds = [...adsByKeyword.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));

  return (
    <div className="space-y-4">
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
                label: r.categoryTitle || r.categorySlug,
                slug: r.categorySlug,
                linkPrefix: "/categories/",
              }))}
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
                linkPrefix: "/keywords/",
              }))}
            />
          </CardContent>
        </Card>
      )}

      {!rankings?.categoryRankings?.length &&
        !rankings?.keywordRankings?.length &&
        groupedAds.length === 0 && (
          <p className="text-muted-foreground">
            No ranking data yet. Run scrapers to collect data.
          </p>
        )}

      {groupedAds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Keyword Ads ({groupedAds.length} keywords)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <AdHeatmap
              sightings={rankings.keywordAds.map((ad: any) => ({
                slug: ad.keywordSlug,
                name: ad.keyword,
                seenDate: ad.seenDate,
                timesSeenInDay: ad.timesSeenInDay,
              }))}
              linkPrefix="/keywords/"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className="text-right">Total Sightings</TableHead>
                  <TableHead className="text-right">Days Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedAds.map((ad) => (
                  <TableRow key={ad.keyword}>
                    <TableCell>
                      <Link
                        href={`/keywords/${ad.keywordSlug}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {ad.keyword}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateOnly(ad.lastSeen)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {ad.totalSightings}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {ad.sightings.length}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
