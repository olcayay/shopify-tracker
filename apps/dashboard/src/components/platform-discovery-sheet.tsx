"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import { PLATFORMS, PLATFORM_IDS, type PlatformId } from "@appranks/shared";
import { Check, Search, MessageSquarePlus, ArrowRight } from "lucide-react";
import { PlatformRequestDialog } from "@/components/platform-request-dialog";

const CAPABILITY_LABELS: { key: string; label: string }[] = [
  { key: "hasReviews", label: "Reviews" },
  { key: "hasKeywordSearch", label: "Keywords" },
  { key: "hasFeaturedSections", label: "Featured" },
  { key: "hasAdTracking", label: "Ads" },
  { key: "hasSimilarApps", label: "Similar" },
  { key: "hasFeatureTaxonomy", label: "Features" },
  { key: "hasPricing", label: "Pricing" },
  { key: "hasLaunchedDate", label: "Launch Date" },
];

interface PlatformStats {
  apps: number;
  keywords: number;
  competitors: number;
}

function PlatformCard({
  pid,
  stats,
  onNavigate,
}: {
  pid: PlatformId;
  stats?: PlatformStats;
  onNavigate: () => void;
}) {
  const d = PLATFORM_DISPLAY[pid];
  const config = PLATFORMS[pid];
  const capabilities = CAPABILITY_LABELS.filter(
    (c) => (config as Record<string, unknown>)[c.key] === true
  );

  return (
    <div
      className="border rounded-lg p-3 transition-colors border-l-4"
      style={{ borderLeftColor: d.color }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: d.color }}
        />
        <span className="font-medium text-sm">{d.label}</span>
        <span className="text-xs text-muted-foreground">
          {config.name}
        </span>
      </div>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1 mb-2">
        {capabilities.map((cap) => (
          <span
            key={cap.key}
            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
          >
            {cap.label}
          </span>
        ))}
      </div>

      {/* Stats + Dashboard link */}
      <div className="flex items-center justify-between">
        {stats ? (
          <span className="text-xs text-muted-foreground">
            {stats.apps} apps · {stats.keywords} keywords · {stats.competitors} competitors
          </span>
        ) : (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <Check className="h-3 w-3" /> Active
          </span>
        )}
        <Link href={`/${pid}`} onClick={onNavigate}>
          <Button variant="ghost" size="sm" className="text-xs h-7 shrink-0">
            Dashboard <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function AvailablePlatformRow({
  pid,
  onNavigate,
}: {
  pid: PlatformId;
  onNavigate: () => void;
}) {
  const d = PLATFORM_DISPLAY[pid];

  return (
    <Link
      href={`/${pid}`}
      onClick={onNavigate}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: d.color }}
      />
      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
        {d.label}
      </span>
      <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
    </Link>
  );
}

export function PlatformDiscoverySheet({
  open,
  onOpenChange,
  onTrackedCountChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTrackedCountChange?: (count: number) => void;
}) {
  const { user, account, fetchWithAuth } = useAuth();
  const enabledPlatforms = (account?.enabledPlatforms ?? []) as PlatformId[];
  const isSystemAdmin = user?.isSystemAdmin;
  const [search, setSearch] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [platformStats, setPlatformStats] = useState<Record<string, PlatformStats>>({});
  const [statsLoaded, setStatsLoaded] = useState(false);

  // Fetch lightweight platform stats (single fast endpoint)
  useEffect(() => {
    if (statsLoaded || !account) return;

    async function loadStats() {
      const res = await fetchWithAuth("/api/account/platform-stats");
      if (!res.ok) return;
      const data = await res.json();
      const stats: Record<string, PlatformStats> = {};
      for (const [p, s] of Object.entries(data) as [string, any][]) {
        stats[p] = { apps: s.apps ?? 0, keywords: s.keywords ?? 0, competitors: s.competitors ?? 0 };
      }
      setPlatformStats(stats);
      setStatsLoaded(true);
      const count = enabledPlatforms.filter((pid) => {
        const s = stats[pid];
        return s && (s.apps > 0 || s.keywords > 0 || s.competitors > 0);
      }).length;
      onTrackedCountChange?.(count);
    }

    loadStats();
  }, [statsLoaded, account]);

  // Regular users only see their enabled platforms; system admin sees all
  const visiblePlatforms = isSystemAdmin ? PLATFORM_IDS : enabledPlatforms;

  const filtered = visiblePlatforms.filter((pid) => {
    if (!search.trim()) return true;
    const d = PLATFORM_DISPLAY[pid];
    return d.label.toLowerCase().includes(search.toLowerCase());
  });

  // Tracked = has data (apps/keywords/competitors > 0), same logic as overview page
  const hasData = (pid: PlatformId) => {
    const s = platformStats[pid];
    return s && (s.apps > 0 || s.keywords > 0 || s.competitors > 0);
  };

  const tracked = filtered.filter((pid) => enabledPlatforms.includes(pid) && hasData(pid));
  const available = filtered.filter((pid) => enabledPlatforms.includes(pid) && !hasData(pid));
  // Admin-only: platforms not enabled for this account
  const notEnabled = filtered.filter((pid) => !enabledPlatforms.includes(pid));

  const trackedCount = enabledPlatforms.filter(hasData).length;

  const handleNavigate = () => onOpenChange(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[420px] overflow-y-auto p-6">
          <SheetTitle className="text-lg font-semibold mb-1">
            {isSystemAdmin ? "All Platforms" : "Your Platforms"}
          </SheetTitle>
          <p className="text-sm text-muted-foreground mb-4">
            {trackedCount}/{enabledPlatforms.length} platforms tracked
            {isSystemAdmin && ` · ${PLATFORM_IDS.length} total`}
          </p>

          {/* Search */}
          {visiblePlatforms.length > 3 && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search platforms..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          {/* Tracked Platforms — has data */}
          {tracked.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tracked Platforms
              </h3>
              {tracked.map((pid) => (
                <PlatformCard
                  key={pid}
                  pid={pid}
                  stats={platformStats[pid]}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}

          {/* Available Platforms — enabled but no data yet */}
          {available.length > 0 && (
            <div className={tracked.length > 0 ? "mt-6 space-y-2" : "space-y-2"}>
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Available Platforms
                </h3>
                <div className="flex-1 border-t border-dashed" />
                <span className="text-xs text-muted-foreground">{available.length}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Start tracking apps on these platforms to see stats and rankings.
              </p>
              {available.map((pid) => (
                <AvailablePlatformRow
                  key={pid}
                  pid={pid}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}

          {/* Not Enabled (admin-only) */}
          {notEnabled.length > 0 && (
            <div className="mt-6 space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Not Enabled
                </h3>
                <div className="flex-1 border-t border-dashed" />
                <span className="text-xs text-muted-foreground">{notEnabled.length}</span>
              </div>
              {notEnabled.map((pid) => {
                const d = PLATFORM_DISPLAY[pid];
                return (
                  <div
                    key={pid}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg opacity-50"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="text-sm text-muted-foreground">{d.label}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">Not enabled</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Request a Platform */}
          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Missing a platform?
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRequestOpen(true)}
            >
              <MessageSquarePlus className="h-4 w-4 mr-1.5" />
              Request a Platform
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <PlatformRequestDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
      />
    </>
  );
}
