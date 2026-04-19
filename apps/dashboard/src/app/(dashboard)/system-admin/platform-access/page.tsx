"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "@/components/ui/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Globe, Search, Users, UserCheck, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PLATFORM_IDS, type PlatformId, platformFeatureFlagSlug } from "@appranks/shared";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "@/lib/platform-display";

interface PlatformFlag {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  accountCount: number;
  userCount: number;
}

export default function PlatformAccessPage() {
  const { fetchWithAuth } = useAuth();
  const [platforms, setPlatforms] = useState<PlatformFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadPlatforms = useCallback(async () => {
    const res = await fetchWithAuth("/api/system-admin/feature-flags");
    if (res.ok) {
      const data = await res.json();
      // Filter to only platform-* flags and enrich with platform info
      const platformSlugs = new Set(PLATFORM_IDS.map(platformFeatureFlagSlug));
      const platformFlags = (data.data as PlatformFlag[]).filter((f) =>
        platformSlugs.has(f.slug)
      );
      setPlatforms(platformFlags);
    }
    setLoading(false);
  }, [fetchWithAuth]);

  useEffect(() => {
    loadPlatforms();
  }, [loadPlatforms]);

  async function togglePlatform(slug: string, isEnabled: boolean) {
    setPlatforms((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, isEnabled: !isEnabled } : p))
    );

    const res = await fetchWithAuth(`/api/system-admin/feature-flags/${slug}`, {
      method: "PATCH",
      body: JSON.stringify({ isEnabled: !isEnabled }),
    });

    if (res.ok) {
      toast.success(`${slug.replace("platform-", "")} ${!isEnabled ? "enabled" : "disabled"}`);
      loadPlatforms();
    } else {
      setPlatforms((prev) =>
        prev.map((p) => (p.slug === slug ? { ...p, isEnabled } : p))
      );
      toast.error("Failed to toggle platform");
    }
  }

  async function enableAll() {
    const disabled = platforms.filter((p) => !p.isEnabled);
    if (disabled.length === 0) return;

    setPlatforms((prev) => prev.map((p) => ({ ...p, isEnabled: true })));

    const results = await Promise.allSettled(
      disabled.map((p) =>
        fetchWithAuth(`/api/system-admin/feature-flags/${p.slug}`, {
          method: "PATCH",
          body: JSON.stringify({ isEnabled: true }),
        })
      )
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      toast.error(`Failed to enable ${failed} platform(s)`);
    } else {
      toast.success(`All platforms enabled`);
    }
    loadPlatforms();
  }

  async function disableAll() {
    const enabled = platforms.filter((p) => p.isEnabled);
    if (enabled.length === 0) return;

    setPlatforms((prev) => prev.map((p) => ({ ...p, isEnabled: false })));

    const results = await Promise.allSettled(
      enabled.map((p) =>
        fetchWithAuth(`/api/system-admin/feature-flags/${p.slug}`, {
          method: "PATCH",
          body: JSON.stringify({ isEnabled: false }),
        })
      )
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      toast.error(`Failed to disable ${failed} platform(s)`);
    } else {
      toast.success(`All platforms disabled`);
    }
    loadPlatforms();
  }

  // Map flag slug → platformId for display
  function getPlatformId(slug: string): PlatformId | null {
    for (const pid of PLATFORM_IDS) {
      if (platformFeatureFlagSlug(pid) === slug) return pid;
    }
    return null;
  }

  const enabledCount = platforms.filter((p) => p.isEnabled).length;
  const totalAccountOverrides = platforms.reduce((sum, p) => sum + p.accountCount, 0);

  const filtered = search
    ? platforms.filter((p) => {
        const pid = getPlatformId(p.slug);
        const label = pid ? PLATFORM_LABELS[pid] : p.name;
        return label.toLowerCase().includes(search.toLowerCase());
      })
    : platforms;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Platform Access"}
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6" />
            Platform Access
          </h1>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={enableAll}>
              Enable All
            </Button>
            <Button size="sm" variant="outline" onClick={disableAll}>
              Disable All
            </Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{enabledCount} / {platforms.length}</p>
                <p className="text-sm text-muted-foreground">Platforms Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{totalAccountOverrides}</p>
                <p className="text-sm text-muted-foreground">Account Overrides</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{platforms.reduce((sum, p) => sum + p.userCount, 0)}</p>
                <p className="text-sm text-muted-foreground">User Overrides</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">All Platforms</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search platforms..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No platforms found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((flag) => {
                const pid = getPlatformId(flag.slug);
                const label = pid ? PLATFORM_LABELS[pid] : flag.name;
                const color = pid ? PLATFORM_COLORS[pid] : "#888";

                return (
                  <div
                    key={flag.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                    style={{ borderLeft: `4px solid ${color}` }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/system-admin/feature-flags/${flag.slug}`}
                          className="font-medium hover:underline truncate"
                        >
                          {label}
                        </Link>
                        <Badge variant={flag.isEnabled ? "default" : "secondary"} className="shrink-0">
                          {flag.isEnabled ? "On" : "Off"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {flag.accountCount > 0 && (
                          <span>{flag.accountCount} account{flag.accountCount !== 1 ? "s" : ""}</span>
                        )}
                        {flag.userCount > 0 && (
                          <span>{flag.userCount} user{flag.userCount !== 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <Button
                        size="sm"
                        variant={flag.isEnabled ? "outline" : "default"}
                        onClick={() => togglePlatform(flag.slug, flag.isEnabled)}
                      >
                        {flag.isEnabled ? "Disable" : "Enable"}
                      </Button>
                      <Link href={`/system-admin/feature-flags/${flag.slug}`}>
                        <Button size="sm" variant="ghost">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
