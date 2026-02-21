import { getAppAdSightings } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppAdHistory } from "./ad-history";

export default async function AppAdsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let data: any = { sightings: [] };
  try {
    data = await getAppAdSightings(slug);
  } catch {
    // fallback
  }

  const sightings = data?.sightings || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            Ad History
            {sightings.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {new Set(sightings.map((s: any) => s.keywordSlug)).size}{" "}
                keywords, last 30 days
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AppAdHistory sightings={sightings} />
        </CardContent>
      </Card>
    </div>
  );
}
