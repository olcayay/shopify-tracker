import { getAppFeaturedPlacements } from "@/lib/api";
import type { PlatformId } from "@appranks/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeaturedHistory } from "../../../../[slug]/featured/featured-history";

export default async function V2FeaturedPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { platform, slug } = await params;

  let data: any = { sightings: [] };
  try {
    data = await getAppFeaturedPlacements(slug, 30, platform as PlatformId);
  } catch {
    // fallback
  }

  const sightings = data?.sightings || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            Featured Placement History
            {sightings.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {new Set(sightings.map((s: any) => `${s.surface}:${s.surfaceDetail}:${s.sectionHandle}`)).size} sections, last 30 days
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FeaturedHistory sightings={sightings} />
        </CardContent>
      </Card>
    </div>
  );
}
