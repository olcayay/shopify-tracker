"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { HoverCard } from "radix-ui";
import { Plus, Target, Check, Loader2 } from "lucide-react";

interface AppQuickActionsProps {
  appSlug: string;
  appName: string;
  platform: string;
  isTracked: boolean;
  isCompetitor: boolean;
  onTrackChange?: (tracked: boolean) => void;
  onCompetitorChange?: (competitor: boolean) => void;
  children: React.ReactNode;
}

export function AppQuickActions({
  appSlug,
  appName,
  platform,
  isTracked,
  isCompetitor,
  onTrackChange,
  onCompetitorChange,
  children,
}: AppQuickActionsProps) {
  const { fetchWithAuth, refreshUser, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [trackLoading, setTrackLoading] = useState(false);
  const [competitorLoading, setCompetitorLoading] = useState(false);

  const canEdit = user?.role === "owner" || user?.role === "editor";

  async function handleTrack() {
    setTrackLoading(true);
    try {
      const res = await fetchWithAuth(`/api/account/tracked-apps?platform=${platform}`, {
        method: "POST",
        body: JSON.stringify({ slug: appSlug }),
      });
      if (res.ok) {
        onTrackChange?.(true);
        refreshUser();
      }
    } finally {
      setTrackLoading(false);
      setOpen(false);
    }
  }

  async function handleCompetitor() {
    setCompetitorLoading(true);
    try {
      // Fetch tracked apps to find which app to assign as competitor
      const appsRes = await fetchWithAuth("/api/account/tracked-apps");
      if (!appsRes.ok) return;
      const apps = await appsRes.json();
      const trackedApps = apps.filter((a: { appSlug: string }) => a.appSlug !== appSlug);
      if (trackedApps.length === 0) return;

      // Add as competitor to the first tracked app
      const targetApp = trackedApps[0];
      const res = await fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(targetApp.appSlug)}/competitors`,
        { method: "POST", body: JSON.stringify({ slug: appSlug }) }
      );
      if (res.ok) {
        onCompetitorChange?.(true);
        refreshUser();
      }
    } finally {
      setCompetitorLoading(false);
      setOpen(false);
    }
  }

  if (!canEdit) return <>{children}</>;

  return (
    <HoverCard.Root open={open} onOpenChange={setOpen} openDelay={800} closeDelay={200}>
      <HoverCard.Trigger asChild>
        <div className="inline-flex">{children}</div>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="right"
          align="center"
          sideOffset={8}
          className="z-50 rounded-lg border bg-popover p-2 shadow-lg animate-in fade-in-0 zoom-in-95 text-popover-foreground"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex flex-col gap-1 min-w-[160px]">
            {isTracked ? (
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Already tracking
              </div>
            ) : (
              <button
                onClick={handleTrack}
                disabled={trackLoading}
                className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-accent transition-colors text-left disabled:opacity-50"
              >
                {trackLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5 text-primary" />
                )}
                Start tracking
              </button>
            )}
            {isCompetitor ? (
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-orange-500" />
                Already a competitor
              </div>
            ) : (
              <button
                onClick={handleCompetitor}
                disabled={competitorLoading}
                className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-accent transition-colors text-left disabled:opacity-50"
              >
                {competitorLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Target className="h-3.5 w-3.5 text-orange-500" />
                )}
                Mark as competitor
              </button>
            )}
          </div>
          <HoverCard.Arrow className="fill-border" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
