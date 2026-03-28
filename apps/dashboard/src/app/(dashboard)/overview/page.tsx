"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ArrowRight, AppWindow, Search, Star, MessageSquarePlus, Globe } from "lucide-react";
import { PLATFORMS, PLATFORM_IDS, type PlatformId } from "@appranks/shared";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import { OnboardingHero } from "@/components/onboarding-hero";
import { PlatformRequestDialog } from "@/components/platform-request-dialog";
import { AccountUsageCards, USAGE_STAT_PRESETS } from "@/components/account-usage-cards";

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
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, PlatformStats>>({});
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
      const platformStats: Record<string, PlatformStats> = {};
      let anyFailed = false;

      await Promise.all(
        platforms.map(async (p) => {
          const caps = PLATFORMS[p];
          const [appsRes, keywordsRes, competitorsRes] = await Promise.all([
            fetchWithAuth(`/api/apps?platform=${p}`),
            caps.hasKeywordSearch
              ? fetchWithAuth(`/api/keywords?platform=${p}`)
              : Promise.resolve(null),
            fetchWithAuth(`/api/account/competitors?platform=${p}`),
          ]);

          // Track if any API call failed
          if (!appsRes.ok) anyFailed = true;
          if (competitorsRes && !competitorsRes.ok) anyFailed = true;
          if (keywordsRes && !keywordsRes.ok) anyFailed = true;

          const appsArr = appsRes.ok ? await appsRes.json().then((d: unknown) => Array.isArray(d) ? d : []) : [];
          const keywordsArr = keywordsRes?.ok ? await keywordsRes.json().then((d: unknown) => Array.isArray(d) ? d : []) : [];
          const competitorsArr = competitorsRes.ok ? await competitorsRes.json().then((d: unknown) => Array.isArray(d) ? d : []) : [];

          platformStats[p] = {
            apps: appsArr.length,
            keywords: keywordsArr.length,
            competitors: competitorsArr.length,
            appSlug: appsArr.length === 1 ? appsArr[0]?.slug : undefined,
            keywordSlug: keywordsArr.length === 1 ? keywordsArr[0]?.slug : undefined,
            competitorSlug: competitorsArr.length === 1 ? competitorsArr[0]?.slug : undefined,
          };
        })
      );

      setStats(platformStats);
      setDataLoaded(!anyFailed);
      if (anyFailed) {
        setFetchError("Some data could not be loaded. Stats may be incomplete.");
      }
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
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="rounded-xl">
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
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
            { key: "research", ...USAGE_STAT_PRESETS.research, value: account?.usage.researchProjects ?? 0, limit: account?.limits.maxResearchProjects ?? 0 },
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
            { key: "research", ...USAGE_STAT_PRESETS.research, value: account?.usage.researchProjects ?? 0, limit: account?.limits.maxResearchProjects ?? 0 },
            { key: "users", ...USAGE_STAT_PRESETS.users, value: account?.usage.users ?? 0, limit: account?.limits.maxUsers ?? 0, href: "/settings" },
          ]} />

          {/* Cross-platform summary */}
          <Card className="rounded-xl bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="py-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3 text-lg text-muted-foreground">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Globe className="h-6 w-6 text-primary" />
                  </div>
                  <span>Tracking across <strong className="text-foreground text-xl">{platformsWithApps} platforms</strong></span>
                </div>
                <div className="flex flex-wrap gap-4">
                  {[
                    { icon: AppWindow, value: totalApps, label: "Apps", bg: "bg-blue-50", ring: "ring-blue-200", text: "text-blue-600", href: "/apps" },
                    { icon: Search, value: totalKeywords, label: "Keywords", bg: "bg-purple-50", ring: "ring-purple-200", text: "text-purple-600", href: "/keywords" },
                    { icon: Star, value: totalCompetitors, label: "Competitors", bg: "bg-amber-50", ring: "ring-amber-200", text: "text-amber-600", href: "/competitors" },
                  ].map(({ icon: Icon, value, label, bg, ring, text, href }) => (
                    <Link key={label} href={href} className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl ${bg} ring-1 ${ring} hover:ring-2 transition-all`}>
                      <Icon className={`h-5 w-5 ${text}`} />
                      <span className={`text-2xl font-bold tracking-tight ${text}`}>{value}</span>
                      <span className="text-sm text-muted-foreground">{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tracked.map((platformId) => (
                    <PlatformCard
                      key={platformId}
                      platformId={platformId}
                      stats={stats[platformId]}
                      isEnabled={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Available Platforms — subdued container, smaller scale */}
            {available.length > 0 && (
              <div className="rounded-xl border bg-muted/30 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-foreground/70 uppercase tracking-wider">Available Platforms</h3>
                  <div className="flex-1 border-t border-dashed" />
                  <span className="text-xs text-muted-foreground">{available.length} platforms</span>
                </div>
                <p className="text-sm text-muted-foreground">Start tracking on any of these to see stats and rankings.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {available.map((pid) => (
                    <AvailablePlatformRow key={pid} platformId={pid} />
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

function AvailablePlatformRow({ platformId }: { platformId: PlatformId }) {
  const config = PLATFORMS[platformId];
  const brand = PLATFORM_DISPLAY[platformId];
  const capabilities = CAPABILITY_LABELS.filter(
    (c) => (config as Record<string, unknown>)[c.key] === true
  );

  return (
    <Link
      href={`/${platformId}`}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-background/80 hover:bg-background transition-colors group border border-transparent hover:border-border"
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: brand.color }}
      />
      <span className="text-[13px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">{config.name}</span>
      <div className="hidden sm:flex flex-wrap gap-1 ml-auto">
        {capabilities.slice(0, 4).map((cap) => (
          <span
            key={cap.key}
            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
          >
            {cap.label}
          </span>
        ))}
      </div>
      <ArrowRight className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto sm:ml-0" />
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
