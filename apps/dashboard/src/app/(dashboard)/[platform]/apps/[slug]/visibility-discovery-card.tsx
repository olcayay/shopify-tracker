"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Star,
  Megaphone,
  Users,
} from "lucide-react";
import { useLayoutVersion, buildAppLink } from "@/hooks/use-layout-version";

export function VisibilityDiscoveryCard({
  platform,
  slug,
  totalVisibility,
  featuredSections,
  adKeywords,
  reverseSimilarSlugs,
  caps,
}: {
  platform: string;
  slug: string;
  totalVisibility: number;
  featuredSections: string[];
  adKeywords: string[];
  reverseSimilarSlugs: string[];
  caps: { hasFeaturedSections: boolean; hasAdTracking: boolean; hasSimilarApps: boolean };
}) {
  const version = useLayoutVersion();

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          Visibility &amp; Discovery
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalVisibility > 0 ? (
          <div className="space-y-3">
            {/* Featured */}
            {caps.hasFeaturedSections && (
              <Link
                href={buildAppLink(platform, slug, "featured", version)}
                className="block rounded-md p-2 -mx-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Star className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>
                    Seen in{" "}
                    <span className="font-semibold">{featuredSections.length}</span>{" "}
                    editorial section{featuredSections.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {featuredSections.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5 ml-6 truncate">
                    {featuredSections.slice(0, 3).join(", ")}
                    {featuredSections.length > 3 ? ` +${featuredSections.length - 3} more` : ""}
                  </p>
                )}
              </Link>
            )}

            {/* Search Ads */}
            {caps.hasAdTracking && (
              <Link
                href={buildAppLink(platform, slug, "ads", version)}
                className="block rounded-md p-2 -mx-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Megaphone className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>
                    Advertising on{" "}
                    <span className="font-semibold">{adKeywords.length}</span>{" "}
                    keyword{adKeywords.length !== 1 ? "s" : ""}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">Ad</Badge>
                </div>
                {adKeywords.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5 ml-6 truncate">
                    {adKeywords.slice(0, 3).join(", ")}
                    {adKeywords.length > 3 ? ` +${adKeywords.length - 3} more` : ""}
                  </p>
                )}
              </Link>
            )}

            {/* Similar Apps */}
            {caps.hasSimilarApps && (
              <Link
                href={buildAppLink(platform, slug, "similar", version)}
                className="block rounded-md p-2 -mx-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-purple-500 shrink-0" />
                  <span>
                    Listed as similar by{" "}
                    <span className="font-semibold">{reverseSimilarSlugs.length}</span>{" "}
                    app{reverseSimilarSlugs.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Eye className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              We&apos;re tracking your app&apos;s visibility across the Shopify App Store
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
