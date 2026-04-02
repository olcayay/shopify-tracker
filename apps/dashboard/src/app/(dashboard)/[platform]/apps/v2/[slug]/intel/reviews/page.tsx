import { getAppReviews, getAppHistory, getAppReviewMetrics } from "@/lib/api";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dynamic from "next/dynamic";
const RatingReviewChart = dynamic(() => import("@/components/rating-review-chart").then(m => m.RatingReviewChart), { ssr: false });
import { ReviewList } from "../../../../[slug]/review-list";
import { Star, TrendingUp, MessageSquare } from "lucide-react";

export default async function V2ReviewsPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { platform, slug } = await params;
  const caps = isPlatformId(platform) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;

  if (!caps.hasReviews) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Reviews are not available for this marketplace.
      </p>
    );
  }

  let reviewData: any;
  let historyData: any;
  let metrics: any;

  try {
    [reviewData, historyData, metrics] = await Promise.all([
      getAppReviews(slug, 10, 0, "newest", platform as PlatformId).catch(() => ({ reviews: [], total: 0, distribution: [] })),
      getAppHistory(slug, 90, platform as PlatformId).catch(() => ({ snapshots: [] })),
      getAppReviewMetrics(slug, platform as PlatformId).catch(() => null),
    ]);
  } catch {
    return <p className="text-muted-foreground">Failed to load reviews.</p>;
  }

  const distribution = reviewData?.distribution || [];
  const total = reviewData?.total || 0;
  const snapshots = historyData?.snapshots || [];

  return (
    <div className="space-y-4">
      {/* Review Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Star className="h-5 w-5 text-yellow-500 flex-shrink-0" />
            <div>
              <p className="text-lg font-bold">
                {reviewData?.reviews?.[0]
                  ? Number(snapshots[snapshots.length - 1]?.averageRating ?? reviewData.reviews[0]?.rating ?? 0).toFixed(1)
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Current Rating</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-lg font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Total Reviews</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-lg font-bold">
                {metrics?.v30d != null ? `+${metrics.v30d}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Reviews / 30d</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution */}
      {distribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {[...distribution].reverse().map((d: any) => {
                const pct = total > 0 ? (d.count / total) * 100 : 0;
                return (
                  <div key={d.rating} className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-right tabular-nums">{d.rating}★</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 text-right tabular-nums text-xs text-muted-foreground">{d.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rating Trend Chart */}
      {snapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Rating & Review Trend (90 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <RatingReviewChart snapshots={snapshots} />
          </CardContent>
        </Card>
      )}

      {/* Review List */}
      {total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewList appSlug={slug} initialReviews={reviewData.reviews} total={total} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
