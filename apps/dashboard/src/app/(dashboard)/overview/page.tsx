"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFeatureFlag } from "@/contexts/feature-flags-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ArrowRight, AppWindow, Search, Star, MessageSquarePlus, Globe, Bell, Flame, Calendar } from "lucide-react";
import { PLATFORMS, PLATFORM_IDS, type PlatformId } from "@appranks/shared";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import { OnboardingHero } from "@/components/onboarding-hero";
import { PlatformRequestDialog } from "@/components/platform-request-dialog";
import { AccountUsageCards, USAGE_STAT_PRESETS } from "@/components/account-usage-cards";
import { OverviewPlatformCard } from "@/components/overview-platform-card";
import { selectHighlights } from "@/components/overview-daily-highlights";

const CAPABILITY_LABELS: { key: string; label: string; section?: string }[] = [
  { key: "hasReviews", label: "Reviews" },
  { key: "hasKeywordSearch", label: "Keywords", section: "keywords" },
  { key: "hasFeaturedSections", label: "Featured", section: "featured" },
  { key: "hasAdTracking", label: "Ads" },
  { key: "hasSimilarApps", label: "Similar" },
  { key: "hasFeatureTaxonomy", label: "Features", section: "features" },
];

interface PlatformStats {
  apps: number;
  keywords: number;
  competitors: number;
  appSlug?: string;
  keywordSlug?: string;
  competitorSlug?: string;
}

type Persona = "new_user" | "single_platform" | "multi_platform";

function detectPersona(
  enabledPlatforms: PlatformId[],
  stats: Record<string, PlatformStats>,
  dataLoaded: boolean,
): Persona {
  // Don't declare "new_user" unless data was successfully loaded
  if (!dataLoaded) return "new_user";

  const totalApps = Object.values(stats).reduce((sum, s) => sum + s.apps, 0);
  if (totalApps === 0) return "new_user";

  const platformsWithApps = Object.entries(stats).filter(
    ([_, s]) => s.apps > 0
  ).length;
  if (platformsWithApps <= 1) return "single_platform";
  return "multi_platform";
}

