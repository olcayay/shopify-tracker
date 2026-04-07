"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MomentumBadge } from "@/components/momentum-badge";
import {
  MessageSquare,
  ArrowRight,
  Star,
} from "lucide-react";
import { relativeDate } from "./utils";
import { useLayoutVersion, buildAppLink } from "@/hooks/use-layout-version";

export function ReviewPulseCard({
  platform,
  slug,
  reviewData,
  v7d,
  v30d,
  v90d,
  momentum,
  distribution,
  maxDistCount,
  maxRatingStars,
}: {
  platform: string;
  slug: string;
  reviewData: any;
  v7d: number | null;
  v30d: number | null;
  v90d: number | null;
  momentum: string | null;
  distribution: { rating: number; count: number }[];
  maxDistCount: number;
  maxRatingStars: number;
}) {
  const version = useLayoutVersion();

  return (
    <Link href={buildAppLink(platform, slug, "reviews", version)} className="group">
      <Card className="h-full transition-colors group-hover:border-primary/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Review Pulse
          </CardTitle>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </CardHeader>
        <CardContent>
          {reviewData?.total > 0 || v7d || v30d || v90d ? (
            <div className="space-y-4">
              {/* Velocity strip + momentum */}
              <div className="flex gap-3">
                {[
                  { label: "7d", value: v7d },
                  { label: "30d", value: v30d },
                  { label: "90d", value: v90d },
                ].map(({ label, value }) => (
                  <div key={label} className="flex-1 rounded-md bg-muted/50 px-3 py-2 text-center">
                    <div className={`text-lg font-semibold ${value && value > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                      {value != null ? `+${value}` : "\u2014"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{label}</div>
                  </div>
                ))}
                <div className="flex items-center">
                  <MomentumBadge momentum={momentum} />
                </div>
              </div>

              {/* Mini rating distribution */}
              {distribution.length > 0 && (
                <div className="space-y-1">
                  {Array.from({ length: maxRatingStars }, (_, i) => maxRatingStars - i).map((star) => {
                    const d = distribution.find((x) => x.rating === star);
                    const count = d?.count || 0;
                    const pct = (count / maxDistCount) * 100;
                    return (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-3 text-right text-muted-foreground">{star}</span>
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Latest reviews */}
              {reviewData.reviews.length > 0 && (
                <div className="space-y-2 pt-1">
                  {reviewData.reviews.slice(0, 3).map((r: any, i: number) => (
                    <div key={i} className="text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-yellow-500 text-xs">
                          {"\u2605".repeat(r.rating)}{"\u2606".repeat(Math.max(0, maxRatingStars - r.rating))}
                        </span>
                        <span className="text-muted-foreground text-xs font-medium">{r.reviewerName}</span>
                        <span className="text-muted-foreground/60 text-xs">{"\u00B7"}</span>
                        <span className="text-muted-foreground/60 text-xs">{relativeDate(r.reviewDate)}</span>
                      </div>
                      <p className="text-muted-foreground line-clamp-1 text-xs mt-0.5">{r.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <p className="text-xs text-muted-foreground pt-1">
                View all {reviewData.total} reviews {"\u2192"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                Reviews appear here automatically as they&apos;re collected
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
