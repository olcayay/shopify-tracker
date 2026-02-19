import Link from "next/link";
import { formatDateOnly } from "@/lib/format-date";
import { getApp, getAppReviews, getAppRankings, getAppChanges } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingUp, Star, MessageSquare, FileText, History, Users, Search } from "lucide-react";

export default async function AppOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let app: any;
  let reviewData: any;
  let rankings: any;
  let changes: any[] = [];
  try {
    [app, reviewData, rankings, changes] = await Promise.all([
      getApp(slug),
      getAppReviews(slug, 3).catch(() => ({ reviews: [], total: 0 })),
      getAppRankings(slug).catch(() => ({})),
      getAppChanges(slug, 5).catch(() => []),
    ]);
  } catch {
    return <p className="text-muted-foreground">App not found.</p>;
  }

  // Compute summary stats
  const catRankings = rankings?.categoryRankings || [];
  const kwRankings = rankings?.keywordRankings || [];
  const kwAds = rankings?.keywordAds || [];

  // Latest position per category
  const latestCatPositions = new Map<string, { label: string; position: number }>();
  for (const r of catRankings) {
    const key = r.categorySlug;
    if (!latestCatPositions.has(key)) {
      latestCatPositions.set(key, { label: r.categoryTitle || r.categorySlug, position: r.position });
    }
  }

  // Latest position per keyword
  const latestKwPositions = new Map<string, { label: string; position: number }>();
  for (const r of kwRankings) {
    const key = r.keywordSlug;
    if (!latestKwPositions.has(key)) {
      latestKwPositions.set(key, { label: r.keyword, position: r.position });
    }
  }

  // Unique keyword ad count
  const uniqueAdKeywords = new Set(kwAds.map((a: any) => a.keyword)).size;

  const fieldLabels: Record<string, string> = {
    name: "App Name",
    appIntroduction: "App Introduction",
    appDetails: "App Details",
    features: "Features",
    seoTitle: "SEO Title",
    seoMetaDescription: "SEO Meta Description",
    appCardSubtitle: "App Card Subtitle",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Rankings Summary */}
      <Link href={`/apps/${slug}/rankings`} className="group">
        <Card className="h-full transition-colors group-hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Rankings
            </CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardHeader>
          <CardContent>
            {latestCatPositions.size > 0 || latestKwPositions.size > 0 ? (
              <div className="space-y-2">
                {[...latestCatPositions.values()].slice(0, 3).map((r) => (
                  <div key={r.label} className="flex items-center justify-between text-sm">
                    <span className="truncate text-muted-foreground">{r.label}</span>
                    <Badge variant="secondary" className="ml-2 shrink-0">#{r.position}</Badge>
                  </div>
                ))}
                {[...latestKwPositions.values()].slice(0, 3).map((r) => (
                  <div key={r.label} className="flex items-center justify-between text-sm">
                    <span className="truncate text-muted-foreground">{r.label}</span>
                    <Badge variant="outline" className="ml-2 shrink-0">#{r.position}</Badge>
                  </div>
                ))}
                {uniqueAdKeywords > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ads on {uniqueAdKeywords} keyword{uniqueAdKeywords > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No ranking data yet</p>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Reviews Summary */}
      <Link href={`/apps/${slug}/reviews`} className="group">
        <Card className="h-full transition-colors group-hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Reviews ({reviewData?.total ?? 0})
            </CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardHeader>
          <CardContent>
            {reviewData?.reviews?.length > 0 ? (
              <div className="space-y-2">
                {reviewData.reviews.slice(0, 3).map((r: any, i: number) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="text-yellow-500">{"★".repeat(r.rating)}</span>
                      <span className="text-muted-foreground text-xs">{r.reviewerName}</span>
                    </div>
                    <p className="text-muted-foreground line-clamp-1 text-xs mt-0.5">
                      {r.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No reviews yet</p>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Competitors Summary (tracked only) */}
      {app.isTrackedByAccount && (
        <Link href={`/apps/${slug}/competitors`} className="group">
          <Card className="h-full transition-colors group-hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Competitors
              </CardTitle>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage competitor apps and track their performance
              </p>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Keywords Summary (tracked only) */}
      {app.isTrackedByAccount && (
        <Link href={`/apps/${slug}/keywords`} className="group">
          <Card className="h-full transition-colors group-hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                Keywords
              </CardTitle>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage tracked keywords and monitor search rankings
              </p>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Details Summary */}
      <Link href={`/apps/${slug}/details`} className="group">
        <Card className="h-full transition-colors group-hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Details
            </CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardHeader>
          <CardContent>
            {app.latestSnapshot?.appIntroduction ? (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {app.latestSnapshot.appIntroduction}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No details available</p>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Changes Summary */}
      <Link href={`/apps/${slug}/changes`} className="group">
        <Card className="h-full transition-colors group-hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Changes
            </CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardHeader>
          <CardContent>
            {changes.length > 0 ? (
              <div className="space-y-1.5">
                {changes.slice(0, 3).map((c: any) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {fieldLabels[c.field] || c.field}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateOnly(c.detectedAt)}
                    </span>
                  </div>
                ))}
                {changes.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{changes.length - 3} more
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No changes detected yet</p>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