export default function CrossPlatformOverviewPage() {
  const { fetchWithAuth, account, user } = useAuth();
  const hasResearch = useFeatureFlag("market-research");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, PlatformStats>>({});
  const [highlights, setHighlights] = useState<Record<string, any>>({});
  const [highlightsLoading, setHighlightsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  const enabledPlatforms = (account?.enabledPlatforms ?? []) as PlatformId[];
  const isSystemAdmin = user?.isSystemAdmin;

  useEffect(() => {
    if (!account) return;
    // Capture enabledPlatforms inside the effect to avoid stale closure
    const platforms = (account.enabledPlatforms ?? []) as PlatformId[];
    if (platforms.length === 0) {
      setLoading(false);
      setDataLoaded(true);
      return;
    }
    loadData(platforms);
  }, [account]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData(platforms: PlatformId[]) {
    setLoading(true);
    setFetchError(null);
    try {
      // Single API call returns counts + single-item slugs for all platforms
      const statsRes = await fetchWithAuth("/api/account/stats");
      if (!statsRes.ok) {
        setFetchError("Some data could not be loaded. Stats may be incomplete.");
        setDataLoaded(false);
        return;
      }

      const rawStats: Record<string, { apps: number; keywords: number; competitors: number; appSlug?: string; keywordSlug?: string; competitorSlug?: string }> = await statsRes.json();
      const platformStats: Record<string, PlatformStats> = {};
      for (const p of platforms) {
        const s = rawStats[p];
        platformStats[p] = {
          apps: s?.apps ?? 0,
          keywords: s?.keywords ?? 0,
          competitors: s?.competitors ?? 0,
          appSlug: s?.appSlug,
          keywordSlug: s?.keywordSlug,
          competitorSlug: s?.competitorSlug,
        };
      }

      setStats(platformStats);
      setDataLoaded(true);

      // Fetch highlights in background (truly non-blocking — page already rendered)
      setHighlightsLoading(true);
      fetchWithAuth("/api/overview/highlights").then(async (hlRes) => {
        if (hlRes.ok) {
          const hlBody = await hlRes.json();
          setHighlights(hlBody.platforms ?? {});
        }
      }).catch(() => {}).finally(() => {
        setHighlightsLoading(false);
      });
    } catch {
      setFetchError("Failed to load overview data. Please try again.");
      setDataLoaded(false);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Hero skeleton */}
        <Card className="rounded-xl">
          <CardContent className="py-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Platform card skeletons */}
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="rounded-xl border-l-4">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-5 w-32" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-20 rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const persona = detectPersona(enabledPlatforms, stats, dataLoaded);
  const totalApps = Object.values(stats).reduce((sum, s) => sum + s.apps, 0);
  const totalKeywords = Object.values(stats).reduce((sum, s) => sum + s.keywords, 0);
  const totalCompetitors = Object.values(stats).reduce((sum, s) => sum + s.competitors, 0);
  const platformsWithApps = Object.entries(stats).filter(([_, s]) => s.apps > 0).length;

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {fetchError && (
        <Card className="rounded-xl border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-amber-800 dark:text-amber-200">{fetchError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const platforms = (account?.enabledPlatforms ?? []) as PlatformId[];
                loadData(platforms);
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New user: OnboardingHero (only when data was actually loaded, not on error) */}
      {persona === "new_user" && !fetchError && <OnboardingHero />}

      {/* Single-platform: compact stats + dashboard link */}
      {persona === "single_platform" && (
        <>
          <AccountUsageCards stats={[
            { key: "apps", ...USAGE_STAT_PRESETS.apps, value: account?.usage.trackedApps ?? 0, limit: account?.limits.maxTrackedApps ?? 0, href: "/apps" },
            { key: "keywords", ...USAGE_STAT_PRESETS.keywords, value: account?.usage.trackedKeywords ?? 0, limit: account?.limits.maxTrackedKeywords ?? 0, href: "/keywords" },
            { key: "competitors", ...USAGE_STAT_PRESETS.competitors, value: account?.usage.competitorApps ?? 0, limit: account?.limits.maxCompetitorApps ?? 0, href: "/competitors" },
            { key: "research", ...USAGE_STAT_PRESETS.research, value: account?.usage.researchProjects ?? 0, limit: account?.limits.maxResearchProjects ?? 0, show: hasResearch },
            { key: "users", ...USAGE_STAT_PRESETS.users, value: account?.usage.users ?? 0, limit: account?.limits.maxUsers ?? 0, href: "/settings" },
          ]} />
          {enabledPlatforms.map((pid) => {
            const s = stats[pid];
            if (!s || s.apps === 0) return null;
            const brand = PLATFORM_DISPLAY[pid];
            const config = PLATFORMS[pid];
            return (
              <Card
                key={pid}
                className="rounded-xl border-t-4"
                style={{ borderTopColor: brand.color }}
              >
                <CardHeader className={`bg-gradient-to-r ${brand.gradient} rounded-t-none flex flex-row items-center gap-2`}>
                  <CardTitle className="text-lg">{config.name}</CardTitle>
                  <span className="text-sm font-normal text-muted-foreground ml-auto">
                    {s.apps} Apps &middot; {s.keywords} Keywords &middot; {s.competitors} Competitors
                  </span>
                </CardHeader>
                <CardContent className="pt-4">
                  <Link href={`/${pid}`}>
                    <Button variant="outline" className={`w-full ${brand.textAccent}`}>
                      Go to {config.name} Dashboard
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}

          {/* Explore more */}
          <ExpandYourTracking enabledPlatforms={enabledPlatforms} />
        </>
      )}

      {/* Multi-platform: aggregated stats + platform grid */}
      {persona === "multi_platform" && (
        <>
          <AccountUsageCards stats={[
            { key: "apps", ...USAGE_STAT_PRESETS.apps, value: account?.usage.trackedApps ?? 0, limit: account?.limits.maxTrackedApps ?? 0, href: "/apps" },
            { key: "keywords", ...USAGE_STAT_PRESETS.keywords, value: account?.usage.trackedKeywords ?? 0, limit: account?.limits.maxTrackedKeywords ?? 0, href: "/keywords" },
            { key: "competitors", ...USAGE_STAT_PRESETS.competitors, value: account?.usage.competitorApps ?? 0, limit: account?.limits.maxCompetitorApps ?? 0, href: "/competitors" },
            { key: "research", ...USAGE_STAT_PRESETS.research, value: account?.usage.researchProjects ?? 0, limit: account?.limits.maxResearchProjects ?? 0, show: hasResearch },
            { key: "users", ...USAGE_STAT_PRESETS.users, value: account?.usage.users ?? 0, limit: account?.limits.maxUsers ?? 0, href: "/settings" },
          ]} />

          {/* Cross-platform hero summary */}
          <Card className="rounded-xl bg-gradient-to-r from-primary/5 via-transparent to-primary/5 overflow-hidden">
            <CardContent className="py-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-lg">
                    Tracking across <strong className="text-foreground">{platformsWithApps} platforms</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: AppWindow, value: totalApps, label: "tracked", sublabel: "Apps", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-400", href: "/apps" },
                  { icon: Search, value: totalKeywords, label: "tracked", sublabel: "Keywords", bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-600 dark:text-purple-400", href: "/keywords" },
                  { icon: Star, value: totalCompetitors, label: "watched", sublabel: "Competitors", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400", href: "/competitors" },
                  { icon: Bell, value: (() => {
                    let alertCount = 0;
                    for (const p of Object.values(highlights)) {
                      const h = p?.highlights;
                      if (h) {
                        alertCount += (h.recentChanges?.length ?? 0) + (h.competitorAlerts?.length ?? 0);
                      }
                    }
                    return alertCount;
                  })(), label: "today", sublabel: "Alerts", bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-600 dark:text-rose-400", href: "/apps" },
                ].map(({ icon: Icon, value, label, sublabel, bg, text, href }) => (
                  <Link key={sublabel} href={href} className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl ${bg} hover:ring-1 hover:ring-border transition-all`}>
                    <Icon className={`h-4 w-4 ${text}`} />
                    <span className={`text-2xl font-bold tracking-tight ${text}`}>{value}</span>
                    <span className="text-xs text-muted-foreground">{sublabel} {label}</span>
                  </Link>
                ))}
              </div>
              {/* Top highlight across all platforms */}
              {(() => {
                const allHighlights = Object.entries(highlights).flatMap(([pid, data]) => {
                  if (!data?.highlights) return [];
                  return selectHighlights(data.highlights, pid, 1);
                });
                allHighlights.sort((a, b) => b.score - a.score);
                const top = allHighlights[0];
                if (!top) return null;
                return (
                  <Link href={top.href} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm">
                    <Flame className="h-4 w-4 text-orange-500 shrink-0" />
                    <span className="text-muted-foreground font-medium">Top highlight:</span>
                    <span className="truncate">{top.detail}</span>
                  </Link>
                );
              })()}
            </CardContent>
          </Card>
        </>
      )}

      {/* Platform cards — split into tracked and available */}
      {persona !== "single_platform" && (() => {
        const platformList = isSystemAdmin ? PLATFORM_IDS : enabledPlatforms;
        const tracked = platformList.filter((pid) => {
          const s = stats[pid];
          return s && (s.apps > 0 || s.keywords > 0 || s.competitors > 0);
        });
        const available = platformList.filter((pid) => {
          const s = stats[pid];
          return !s || (s.apps === 0 && s.keywords === 0 && s.competitors === 0);
        });
        const disabledPlatforms = isSystemAdmin
          ? PLATFORM_IDS.filter((pid) => !enabledPlatforms.includes(pid))
          : [];

        return (
          <>
            {/* Your Platforms — full cards, prominent section */}
            {tracked.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold">Your Platforms</h2>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {tracked.length} active
                  </span>
                </div>
                <div className="space-y-4">
                  {tracked.map((platformId) => (
                    <OverviewPlatformCard
                      key={platformId}
                      platformId={platformId}
                      data={highlights[platformId] ?? null}
                      stats={stats[platformId]}
                      highlightsLoading={highlightsLoading}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Available Platforms — compact pill layout */}
            {available.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground">Explore More Platforms</h3>
                  <div className="flex-1 border-t border-dashed" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {available.map((pid) => (
                    <AvailablePlatformPill key={pid} platformId={pid} />
                  ))}
                </div>
              </div>
            )}

            {/* System admin: disabled platforms */}
            {disabledPlatforms.length > 0 && (
              <div className="rounded-xl border border-dashed bg-muted/10 p-5 space-y-3 opacity-60">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Disabled Platforms</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {disabledPlatforms.map((pid) => (
                    <PlatformCard
                      key={pid}
                      platformId={pid}
                      stats={undefined}
                      isEnabled={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Request a Platform CTA */}
      <RequestPlatformCTA />
    </div>
  );
}

// -----------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------

function PlatformCard({
  platformId,
  stats,
  isEnabled,
}: {
  platformId: PlatformId;
  stats?: PlatformStats;
  isEnabled: boolean;
}) {
  const config = PLATFORMS[platformId];
  const brand = PLATFORM_DISPLAY[platformId];

  if (!isEnabled) {
    return (
      <Card
        className="rounded-xl border-dashed border-t-4 opacity-60 hover:opacity-80 transition-opacity h-full"
        style={{ borderTopColor: brand.color }}
      >
        <CardHeader className={`bg-gradient-to-r ${brand.gradient} rounded-t-xl`}>
          <CardTitle className="text-lg text-muted-foreground">
            {config.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Package className="h-6 w-6 mb-2" />
          <p className="text-sm font-medium">Not enabled</p>
          <p className="text-xs">Enable this platform to start tracking.</p>
        </CardContent>
      </Card>
    );
  }

  const capabilities = CAPABILITY_LABELS.filter(
    (c) => (config as Record<string, unknown>)[c.key] === true
  );

  const p = `/${platformId}`;

  return (
    <Link href={p} className="block h-full">
      <Card
        className="rounded-xl border-t-4 hover:shadow-md transition-shadow h-full cursor-pointer group"
        style={{ borderTopColor: brand.color }}
      >
        <CardHeader className={`bg-gradient-to-r ${brand.gradient} rounded-t-none flex flex-row items-center gap-2`}>
          <CardTitle className="text-lg">{config.name}</CardTitle>
          <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Stats — each clickable to its section */}
          <div className="grid grid-cols-3 gap-4">
            <Link href={stats?.appSlug ? `${p}/apps/${stats.appSlug}` : `${p}/apps`} className="text-center hover:bg-muted/50 rounded-lg py-1.5 -mx-1 px-1 transition-colors" onClick={(e) => e.stopPropagation()}>
              <div className="text-2xl font-bold">{stats?.apps ?? 0}</div>
              <div className="text-xs text-muted-foreground">Apps</div>
            </Link>
            {config.hasKeywordSearch && (
              <Link href={stats?.keywordSlug ? `${p}/keywords/${stats.keywordSlug}` : `${p}/keywords`} className="text-center hover:bg-muted/50 rounded-lg py-1.5 -mx-1 px-1 transition-colors" onClick={(e) => e.stopPropagation()}>
                <div className="text-2xl font-bold">{stats?.keywords ?? 0}</div>
                <div className="text-xs text-muted-foreground">Keywords</div>
              </Link>
            )}
            <Link href={stats?.competitorSlug ? `${p}/apps/${stats.competitorSlug}` : `${p}/competitors`} className="text-center hover:bg-muted/50 rounded-lg py-1.5 -mx-1 px-1 transition-colors" onClick={(e) => e.stopPropagation()}>
              <div className="text-2xl font-bold">{stats?.competitors ?? 0}</div>
              <div className="text-xs text-muted-foreground">Competitors</div>
            </Link>
          </div>

          {/* Capabilities — clickable ones link to their section */}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {capabilities.map((cap) => {
              const inner = (
                <span className={`text-xs flex items-center gap-1 ${cap.section ? "hover:underline" : ""}`}>
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: brand.color }}
                  />
                  {cap.label}
                </span>
              );
              if (cap.section) {
                return (
                  <Link key={cap.key} href={`${p}/${cap.section}`} onClick={(e) => e.stopPropagation()}>
                    {inner}
                  </Link>
                );
              }
              return <span key={cap.key}>{inner}</span>;
            })}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function AvailablePlatformPill({ platformId }: { platformId: PlatformId }) {
  const config = PLATFORMS[platformId];
  const brand = PLATFORM_DISPLAY[platformId];
  const capabilities = CAPABILITY_LABELS.filter(
    (c) => (config as Record<string, unknown>)[c.key] === true
  );

  return (
    <Link
      href={`/${platformId}`}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-background hover:bg-muted/50 hover:shadow-sm transition-all group"
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: brand.color }}
      />
      <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        {config.name}
      </span>
      <span className="text-[10px] text-muted-foreground/60">
        {capabilities.length} features
      </span>
    </Link>
  );
}

function ExpandYourTracking({ enabledPlatforms }: { enabledPlatforms: PlatformId[] }) {
  const disabled = PLATFORM_IDS.filter((pid) => !enabledPlatforms.includes(pid));
  if (disabled.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Expand Your Tracking</h2>
      <p className="text-sm text-muted-foreground">
        AppRanks supports {disabled.length} more platform{disabled.length !== 1 ? "s" : ""}:
      </p>
      <div className="flex flex-wrap gap-2">
        {disabled.map((pid) => {
          const d = PLATFORM_DISPLAY[pid];
          return (
            <div
              key={pid}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background hover:bg-muted transition-colors"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-sm">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RequestPlatformCTA() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card className="rounded-xl border-dashed bg-gradient-to-br from-muted/40 via-background to-muted/40">
        <CardContent className="py-10 px-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <MessageSquarePlus className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Don&apos;t see your platform?</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            We&apos;re always expanding our platform coverage. Let us know which marketplace you&apos;d like us to support next.
          </p>
          <Button onClick={() => setOpen(true)} className="px-6">
            <MessageSquarePlus className="h-4 w-4 mr-2" />
            Request a Platform
          </Button>
        </CardContent>
      </Card>
      <PlatformRequestDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
