"use client";

import { useEffect, useState, useRef, useCallback, forwardRef } from "react";
import { createPortal } from "react-dom";
import Link from "@/components/ui/link";
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

const MAX_VISIBLE = 5;

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
  const [showAll, setShowAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Refetch when account loads or tracked app count changes
  const isReady = !!account;
  const trackedAppsCount = account?.usage?.trackedApps ?? 0;
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    fetchWithAuth("/api/account/tracked-apps/sidebar")
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const all: SidebarApp[] = await res.json();
          setApps(all.filter((a) => a.platform === platform));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fetchWithAuth, platform, isReady, trackedAppsCount]);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  const openPanel = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPanelPos({ top: rect.top, left: rect.right + 8 });
    }
    setShowAll(true);
  }, []);

  // Close panel on click outside
  useEffect(() => {
    if (!showAll) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setShowAll(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAll]);

  // Close panel on navigation
  useEffect(() => {
    setShowAll(false);
  }, [pathname]);

  if (apps.length === 0) return null;

  const accentColor = PLATFORM_COLORS[platform];
  const currentSlug = extractCurrentSlug(pathname, platform);
  const visible = apps.slice(0, MAX_VISIBLE);
  const overflow = apps.length - visible.length;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 py-0.5 relative">
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
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  ref={triggerRef}
                  onClick={() => showAll ? setShowAll(false) : openPanel()}
                  className="h-7 w-7 rounded-md bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  +{overflow}
                </button>
              </TooltipTrigger>
              {!showAll && <TooltipContent side="right">Show all apps</TooltipContent>}
            </Tooltip>
            {showAll && panelPos && createPortal(
              <OverflowPanel
                ref={panelRef}
                apps={apps}
                platform={platform}
                currentSlug={currentSlug}
                accentColor={accentColor}
                onNavigate={() => { setShowAll(false); onNavigate?.(); }}
                style={{ position: "fixed", top: panelPos.top, left: panelPos.left }}
              />,
              document.body
            )}
          </>
        )}
      </div>
    );
  }

  // Expanded mode
  return (
    <div className="mt-0.5 mb-1 relative">
      {visible.map((app) => {
        const isActive = currentSlug === app.slug;
        return (
          <Link
            key={app.slug}
            href={`/${platform}/apps/${app.slug}`}
           
            onClick={onNavigate}
            className={`flex items-center gap-2 rounded-md mx-2 px-2.5 py-1.5 text-sm transition-colors ${
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
        <>
          <button
            ref={triggerRef}
            onClick={() => showAll ? setShowAll(false) : openPanel()}
            className="flex items-center gap-2 mx-2 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted w-full"
          >
            <span className="h-5 w-5 rounded bg-muted/80 flex items-center justify-center text-[10px] font-medium shrink-0">
              +{overflow}
            </span>
            <span>{overflow} more app{overflow > 1 ? "s" : ""}</span>
          </button>
          {showAll && panelPos && createPortal(
            <OverflowPanel
              ref={panelRef}
              apps={apps}
              platform={platform}
              currentSlug={currentSlug}
              accentColor={accentColor}
              onNavigate={() => { setShowAll(false); onNavigate?.(); }}
              style={{ position: "fixed", top: panelPos.top, left: panelPos.left }}
            />,
            document.body
          )}
        </>
      )}
    </div>
  );
}

const OverflowPanel = forwardRef<HTMLDivElement, {
  apps: SidebarApp[];
  platform: string;
  currentSlug: string | null;
  accentColor: string | undefined;
  onNavigate?: () => void;
  style?: React.CSSProperties;
}>(function OverflowPanel({
  apps,
  platform,
  currentSlug,
  accentColor,
  onNavigate,
  style,
}, ref) {
  return (
    <div
      ref={ref}
      className="z-50 w-56 bg-popover border rounded-lg shadow-lg py-1.5 max-h-72 overflow-y-auto"
      style={style}
    >
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b mb-1">
        All tracked apps ({apps.length})
      </div>
      {apps.map((app) => {
        const isActive = currentSlug === app.slug;
        return (
          <Link
            key={app.slug}
            href={`/${platform}/apps/${app.slug}`}
           
            onClick={onNavigate}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
              isActive
                ? "font-medium text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
    </div>
  );
});

function extractCurrentSlug(pathname: string, platform: string): string | null {
  const match = pathname.match(new RegExp(`^/${platform}/apps/([^/]+)`));
  return match ? match[1] : null;
}
