import { getAppAdSightings, getAppCategoryAdSightings } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppAdHistory } from "./ad-history";
import { AdHeatmap } from "@/components/ad-heatmap";

export default async function AppAdsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let keywordData: any = { sightings: [] };
  let categoryData: any = { sightings: [] };
  try {
    [keywordData, categoryData] = await Promise.all([
      getAppAdSightings(slug).catch(() => ({ sightings: [] })),
      getAppCategoryAdSightings(slug).catch(() => ({ sightings: [] })),
    ]);
  } catch {
    // fallback
  }

  const keywordSightings = keywordData?.sightings || [];
  const categorySightings = categoryData?.sightings || [];

  const categoryHeatmapData = categorySightings.map((s: any) => ({
    slug: s.categorySlug,
    name: s.categoryTitle,
    seenDate: s.seenDate,
    timesSeenInDay: s.timesSeenInDay,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            Keyword Ad History
            {keywordSightings.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {new Set(keywordSightings.map((s: any) => s.keywordSlug)).size}{" "}
                keywords, last 30 days
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AppAdHistory sightings={keywordSightings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Category Ad History
            {categorySightings.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {new Set(categorySightings.map((s: any) => s.categorySlug)).size}{" "}
                categories, last 30 days
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categoryHeatmapData.length > 0 ? (
            <AdHeatmap
              sightings={categoryHeatmapData}
              linkPrefix="/categories/"
            />
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No category ad sightings recorded for this app yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
