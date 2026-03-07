"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ArrowRight } from "lucide-react";
import { PLATFORMS, type PlatformId } from "@appranks/shared";

const PLATFORM_BRANDS: Record<
  string,
  { primary: string; gradient: string; borderTop: string; textAccent: string }
> = {
  shopify: {
    primary: "#95BF47",
    gradient: "from-[#95BF47]/10 to-transparent",
    borderTop: "border-t-[#95BF47]",
    textAccent: "text-[#5E8E3E]",
  },
  salesforce: {
    primary: "#00A1E0",
    gradient: "from-[#00A1E0]/10 to-transparent",
    borderTop: "border-t-[#00A1E0]",
    textAccent: "text-[#0B5CAB]",
  },
  canva: {
    primary: "#00C4CC",
    gradient: "from-[#00C4CC]/10 to-transparent",
    borderTop: "border-t-[#00C4CC]",
    textAccent: "text-[#00848A]",
  },
};

const ALL_PLATFORMS: PlatformId[] = ["shopify", "salesforce", "canva"];

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

export default function CrossPlatformOverviewPage() {
  const { fetchWithAuth, account } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, PlatformStats>>({});

  const enabledPlatforms = (account?.enabledPlatforms ?? []) as PlatformId[];

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
        <div>
          <h1 className="text-2xl font-bold">Platforms</h1>
          <p className="text-muted-foreground mt-1">
            Monitor your app store presence across all platforms.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="rounded-xl">
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="text-center">
                      <Skeleton className="h-8 w-10 mx-auto mb-1" />
                      <Skeleton className="h-3 w-12 mx-auto" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platforms</h1>
        <p className="text-muted-foreground mt-1">
          Monitor your app store presence across all platforms.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {ALL_PLATFORMS.map((platformId) => {
          const isEnabled = enabledPlatforms.includes(platformId);
          const config = PLATFORMS[platformId];
          const brand = PLATFORM_BRANDS[platformId];
          const platformStat = stats[platformId];

          if (!isEnabled) {
            return (
              <Card
                key={platformId}
                className="rounded-xl border-dashed border-t-4 opacity-60"
                style={{ borderTopColor: brand.primary }}
              >
                <CardHeader
                  className={`bg-gradient-to-r ${brand.gradient} rounded-t-xl`}
                >
                  <CardTitle className="text-lg text-muted-foreground">
                    {config.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mb-2" />
                  <p className="text-sm font-medium">Coming soon.</p>
                  <p className="text-xs">Not yet active.</p>
                </CardContent>
              </Card>
            );
          }

          const capabilities = CAPABILITY_LABELS.filter(
            (c) => (config as Record<string, unknown>)[c.key] === true
          );

          return (
            <Card
              key={platformId}
              className="rounded-xl border-t-4 hover:shadow-md transition-shadow"
              style={{ borderTopColor: brand.primary }}
            >
              <CardHeader
                className={`bg-gradient-to-r ${brand.gradient} rounded-t-xl`}
              >
                <CardTitle className="text-lg">{config.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {platformStat?.apps ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Apps</div>
                  </div>
                  {config.hasKeywordSearch && (
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {platformStat?.keywords ?? 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Keywords
                      </div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {platformStat?.competitors ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Competitors
                    </div>
                  </div>
                </div>

                {/* Capabilities */}
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {capabilities.map((cap) => (
                    <span
                      key={cap.key}
                      className="text-xs flex items-center gap-1"
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: brand.primary }}
                      />
                      {cap.label}
                    </span>
                  ))}
                </div>

                {/* Action */}
                <Link href={`/${platformId}/overview`}>
                  <Button
                    variant="outline"
                    className={`w-full ${brand.textAccent}`}
                  >
                    View Dashboard
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Account Usage */}
      {account && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">Account Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {account.usage.trackedApps}/{account.limits.maxTrackedApps}
                </div>
                <div className="text-xs text-muted-foreground">Apps</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {account.usage.trackedKeywords}/
                  {account.limits.maxTrackedKeywords}
                </div>
                <div className="text-xs text-muted-foreground">Keywords</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {account.usage.competitorApps}/
                  {account.limits.maxCompetitorApps}
                </div>
                <div className="text-xs text-muted-foreground">Competitors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {account.usage.researchProjects}/
                  {account.limits.maxResearchProjects}
                </div>
                <div className="text-xs text-muted-foreground">Research</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {account.usage.users}/{account.limits.maxUsers}
                </div>
                <div className="text-xs text-muted-foreground">Users</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
