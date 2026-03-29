"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "@/lib/platform-display";
import { PLATFORMS, type PlatformId } from "@appranks/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PlatformCounts {
  apps: { platform: string; total: number; tracked: number; scraped: number; competitor: number; last_scraped_at: string | null }[];
  keywords: { platform: string; total: number; active: number; last_scraped_at: string | null }[];
  categories: { platform: string; total: number; total_apps: number; starred: number }[];
}

type AssetType = "apps" | "keywords" | "categories";

interface PlatformOverviewCardsProps {
  type: AssetType;
  activePlatform: string;
  onSelect: (platform: string) => void;
}

function getLabel(type: AssetType, data: PlatformCounts, platform: string): { primary: string; secondary?: string; extra?: string } {
  switch (type) {
    case "apps": {
      const row = data.apps.find((r) => r.platform === platform);
      if (!row) return { primary: "0" };
      return {
        primary: `${row.tracked} tracked`,
        secondary: `${row.total} total`,
        extra: row.competitor > 0 ? `${row.competitor} competitor` : `${row.scraped} scraped`,
      };
    }
    case "keywords": {
      const row = data.keywords.find((r) => r.platform === platform);
      if (!row) return { primary: "0" };
      return { primary: `${row.active} active`, secondary: `${row.total} total` };
    }
    case "categories": {
      const row = data.categories.find((r) => r.platform === platform);
      if (!row) return { primary: "0" };
      return {
        primary: `${row.total} categories`,
        secondary: row.total_apps > 0 ? `${row.total_apps.toLocaleString()} apps` : undefined,
        extra: row.starred > 0 ? `${row.starred} starred` : undefined,
      };
    }
  }
}

export function PlatformOverviewCards({ type, activePlatform, onSelect }: PlatformOverviewCardsProps) {
  const { fetchWithAuth } = useAuth();
  const [data, setData] = useState<PlatformCounts | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetchWithAuth("/api/system-admin/platform-counts");
      if (res.ok) {
        const json = await res.json();
        setData({
          apps: json.apps || [],
          keywords: json.keywords || [],
          categories: json.categories || [],
        });
      }
    })();
  }, []);

  if (!data) {
    return (
      <div className="grid grid-cols-3 gap-3 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-5 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const platforms = Object.keys(PLATFORMS) as PlatformId[];

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {platforms.map((pid) => {
        const isActive = activePlatform === pid;
        const { primary, secondary, extra } = getLabel(type, data, pid);
        const color = PLATFORM_COLORS[pid];

        return (
          <Card
            key={pid}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isActive ? "ring-2 ring-offset-1" : "hover:ring-1 hover:ring-muted-foreground/20"
            }`}
            style={isActive ? { borderColor: color, ringColor: color } as any : undefined}
            onClick={() => onSelect(isActive ? "" : pid)}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                </div>
              </div>
              <div className="text-sm font-medium mb-1">{PLATFORM_LABELS[pid]}</div>
              <div className="text-2xl font-semibold">{primary}</div>
              {secondary && (
                <div className="text-xs text-muted-foreground mt-1">{secondary}</div>
              )}
              {extra && (
                <div className="text-xs text-muted-foreground">{extra}</div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
