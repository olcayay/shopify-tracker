"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Star, Search, Users } from "lucide-react";
import { DailyHighlights } from "@/components/overview-daily-highlights";
import { PLATFORMS, type PlatformId } from "@appranks/shared";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";

interface AppSummary {
  slug: string;
  name: string;
  iconUrl: string | null;
  rating: number | null;
  reviewCount: number;
  keywordCount: number;
  competitorCount: number;
  developerName: string | null;
}

interface PlatformHighlights {
  apps: AppSummary[];
  highlights: {
    keywordMovers: any[];
    categoryMovers: any[];
    reviewPulse: any[];
    recentChanges: any[];
    featuredSightings: any[];
    competitorAlerts: any[];
    adActivity: any[];
  };
}

interface OverviewPlatformCardProps {
  platformId: PlatformId;
  data: PlatformHighlights | null;
  stats?: { apps: number; keywords: number; competitors: number };
  highlightsLoading?: boolean;
}

export function OverviewPlatformCard({ platformId, data, stats, highlightsLoading }: OverviewPlatformCardProps) {
  const config = PLATFORMS[platformId];
  const brand = PLATFORM_DISPLAY[platformId];
  const apps = data?.apps ?? [];
  const appCount = stats?.apps ?? apps.length;
  const keywordCount = stats?.keywords ?? 0;
  const competitorCount = stats?.competitors ?? 0;

  return (
    <Card
      className="rounded-xl border-l-4 overflow-hidden"
      style={{ borderLeftColor: brand.color }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Link href={`/${platformId}`} className="flex items-center gap-2 group">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: brand.color }}
            />
            <CardTitle className="text-lg group-hover:underline">{config.name}</CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Link href={`/${platformId}/apps`} className="hover:text-foreground hover:underline transition-colors">{appCount} Apps</Link>
            <span>&middot;</span>
            <Link href={`/${platformId}/keywords`} className="hover:text-foreground hover:underline transition-colors">{keywordCount} Keywords</Link>
            <span>&middot;</span>
            <Link href={`/${platformId}/competitors`} className="hover:text-foreground hover:underline transition-colors">{competitorCount} Competitors</Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {apps.length > 0 ? (
          <div className="flex flex-col divide-y">
            {apps.slice(0, MAX_VISIBLE_APPS).map((app) => (
              <AppRow key={app.slug} app={app} platformId={platformId} />
            ))}
            {apps.length > MAX_VISIBLE_APPS && (
              <div className="pt-2 text-center">
                <Link
                  href={`/${platformId}/apps`}
                  className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors"
                >
                  View all {apps.length} apps
                </Link>
              </div>
            )}
          </div>
        ) : highlightsLoading && (stats?.apps ?? 0) > 0 ? (
          <div className="flex flex-col divide-y">
            {Array.from({ length: Math.min(stats?.apps ?? 2, 4) }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="w-6 h-6 rounded-md shrink-0" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-12 ml-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No tracked apps on this platform.{" "}
            <Link href={`/${platformId}`} className="text-primary hover:underline">
              Start tracking
            </Link>
          </div>
        )}

        {/* Daily highlights section */}
        {data?.highlights && apps.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <DailyHighlights highlights={data.highlights} platformId={platformId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const MAX_VISIBLE_APPS = 5;

function AppRow({ app, platformId }: { app: AppSummary; platformId: PlatformId }) {
  const brand = PLATFORM_DISPLAY[platformId];

  return (
    <Link
      href={`/${platformId}/apps/${app.slug}`}
      className="flex items-center gap-3 py-2 hover:bg-muted/50 rounded-sm px-1 -mx-1 transition-colors group"
    >
      {app.iconUrl ? (
        <img src={app.iconUrl} alt="" aria-hidden="true" className="w-6 h-6 rounded-md shrink-0" />
      ) : (
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0"
          style={{ backgroundColor: brand.color }}
        >
          {app.name.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <span className="font-medium text-sm truncate group-hover:text-primary transition-colors block">
          {app.name}
        </span>
        {app.developerName && (
          <span className="text-[10px] text-muted-foreground truncate block">
            {app.developerName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 ml-auto shrink-0 text-xs text-muted-foreground">
        <span className="w-28 flex items-center gap-1 justify-start tabular-nums whitespace-nowrap">
          {app.rating != null ? (
            <>
              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
              {app.rating.toFixed(1)}
              {app.reviewCount > 0 && (
                <span className="text-muted-foreground/70">({app.reviewCount.toLocaleString()})</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground/40">{"\u2014"}</span>
          )}
        </span>
        <span className="w-12 flex items-center gap-0.5 justify-end">
          {app.keywordCount > 0 ? (
            <span className="flex items-center gap-0.5 bg-muted rounded-full px-1.5 py-0.5">
              <Search className="h-3 w-3" />
              {app.keywordCount}
            </span>
          ) : (
            <span className="text-muted-foreground/40">{"\u2014"}</span>
          )}
        </span>
        <span className="w-12 flex items-center gap-0.5 justify-end">
          {app.competitorCount > 0 ? (
            <span className="flex items-center gap-0.5 bg-muted rounded-full px-1.5 py-0.5">
              <Users className="h-3 w-3" />
              {app.competitorCount}
            </span>
          ) : (
            <span className="text-muted-foreground/40">{"\u2014"}</span>
          )}
        </span>
      </div>
    </Link>
  );
}
