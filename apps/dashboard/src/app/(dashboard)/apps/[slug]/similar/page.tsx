import { getAppSimilarApps, getAccountTrackedApps, getAccountCompetitors } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdHeatmap } from "@/components/ad-heatmap";

export default async function SimilarAppsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let data: any = {};
  let trackedSlugs: string[] = [];
  let competitorSlugs: string[] = [];

  try {
    [data, trackedSlugs, competitorSlugs] = await Promise.all([
      getAppSimilarApps(slug).catch(() => ({})),
      getAccountTrackedApps()
        .then((rows: any[]) => rows.map((r) => r.appSlug))
        .catch(() => []),
      getAccountCompetitors()
        .then((rows: any[]) => rows.map((r) => r.appSlug))
        .catch(() => []),
    ]);
  } catch {
    // fallback
  }

  const toSightings = (items: any[]) =>
    items.map((s: any) => ({
      slug: s.slug,
      name: s.name,
      seenDate: s.seenDate,
      timesSeenInDay: s.timesSeenInDay ?? 1,
      iconUrl: s.iconUrl,
    }));

  const directSightings = toSightings(data?.direct || []);
  const reverseSightings = toSightings(data?.reverse || []);
  const secondDegreeSightings = toSightings(data?.secondDegree || []);

  const hasAnyData =
    directSightings.length > 0 ||
    reverseSightings.length > 0 ||
    secondDegreeSightings.length > 0;

  return (
    <div className="space-y-4">
      {!hasAnyData && (
        <p className="text-muted-foreground">
          No similar app data yet. Data is collected automatically when this app
          is scraped.
        </p>
      )}

      {directSightings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-baseline gap-2">
              Similar Apps
              <span className="text-sm font-normal text-muted-foreground">
                Apps in this app&apos;s &quot;More apps like this&quot; section
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdHeatmap
              sightings={directSightings}
              linkPrefix="/apps/"
              trackedSlugs={trackedSlugs}
              competitorSlugs={competitorSlugs}
            />
          </CardContent>
        </Card>
      )}

      {reverseSightings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-baseline gap-2">
              Reverse Similar
              <span className="text-sm font-normal text-muted-foreground">
                Apps that list this app in their &quot;More apps like this&quot;
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdHeatmap
              sightings={reverseSightings}
              linkPrefix="/apps/"
              trackedSlugs={trackedSlugs}
              competitorSlugs={competitorSlugs}
            />
          </CardContent>
        </Card>
      )}

      {secondDegreeSightings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-baseline gap-2">
              2nd Degree Similar
              <span className="text-sm font-normal text-muted-foreground">
                Similar apps of this app&apos;s similar apps
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdHeatmap
              sightings={secondDegreeSightings}
              linkPrefix="/apps/"
              trackedSlugs={trackedSlugs}
              competitorSlugs={competitorSlugs}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
