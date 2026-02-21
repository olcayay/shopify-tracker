import { getFeaturedApps, getFeaturedSections } from "@/lib/api";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdHeatmap } from "@/components/ad-heatmap";
import { ExternalLink } from "lucide-react";

export default async function FeaturedPage() {
  const [data, sections] = await Promise.all([
    getFeaturedApps(30).catch(() => ({
      sightings: [],
      trackedSlugs: [],
      competitorSlugs: [],
    })),
    getFeaturedSections(30).catch(() => []),
  ]);

  const { sightings, trackedSlugs, competitorSlugs } = data;

  // Group sightings by surface > surfaceDetail > sectionHandle
  const grouped = new Map<
    string,
    {
      surface: string;
      surfaceDetail: string;
      sectionHandle: string;
      sectionTitle: string;
      sightings: any[];
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
        sightings: [],
      });
    }
    grouped.get(key)!.sightings.push({
      slug: s.appSlug,
      name: s.appName,
      seenDate: s.seenDate,
      timesSeenInDay: s.timesSeenInDay ?? 1,
      iconUrl: s.iconUrl,
    });
  }

  // Sort: homepage first, then categories alphabetically
  const sortedGroups = [...grouped.values()].sort((a, b) => {
    if (a.surface !== b.surface) return a.surface === "home" ? -1 : 1;
    if (a.surfaceDetail !== b.surfaceDetail)
      return a.surfaceDetail.localeCompare(b.surfaceDetail);
    return a.sectionHandle.localeCompare(b.sectionHandle);
  });

  const uniqueApps = new Set(sightings.map((s: any) => s.appSlug)).size;
  const homeSections = sections.filter((s: any) => s.surface === "home").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Featured Apps</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track which apps appear in featured/recommended sections on the
          Shopify App Store.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sections Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{sections.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unique Apps Featured
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{uniqueApps}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Homepage Sections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{homeSections}</span>
          </CardContent>
        </Card>
      </div>

      {sortedGroups.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          No featured app data yet. Run the featured apps scraper to collect
          data.
        </p>
      )}

      {sortedGroups.map((group) => {
        const isCategory = group.surface === "category";
        const shopifyUrl = isCategory
          ? `https://apps.shopify.com/categories/${group.surfaceDetail}`
          : "https://apps.shopify.com";

        return (
          <Card
            key={`${group.surface}:${group.surfaceDetail}:${group.sectionHandle}`}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {group.sectionTitle}
                {isCategory ? (
                  <Link href={`/categories/${group.surfaceDetail}`}>
                    <Badge
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-accent"
                    >
                      {group.surfaceDetail}
                    </Badge>
                  </Link>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Homepage
                  </Badge>
                )}
                <a
                  href={shopifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="View on Shopify App Store"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdHeatmap
                sightings={group.sightings}
                linkPrefix="/apps/"
                trackedSlugs={trackedSlugs}
                competitorSlugs={competitorSlugs}
                initialVisible={10}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
