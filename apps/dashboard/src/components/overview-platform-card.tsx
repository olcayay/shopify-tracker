"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Star, Search } from "lucide-react";
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
}

export function OverviewPlatformCard({ platformId, data, stats }: OverviewPlatformCardProps) {
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
            <span>{appCount} Apps</span>
            <span>&middot;</span>
            <span>{keywordCount} Keywords</span>
            <span>&middot;</span>
            <span>{competitorCount} Competitors</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {apps.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {apps.map((app) => (
              <AppMiniCard key={app.slug} app={app} platformId={platformId} />
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

function AppMiniCard({ app, platformId }: { app: AppSummary; platformId: PlatformId }) {
  const brand = PLATFORM_DISPLAY[platformId];

  return (
    <Link
      href={`/${platformId}/apps/${app.slug}`}
      className="flex flex-col gap-2 p-3 rounded-lg border bg-background hover:bg-muted/50 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center gap-2">
        {app.iconUrl ? (
          <img src={app.iconUrl} alt="" className="w-8 h-8 rounded-lg shrink-0" />
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: brand.color }}
          >
            {app.name.charAt(0)}
          </div>
        )}
        <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
          {app.name}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {app.rating != null && (
          <span className="flex items-center gap-0.5">
            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
            {app.rating.toFixed(1)}
            {app.reviewCount > 0 && (
              <span className="text-muted-foreground/70">({app.reviewCount})</span>
            )}
          </span>
        )}
        {app.keywordCount > 0 && (
          <span className="flex items-center gap-0.5">
            <Search className="h-3 w-3" />
            {app.keywordCount}
          </span>
        )}
      </div>
    </Link>
  );
}
