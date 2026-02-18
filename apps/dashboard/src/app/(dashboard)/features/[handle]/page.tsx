import Link from "next/link";
import { getFeature, getAccountCompetitors, getAccountTrackedApps, getAppsLastChanges } from "@/lib/api";
import { formatDateOnly } from "@/lib/format-date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrackFeatureButton } from "./track-button";
import { StarAppButton } from "@/components/star-app-button";

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  let feature: any;
  let competitors: any[] = [];
  let trackedApps: any[] = [];
  try {
    [feature, competitors, trackedApps] = await Promise.all([
      getFeature(handle),
      getAccountCompetitors().catch(() => []),
      getAccountTrackedApps().catch(() => []),
    ]);
  } catch {
    return <p className="text-muted-foreground">Feature not found.</p>;
  }

  const competitorSlugs = new Set(competitors.map((c: any) => c.appSlug));
  const trackedSlugs = new Set(trackedApps.map((a: any) => a.appSlug));

  const featureAppSlugs = (feature.apps || []).map((a: any) => a.slug).filter(Boolean);
  const lastChanges = await getAppsLastChanges(featureAppSlugs).catch(() => ({} as Record<string, string>));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {(feature.categoryTitle || feature.subcategoryTitle) && (
            <p className="text-sm text-muted-foreground mb-1">
              {feature.categoryTitle && (
                <Link
                  href={`/features/category?category=${encodeURIComponent(feature.categoryTitle)}`}
                  className="hover:underline hover:text-foreground transition-colors"
                >
                  {feature.categoryTitle}
                </Link>
              )}
              {feature.categoryTitle && feature.subcategoryTitle && " > "}
              {feature.subcategoryTitle && (
                <Link
                  href={`/features/category?${new URLSearchParams({ ...(feature.categoryTitle ? { category: feature.categoryTitle } : {}), subcategory: feature.subcategoryTitle }).toString()}`}
                  className="hover:underline hover:text-foreground transition-colors"
                >
                  {feature.subcategoryTitle}
                </Link>
              )}
            </p>
          )}
          <h1 className="text-2xl font-bold">{feature.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <TrackFeatureButton
            featureHandle={feature.handle}
            featureTitle={feature.title}
            initialTracked={feature.isTrackedByAccount}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Apps with this Feature ({feature.apps?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {feature.apps?.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Reviews</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead>Last Change</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {feature.apps.map((app: any) => {
                  const isTracked = trackedSlugs.has(app.slug);
                  const isCompetitor = competitorSlugs.has(app.slug);
                  return (
                  <TableRow key={app.slug} className={isTracked ? "border-l-2 border-l-emerald-500 bg-emerald-500/10" : isCompetitor ? "border-l-2 border-l-amber-500 bg-amber-500/10" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {app.icon_url && (
                          <img src={app.icon_url} alt="" className="h-6 w-6 rounded shrink-0" />
                        )}
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/apps/${app.slug}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {app.name}
                          </Link>
                          {app.is_built_for_shopify && <span title="Built for Shopify">💎</span>}
                          {isTracked && <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50">Tracked</Badge>}
                          {isCompetitor && <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50">Competitor</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {app.average_rating != null
                        ? Number(app.average_rating).toFixed(1)
                        : "\u2014"}
                    </TableCell>
                    <TableCell>
                      {app.rating_count != null
                        ? Number(app.rating_count).toLocaleString()
                        : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.pricing ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lastChanges[app.slug] ? formatDateOnly(lastChanges[app.slug]) : "\u2014"}
                    </TableCell>
                    <TableCell>
                      <StarAppButton
                        appSlug={app.slug}
                        initialStarred={competitorSlugs.has(app.slug)}
                        size="sm"
                      />
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No apps found with this feature.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
