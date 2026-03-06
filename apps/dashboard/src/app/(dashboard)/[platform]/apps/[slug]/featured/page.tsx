import { getAppFeaturedPlacements } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FeaturedHistory } from "./featured-history";

export default async function AppFeaturedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let data: any = { sightings: [] };
  try {
    data = await getAppFeaturedPlacements(slug);
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
                {new Set(
                  sightings.map(
                    (s: any) =>
                      `${s.surface}:${s.surfaceDetail}:${s.sectionHandle}`
                  )
                ).size}{" "}
                sections, last 30 days
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
