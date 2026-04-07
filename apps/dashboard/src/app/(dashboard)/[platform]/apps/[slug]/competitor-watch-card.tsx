"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  Users,
  ArrowRight,
  Plus,
  Star,
} from "lucide-react";
import { ordinal } from "./utils";
import { useLayoutVersion, buildAppLink } from "@/hooks/use-layout-version";

export function CompetitorWatchCard({
  platform,
  slug,
  competitors,
  allWithSelf,
  selfRatingPos,
  selfReviewsPos,
  selfPricePos,
  caps,
}: {
  platform: string;
  slug: string;
  competitors: any[];
  allWithSelf: { slug: string; name: string; iconUrl: string | null; rating: number; reviews: number; minPaidPrice: number | null; isSelf: boolean }[];
  selfRatingPos: number;
  selfReviewsPos: number;
  selfPricePos: number;
  caps: { hasReviews: boolean; hasPricing: boolean };
}) {
  const version = useLayoutVersion();

  return (
    <Link href={buildAppLink(platform, slug, "competitors", version)} className="group">
      <Card className="h-full transition-colors group-hover:border-primary/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Competitor Watch
          </CardTitle>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </CardHeader>
        <CardContent>
          {competitors.length > 0 ? (
            <div className="space-y-3">
              {/* Header stat */}
              <p className="text-sm text-muted-foreground">
                Tracking{" "}
                <span className="font-semibold text-foreground">{competitors.length}</span>{" "}
                competitor{competitors.length !== 1 ? "s" : ""}
              </p>

              {/* Your position — multi-metric */}
              {(caps.hasReviews || (caps.hasPricing && selfPricePos > 0)) && (() => {
                const metricCount = (caps.hasReviews ? 2 : 0) + (caps.hasPricing && selfPricePos > 0 ? 1 : 0);
                return (
                  <div className={`grid gap-2 ${metricCount >= 3 ? "grid-cols-3" : metricCount === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {caps.hasReviews && (
                      <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                        <div className="text-sm font-semibold">{ordinal(selfRatingPos)}</div>
                        <div className="text-[10px] text-muted-foreground">by rating</div>
                      </div>
                    )}
                    {caps.hasReviews && (
                      <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                        <div className="text-sm font-semibold">{ordinal(selfReviewsPos)}</div>
                        <div className="text-[10px] text-muted-foreground">by reviews</div>
                      </div>
                    )}
                    {caps.hasPricing && selfPricePos > 0 && (
                      <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                        <div className="text-sm font-semibold">{ordinal(selfPricePos)}</div>
                        <div className="text-[10px] text-muted-foreground">cheapest</div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Competitor list */}
              <div className="space-y-1.5">
                {allWithSelf.filter((c) => !c.isSelf).slice(0, 5).map((c) => (
                  <div key={c.slug} className="flex items-center gap-2 text-sm">
                    {c.iconUrl ? (
                      <img src={c.iconUrl} alt="" aria-hidden="true" className="h-5 w-5 rounded shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded bg-muted shrink-0" />
                    )}
                    <span className="truncate flex-1">{c.name}</span>
                    {caps.hasReviews && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 inline align-text-bottom" />{" "}
                        {c.rating.toFixed(1)} {"\u00B7"} {c.reviews}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <p className="text-xs text-muted-foreground pt-1">View all competitors {"\u2192"}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Users className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                Add competitors to see how you stack up
              </p>
              <span className={buttonVariants({ size: "sm", variant: "outline" })}>
                <Plus className="h-3.5 w-3.5" />
                Add Your First Competitors
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
