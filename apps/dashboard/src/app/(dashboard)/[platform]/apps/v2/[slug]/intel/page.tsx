import Link from "next/link";
import {
  getApp,
  getAppCompetitors,
  getAppSimilarApps,
  getAppReviews,
  getAppChanges,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";
import { Users, GitCompare, Star, History, ArrowRight, Lock } from "lucide-react";

export default async function IntelOverviewPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { platform, slug } = await params;
  const caps = isPlatformId(platform) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const base = `/${platform}/apps/v2/${slug}/intel`;

  let app: any;
  let competitors: any[] = [];
  let similarData: any = {};
  let reviewData: any = {};
  let changes: any[] = [];

  try {
    app = await getApp(slug, platform as PlatformId);
    [competitors, similarData, reviewData, changes] = await Promise.all([
      app.isTrackedByAccount
        ? getAppCompetitors(slug, platform as PlatformId).catch(() => [])
        : Promise.resolve([]),
      caps.hasSimilarApps
        ? getAppSimilarApps(slug, 30, platform as PlatformId).catch(() => ({}))
        : Promise.resolve({}),
      caps.hasReviews
        ? getAppReviews(slug, 3, 0, "newest", platform as PlatformId).catch(() => ({}))
        : Promise.resolve({}),
      getAppChanges(slug, 10, platform as PlatformId).catch(() => []),
    ]);
  } catch {
    return <p className="text-muted-foreground">Failed to load market intel.</p>;
  }

  const directCount = (similarData?.direct || []).length;
  const reverseCount = (similarData?.reverse || []).length;
  const totalSimilar = new Set([
    ...(similarData?.direct || []).map((s: any) => s.slug),
    ...(similarData?.reverse || []).map((s: any) => s.slug),
  ]).size;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Competitors */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" /> Competitors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {app.isTrackedByAccount ? (
              <>
                <p className="text-2xl font-bold">{competitors.length}</p>
                <p className="text-xs text-muted-foreground">competitors tracked</p>
                <Link href={`${base}/competitors`} className="flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                  View competitors <ArrowRight className="h-3 w-3" />
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" /> Track to unlock
              </div>
            )}
          </CardContent>
        </Card>

        {/* Similar Apps */}
        {caps.hasSimilarApps && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <GitCompare className="h-4 w-4" /> Similar Apps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalSimilar}</p>
              <p className="text-xs text-muted-foreground">unique similar apps</p>
              <Link href={`${base}/similar`} className="flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                View similar apps <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Reviews */}
        {caps.hasReviews && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Star className="h-4 w-4" /> Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{reviewData?.total || 0}</p>
              <p className="text-xs text-muted-foreground">total reviews</p>
              <Link href={`${base}/reviews`} className="flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                View reviews <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Changes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4" /> Recent Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{changes.length}</p>
            <p className="text-xs text-muted-foreground">changes detected</p>
            <Link href={`${base}/changes`} className="flex items-center gap-1 text-xs text-primary hover:underline mt-2">
              View change log <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
