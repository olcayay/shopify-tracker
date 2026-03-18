"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { PLATFORMS, type PlatformId } from "@appranks/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const PLATFORM_LABELS: Record<PlatformId, string> = {
  shopify: "Shopify",
  salesforce: "Salesforce",
  canva: "Canva",
  wix: "Wix",
  wordpress: "WordPress",
  google_workspace: "Google Workspace",
};

const PLATFORM_COLORS: Record<PlatformId, string> = {
  shopify: "#95BF47",
  salesforce: "#00A1E0",
  canva: "#00C4CC",
  wix: "#0C6EFC",
  wordpress: "#21759B",
  google_workspace: "#4285F4",
};

interface PlatformCounts {
  apps: { platform: string; total: number; tracked: number; scraped: number }[];
  keywords: { platform: string; total: number; active: number }[];
  categories: { platform: string; total: number }[];
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
      return { primary: `${row.tracked} tracked`, secondary: `${row.total} total`, extra: `${row.scraped} scraped` };
    }
    case "keywords": {
      const row = data.keywords.find((r) => r.platform === platform);
      if (!row) return { primary: "0" };
      return { primary: `${row.active} active`, secondary: `${row.total} total` };
    }
    case "categories": {
      const row = data.categories.find((r) => r.platform === platform);
      if (!row) return { primary: "0" };
      return { primary: `${row.total} categories` };
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
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium">{PLATFORM_LABELS[pid]}</span>
              </div>
              <div className="pl-[18px]">
                <span className="text-lg font-semibold">{primary}</span>
                {secondary && (
                  <span className="text-xs text-muted-foreground ml-2">{secondary}</span>
                )}
                {extra && (
                  <span className="text-xs text-muted-foreground ml-2">{extra}</span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
