import { getApp, getAppReviews, getAppHistory } from "@/lib/api";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RatingReviewChart } from "@/components/rating-review-chart";
import { ReviewList } from "../review-list";

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { platform, slug } = await params;
  const maxStars = isPlatformId(platform) ? PLATFORMS[platform as PlatformId].maxRatingStars : 5;

  let reviewData: any;
  let history: any = { snapshots: [] };
  try {
    [reviewData, history] = await Promise.all([
      getAppReviews(slug, 10, 0, "newest", platform as PlatformId),
      getAppHistory(slug, 90, platform as PlatformId).catch(() => ({ snapshots: [] })),
    ]);
  } catch {
    reviewData = { reviews: [], total: 0, distribution: [] };
  }

  return (
    <div className="space-y-4">
      {history?.snapshots?.length > 1 && (
        <RatingReviewChart snapshots={history.snapshots} />
      )}

      {reviewData?.distribution?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: maxStars }, (_, i) => maxStars - i).map((star) => {
                const item = reviewData.distribution.find(
                  (d: any) => d.rating === star
                );
                const count = item?.count || 0;
                const pct =
                  reviewData.total > 0
                    ? (count / reviewData.total) * 100
                    : 0;
                return (
                  <div key={star} className="flex items-center gap-3">
                    <span className="w-8 text-sm text-right">{star}★</span>
                    <div className="flex-1 bg-muted rounded-full h-3">
                      <div
                        className="bg-primary rounded-full h-3"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-sm text-muted-foreground text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <ReviewList
        appSlug={slug}
        initialReviews={reviewData?.reviews ?? []}
        total={reviewData?.total ?? 0}
      />
    </div>
  );
}
