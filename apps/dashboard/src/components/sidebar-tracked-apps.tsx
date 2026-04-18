"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AppIcon } from "@/components/app-icon";
import { PLATFORM_COLORS } from "@/lib/platform-display";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { PlatformId } from "@appranks/shared";

interface SidebarApp {
  platform: string;
  slug: string;
  name: string;
  iconUrl: string | null;
}

const MAX_VISIBLE_EXPANDED = 6;
const MAX_VISIBLE_COLLAPSED = 5;

export function SidebarTrackedApps({
  platform,
  collapsed,
  onNavigate,
}: {
  platform: PlatformId;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { fetchWithAuth, account } = useAuth();
  const [apps, setApps] = useState<SidebarApp[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchWithAuth("/api/account/tracked-apps/sidebar").then(async (res) => {
      if (!cancelled && res.ok) {
        const all: SidebarApp[] = await res.json();
        setApps(all.filter((a) => a.platform === platform));
      }
    });
    return () => { cancelled = true; };
  }, [fetchWithAuth, platform, account?.usage?.trackedApps]);

  if (apps.length === 0) return null;

  const accentColor = PLATFORM_COLORS[platform];
  const currentSlug = extractCurrentSlug(pathname, platform);

  if (collapsed) {
    const visible = apps.slice(0, MAX_VISIBLE_COLLAPSED);
    const overflow = apps.length - visible.length;

    return (
      <div className="flex flex-col items-center gap-1 py-1">
        {visible.map((app) => {
          const isActive = currentSlug === app.slug;
          return (
            <Tooltip key={app.slug}>
              <TooltipTrigger asChild>
                <Link
                  href={`/${platform}/apps/${app.slug}`}
                  onClick={onNavigate}
                  className="relative rounded-md transition-colors"
                  style={isActive ? { boxShadow: `0 0 0 2px ${accentColor}` } : undefined}
                >
                  <AppIcon
                    src={app.iconUrl}
                    alt={app.name}
                    size={28}
                    className="h-7 w-7 rounded-md"
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{app.name}</TooltipContent>
            </Tooltip>
          );
        })}
        {overflow > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/${platform}/apps`}
                onClick={onNavigate}
                className="h-7 w-7 rounded-md bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                +{overflow}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Show all apps</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  // Expanded mode
  const visible = apps.slice(0, MAX_VISIBLE_EXPANDED);
  const overflow = apps.length - visible.length;

  return (
    <div className="ml-6 mr-1 mt-0.5 mb-1">
      {visible.map((app) => {
        const isActive = currentSlug === app.slug;
        return (
          <Link
            key={app.slug}
            href={`/${platform}/apps/${app.slug}`}
            onClick={onNavigate}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
              isActive
                ? "font-medium text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            style={
              isActive
                ? { backgroundColor: accentColor, color: "var(--primary-foreground)" }
                : undefined
            }
          >
            <AppIcon
              src={app.iconUrl}
              alt={app.name}
              size={20}
              className="h-5 w-5 rounded shrink-0"
            />
            <span className="truncate">{app.name}</span>
          </Link>
        );
      })}
      {overflow > 0 && (
        <Link
          href={`/${platform}/apps`}
          onClick={onNavigate}
          className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Show all ({apps.length})
        </Link>
      )}
    </div>
  );
}

function extractCurrentSlug(pathname: string, platform: string): string | null {
  // Match /[platform]/apps/[slug] or /[platform]/apps/[slug]/...
  const match = pathname.match(new RegExp(`^/${platform}/apps/([^/]+)`));
  return match ? match[1] : null;
}
