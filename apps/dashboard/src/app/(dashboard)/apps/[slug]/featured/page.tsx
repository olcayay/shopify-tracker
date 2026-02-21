import { getAppFeaturedPlacements } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

  // Group by section
  const grouped = new Map<
    string,
    {
      surface: string;
      surfaceDetail: string;
      sectionHandle: string;
      sectionTitle: string;
      dates: {
        seenDate: string;
        timesSeenInDay: number;
        position: number | null;
      }[];
    }
  >();

  for (const s of sightings) {
    const key = `${s.surface}:${s.surfaceDetail}:${s.sectionHandle}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        surface: s.surface,
        surfaceDetail: s.surfaceDetail,
        sectionHandle: s.sectionHandle,
        sectionTitle: s.sectionTitle || s.sectionHandle,
        dates: [],
      });
    }
    grouped.get(key)!.dates.push({
      seenDate: s.seenDate,
      timesSeenInDay: s.timesSeenInDay,
      position: s.position,
    });
  }

  const sections = [...grouped.values()];

  return (
    <div className="space-y-4">
      {sections.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          This app has not been observed in any featured sections yet.
        </p>
      )}

      {sections.map((section) => (
        <Card
          key={`${section.surface}:${section.surfaceDetail}:${section.sectionHandle}`}
        >
          <CardHeader>
            <CardTitle className="flex items-baseline gap-2 text-base">
              {section.sectionTitle}
              <Badge variant="outline" className="text-xs">
                {section.surface === "home"
                  ? "Homepage"
                  : section.surfaceDetail}
              </Badge>
              <span className="text-sm font-normal text-muted-foreground">
                seen on {section.dates.length} day
                {section.dates.length !== 1 ? "s" : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {section.dates.map((d) => (
                <div key={d.seenDate} className="contents">
                  <span className="text-muted-foreground">{d.seenDate}</span>
                  <span>
                    Position {d.position ?? "?"}
                    {d.timesSeenInDay > 1 &&
                      ` (seen ${d.timesSeenInDay}x)`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
