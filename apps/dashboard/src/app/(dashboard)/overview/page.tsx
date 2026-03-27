"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ArrowRight, AppWindow, Search, Star, FlaskConical, Users, MessageSquarePlus } from "lucide-react";
import { PLATFORMS, PLATFORM_IDS, type PlatformId } from "@appranks/shared";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import { OnboardingHero } from "@/components/onboarding-hero";

const CAPABILITY_LABELS: { key: string; label: string }[] = [
  { key: "hasReviews", label: "Reviews" },
  { key: "hasKeywordSearch", label: "Keywords" },
  { key: "hasFeaturedSections", label: "Featured" },
  { key: "hasAdTracking", label: "Ads" },
  { key: "hasSimilarApps", label: "Similar" },
  { key: "hasFeatureTaxonomy", label: "Features" },
];

interface PlatformStats {
  apps: number;
  keywords: number;
  competitors: number;
}

type Persona = "new_user" | "single_platform" | "multi_platform";

function detectPersona(
  enabledPlatforms: PlatformId[],
  stats: Record<string, PlatformStats>
): Persona {
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

  const enabledPlatforms = (account?.enabledPlatforms ?? []) as PlatformId[];
  const isSystemAdmin = user?.isSystemAdmin;

  useEffect(() => {
    if (!account) return;
    loadData();
  }, [account]);

  async function loadData() {
    setLoading(true);
    try {
      const platformStats: Record<string, PlatformStats> = {};

      await Promise.all(
        enabledPlatforms.map(async (p) => {
          const caps = PLATFORMS[p];
          const [appsRes, keywordsRes, competitorsRes] = await Promise.all([
            fetchWithAuth(`/api/apps?platform=${p}`).then((r) =>
              r.ok ? r.json() : []
            ),
            caps.hasKeywordSearch
              ? fetchWithAuth(`/api/keywords?platform=${p}`).then((r) =>
                  r.ok ? r.json() : []
                )
              : Promise.resolve([]),
            fetchWithAuth(`/api/account/competitors?platform=${p}`).then((r) =>
              r.ok ? r.json() : []
            ),
          ]);

          platformStats[p] = {
            apps: Array.isArray(appsRes) ? appsRes.length : 0,
            keywords: Array.isArray(keywordsRes) ? keywordsRes.length : 0,
            competitors: Array.isArray(competitorsRes)
              ? competitorsRes.length
              : 0,
          };
        })
      );

      setStats(platformStats);
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

  const persona = detectPersona(enabledPlatforms, stats);
  const totalApps = Object.values(stats).reduce((sum, s) => sum + s.apps, 0);
  const totalKeywords = Object.values(stats).reduce((sum, s) => sum + s.keywords, 0);
  const totalCompetitors = Object.values(stats).reduce((sum, s) => sum + s.competitors, 0);
  const platformsWithApps = Object.entries(stats).filter(([_, s]) => s.apps > 0).length;

  return (
    <div className="space-y-6">
      {/* New user: OnboardingHero */}
      {persona === "new_user" && <OnboardingHero />}

      {/* Single-platform: compact stats + dashboard link */}
      {persona === "single_platform" && (
        <>
          <AccountUsageRow account={account} />
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
                <CardHeader className={`bg-gradient-to-r ${brand.gradient} rounded-t-xl`}>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{config.name}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {s.apps} Apps &middot; {s.keywords} Keywords &middot; {s.competitors} Competitors
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <Link href={`/${pid}/overview`}>
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
          <AccountUsageRow account={account} />

          {/* Cross-platform summary */}
          <Card className="rounded-xl">
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-sm text-muted-foreground">
                  Tracking across <strong className="text-foreground">{platformsWithApps} platforms</strong>
                </div>
                <div className="flex gap-6 text-center">
                  <div>
                    <div className="text-xl font-bold">{totalApps}</div>
                    <div className="text-xs text-muted-foreground">Apps</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold">{totalKeywords}</div>
                    <div className="text-xs text-muted-foreground">Keywords</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold">{totalCompetitors}</div>
                    <div className="text-xs text-muted-foreground">Competitors</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Platform cards grid (for multi-platform and new user) */}
      {persona !== "single_platform" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(isSystemAdmin ? PLATFORM_IDS : enabledPlatforms).map((platformId) => (
            <PlatformCard
              key={platformId}
              platformId={platformId}
              stats={stats[platformId]}
              isEnabled={enabledPlatforms.includes(platformId)}
            />
          ))}

          {/* Show disabled platforms for discovery (not sysadmin, who sees all) */}
          {!isSystemAdmin &&
            PLATFORM_IDS.filter((pid) => !enabledPlatforms.includes(pid)).map((pid) => (
              <PlatformCard
                key={pid}
                platformId={pid}
                stats={undefined}
                isEnabled={false}
              />
            ))}
        </div>
      )}

      {/* Request a Platform CTA */}
      <RequestPlatformCTA />
    </div>
  );
}

// -----------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------

function AccountUsageRow({ account }: { account: any }) {
  if (!account) return null;
  return (
    <Card className="rounded-xl">
      <CardContent className="py-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {[
            { icon: AppWindow, usage: account.usage.trackedApps, limit: account.limits.maxTrackedApps, label: "Apps" },
            { icon: Search, usage: account.usage.trackedKeywords, limit: account.limits.maxTrackedKeywords, label: "Keywords" },
            { icon: Star, usage: account.usage.competitorApps, limit: account.limits.maxCompetitorApps, label: "Competitors" },
            { icon: FlaskConical, usage: account.usage.researchProjects, limit: account.limits.maxResearchProjects, label: "Research" },
            { icon: Users, usage: account.usage.users, limit: account.limits.maxUsers, label: "Users" },
          ].map(({ icon: Icon, usage, limit, label }) => (
            <div key={label} className="text-center">
              <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="text-lg font-bold">{usage}/{limit}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

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

  return (
    <Card
      className="rounded-xl border-t-4 hover:shadow-md transition-shadow h-full"
      style={{ borderTopColor: brand.color }}
    >
      <CardHeader className={`bg-gradient-to-r ${brand.gradient} rounded-t-xl`}>
        <CardTitle className="text-lg">{config.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{stats?.apps ?? 0}</div>
            <div className="text-xs text-muted-foreground">Apps</div>
          </div>
          {config.hasKeywordSearch && (
            <div className="text-center">
              <div className="text-2xl font-bold">{stats?.keywords ?? 0}</div>
              <div className="text-xs text-muted-foreground">Keywords</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-2xl font-bold">{stats?.competitors ?? 0}</div>
            <div className="text-xs text-muted-foreground">Competitors</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {capabilities.map((cap) => (
            <span key={cap.key} className="text-xs flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: brand.color }}
              />
              {cap.label}
            </span>
          ))}
        </div>

        <Link href={`/${platformId}/overview`}>
          <Button variant="outline" className={`w-full ${brand.textAccent}`}>
            View Dashboard
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
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
  return (
    <Card className="rounded-xl bg-gradient-to-r from-muted/50 to-muted/30">
      <CardContent className="py-6 text-center">
        <MessageSquarePlus className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <h3 className="font-semibold mb-1">Don&apos;t see your platform?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          We&apos;re always expanding. Tell us which marketplace you&apos;d like us to support.
        </p>
        <Button variant="outline" disabled>
          Request a Platform (Coming Soon)
        </Button>
      </CardContent>
    </Card>
  );
}
