"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { usePlatformAccess } from "@/hooks/use-platform-access";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Bookmark } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TableSkeleton } from "@/components/skeletons";
import { PlatformBadgeCell } from "@/components/platform-badge-cell";
import { PlatformFilterChips } from "@/components/platform-filter-chips";
import { ViewModeToggle, useViewMode } from "@/components/view-mode-toggle";
import { PlatformGroupedTable, type PlatformGroup } from "@/components/platform-grouped-table";
import { DeveloperTopSection } from "@/components/developer-top-section";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import type { PlatformId } from "@appranks/shared";

interface TopApp {
  iconUrl: string;
  name: string;
  slug: string;
  platform: string;
}

interface Developer {
  id: number;
  slug: string;
  name: string;
  website: string | null;
  platformCount: number;
  linkCount: number;
  appCount: number;
  platforms: string[];
  topApps: TopApp[];
  isStarred: boolean;
}

interface TrackedDeveloper {
  id: number;
  slug: string;
  name: string;
  platformCount: number;
  platforms: string[];
  totalApps: number;
  isStarred: boolean;
  trackedApps: { slug: string; name: string; platform: string; iconUrl: string | null }[];
}

interface CompetitorDeveloper {
  id: number;
  slug: string;
  name: string;
  platformCount: number;
  platforms: string[];
  totalApps: number;
  isStarred: boolean;
  competitorApps: { slug: string; name: string; platform: string; iconUrl: string | null }[];
}

interface DeveloperResponse {
  developers: Developer[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function filterDeveloperForVisiblePlatforms(dev: Developer, enabledPlatforms: PlatformId[]): Developer | null {
  if (enabledPlatforms.length === 0) return dev;

  const allowed = new Set<string>(enabledPlatforms);
  const platforms = dev.platforms.filter((platform) => allowed.has(platform));
  const topApps = dev.topApps.filter((app) => allowed.has(app.platform));
  if (platforms.length === 0 && topApps.length === 0) return null;

  return {
    ...dev,
    platforms,
    topApps,
    platformCount: platforms.length,
    appCount: Math.min(dev.appCount, topApps.length),
  };
}

function filterTrackedDeveloperForVisiblePlatforms(
  dev: TrackedDeveloper,
  enabledPlatforms: PlatformId[],
): TrackedDeveloper | null {
  if (enabledPlatforms.length === 0) return dev;

  const allowed = new Set<string>(enabledPlatforms);
  const platforms = dev.platforms.filter((platform) => allowed.has(platform));
  const trackedApps = dev.trackedApps.filter((app) => allowed.has(app.platform));
  if (platforms.length === 0 && trackedApps.length === 0) return null;

  return {
    ...dev,
    platforms,
    trackedApps,
    platformCount: platforms.length,
  };
}

function filterCompetitorDeveloperForVisiblePlatforms(
  dev: CompetitorDeveloper,
  enabledPlatforms: PlatformId[],
): CompetitorDeveloper | null {
  if (enabledPlatforms.length === 0) return dev;

  const allowed = new Set<string>(enabledPlatforms);
  const platforms = dev.platforms.filter((platform) => allowed.has(platform));
  const competitorApps = dev.competitorApps.filter((app) => allowed.has(app.platform));
  if (platforms.length === 0 && competitorApps.length === 0) return null;

  return {
    ...dev,
    platforms,
    competitorApps,
    platformCount: platforms.length,
  };
}

export default function DevelopersPage() {
  const { fetchWithAuth } = useAuth();
  const { accessiblePlatforms: enabledPlatforms } = usePlatformAccess();
  const [data, setData] = useState<DeveloperResponse | null>(null);
  const [trackedDevs, setTrackedDevs] = useState<TrackedDeveloper[]>([]);
  const [competitorDevs, setCompetitorDevs] = useState<CompetitorDeveloper[]>([]);
  const [topLoading, setTopLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [activePlatforms, setActivePlatforms] = useState<PlatformId[]>([]);
  const { viewMode, changeViewMode } = useViewMode("developers-view-mode", () => setPage(1));
  const limit = viewMode === "grouped" ? 200 : 25;

  function togglePlatform(pid: PlatformId) {
    setActivePlatforms((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid]
    );
    setPage(1);
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), sort, order });
      if (search) params.set("search", search);
      if (activePlatforms.length > 0) params.set("platforms", activePlatforms.join(","));
      const res = await fetchWithAuth(`/api/developers?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, page, search, sort, order, activePlatforms, limit]);

  useEffect(() => { loadData(); }, [loadData]);

  // Fetch tracked + competitor developers once
  useEffect(() => {
    (async () => {
      setTopLoading(true);
      try {
        const [trackedRes, competitorRes] = await Promise.all([
          fetchWithAuth("/api/developers/tracked"),
          fetchWithAuth("/api/developers/competitors"),
        ]);
        if (trackedRes.ok) {
          const body = await trackedRes.json();
          setTrackedDevs(body.developers ?? []);
        }
        if (competitorRes.ok) {
          const body = await competitorRes.json();
          setCompetitorDevs(body.developers ?? []);
        }
      } catch { /* ignore */ } finally {
        setTopLoading(false);
      }
    })();
  }, [fetchWithAuth]);

  function toggleSort(field: string) {
    if (sort === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setOrder("asc");
    }
    setPage(1);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadData();
  }

  function sortDevelopers(devs: Developer[]): Developer[] {
    return [...devs].sort((a, b) => {
      // Starred always first
      if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
      // Then by current sort field
      let cmp = 0;
      if (sort === "apps") {
        cmp = a.appCount - b.appCount;
      } else if (sort === "platforms") {
        cmp = a.platformCount - b.platformCount;
      } else {
        cmp = a.name.localeCompare(b.name);
      }
      return order === "desc" ? -cmp : cmp;
    });
  }

  async function toggleStar(devId: number, currentlyStarred: boolean) {
    if (!data) return;
    const updated = data.developers.map((d) =>
      d.id === devId ? { ...d, isStarred: !currentlyStarred } : d
    );
    setData({ ...data, developers: sortDevelopers(updated) });
    try {
      const method = currentlyStarred ? "DELETE" : "POST";
      const res = await fetchWithAuth(`/api/account/starred-developers/${devId}`, { method });
      if (!res.ok) throw new Error();
    } catch {
      setData((prev) => {
        if (!prev) return prev;
        const reverted = prev.developers.map((d) =>
          d.id === devId ? { ...d, isStarred: currentlyStarred } : d
        );
        return { ...prev, developers: sortDevelopers(reverted) };
      });
    }
  }

  const developers = useMemo(
    () => (data?.developers ?? [])
      .map((dev) => filterDeveloperForVisiblePlatforms(dev, enabledPlatforms))
      .filter((dev): dev is Developer => dev !== null),
    [data?.developers, enabledPlatforms]
  );
  const visibleTrackedDevs = useMemo(
    () => trackedDevs
      .map((dev) => filterTrackedDeveloperForVisiblePlatforms(dev, enabledPlatforms))
      .filter((dev): dev is TrackedDeveloper => dev !== null),
    [trackedDevs, enabledPlatforms]
  );
  const visibleCompetitorDevs = useMemo(
    () => competitorDevs
      .map((dev) => filterCompetitorDeveloperForVisiblePlatforms(dev, enabledPlatforms))
      .filter((dev): dev is CompetitorDeveloper => dev !== null),
    [competitorDevs, enabledPlatforms]
  );
  const pagination = data?.pagination;
  const emptyMessage = search ? "No developers found matching your search." : "No developers found.";

  // Group developers by platform (a dev can appear in multiple groups)
  const platformGroups = useMemo<PlatformGroup<Developer>[]>(() => {
    if (viewMode !== "grouped") return [];
    const map = new Map<string, Developer[]>();
    const allowed = enabledPlatforms.length > 0 ? new Set<string>(enabledPlatforms) : null;
    for (const dev of developers) {
      for (const p of dev.platforms) {
        if (allowed && !allowed.has(p)) continue;
        const list = map.get(p) || [];
        list.push(dev);
        map.set(p, list);
      }
    }
    // Sort within each group using active sort field + starred first
    for (const [key, devs] of map) {
      map.set(key, sortDevelopers(devs));
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        const labelA = PLATFORM_DISPLAY[a as PlatformId]?.label ?? a;
        const labelB = PLATFORM_DISPLAY[b as PlatformId]?.label ?? b;
        return labelA.localeCompare(labelB);
      })
      .map(([platform, devs]) => ({ platform, items: devs }));
  }, [developers, viewMode, enabledPlatforms, sort, order]);

  const maxIcons = 10;

  function renderAppsCell(dev: Developer) {
    const visibleApps = dev.topApps.slice(0, maxIcons);
    const remaining = dev.appCount - visibleApps.length;

    if (visibleApps.length === 0) {
      return <span className="text-muted-foreground text-sm">0</span>;
    }

    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center -space-x-1.5">
          {visibleApps.map((app, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <Link
                  href={`/${app.platform}/apps/${app.slug}`}
                  className="shrink-0 rounded border border-background hover:z-10 hover:scale-110 transition-transform"
                >
                  <img src={app.iconUrl} alt={app.name} className="w-5 h-5 rounded" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{app.name}</TooltipContent>
            </Tooltip>
          ))}
          {remaining > 0 && (
            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium border border-background shrink-0">
              +{remaining}
            </span>
          )}
        </div>
      </TooltipProvider>
    );
  }

  function renderDeveloperRow(dev: Developer) {
    return (
      <TableRow key={dev.id}>
        <TableCell className="w-10">
          <button
            onClick={() => toggleStar(dev.id, dev.isStarred)}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label={dev.isStarred ? "Remove bookmark" : "Bookmark developer"}
          >
            <Bookmark
              className={`h-4 w-4 ${
                dev.isStarred
                  ? "fill-amber-500 text-amber-500"
                  : "text-muted-foreground hover:text-amber-500"
              }`}
            />
          </button>
        </TableCell>
        <TableCell>
          <Link href={`/developers/${dev.slug}`} className="font-medium hover:underline">
            {dev.name}
          </Link>
        </TableCell>
        <TableCell>{renderAppsCell(dev)}</TableCell>
        <TableCell className="text-muted-foreground text-right tabular-nums">
          {dev.appCount}
        </TableCell>
        {viewMode === "list" && (
          <>
            <TableCell>
              <div className="flex flex-wrap gap-1.5">
                {dev.platforms
                  .filter((p) => enabledPlatforms.length === 0 || enabledPlatforms.includes(p as PlatformId))
                  .map((p) => (
                    <PlatformBadgeCell key={p} platform={p} />
                  ))}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground text-right">
              {enabledPlatforms.length > 0
                ? dev.platforms.filter((p) => enabledPlatforms.includes(p as PlatformId)).length
                : dev.platformCount}
            </TableCell>
          </>
        )}
      </TableRow>
    );
  }

  const groupedColCount = 4;
  const flatColCount = 6;

  const renderGroupedHeaders = () => (
    <>
      <TableHead className="w-10"></TableHead>
      <TableHead>Developer</TableHead>
      <TableHead>Apps</TableHead>
      <TableHead className="w-28 text-right">
        <button onClick={() => toggleSort("apps")} className="flex items-center gap-1 justify-end hover:text-foreground ml-auto">
          App Count <ArrowUpDown className="h-3 w-3" />
        </button>
      </TableHead>
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Developers</h1>
        <p className="text-sm text-muted-foreground">Browse all developers across platforms</p>
      </div>

      <DeveloperTopSection
        variant="tracked"
        items={visibleTrackedDevs.map((d) => ({
          id: d.id,
          slug: d.slug,
          name: d.name,
          platforms: d.platforms,
          platformCount: d.platformCount,
          totalApps: d.totalApps,
          isStarred: d.isStarred,
          apps: d.trackedApps,
        }))}
        loading={topLoading}
        emptyTitle="No tracked app developers yet"
        emptyDescription="Start tracking apps to see their developers here. You'll be able to monitor all the apps each developer builds across platforms."
        emptyCtaLabel="Browse Apps"
        emptyCtaHref="/overview"
        developerHref={(slug) => `/developers/${slug}`}
        storageKeyPrefix="developers"
        enabledPlatforms={enabledPlatforms}
      />

      <DeveloperTopSection
        variant="competitor"
        items={visibleCompetitorDevs.map((d) => ({
          id: d.id,
          slug: d.slug,
          name: d.name,
          platforms: d.platforms,
          platformCount: d.platformCount,
          totalApps: d.totalApps,
          isStarred: d.isStarred,
          apps: d.competitorApps,
        }))}
        loading={topLoading}
        emptyTitle="No competitor developers yet"
        emptyDescription="Add competitors to your tracked apps and their developers will appear here. Track what your competitors' developers are building."
        emptyCtaLabel="View Competitors"
        emptyCtaHref="/competitors"
        developerHref={(slug) => `/developers/${slug}`}
        storageKeyPrefix="developers"
        enabledPlatforms={enabledPlatforms}
      />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="flex gap-2 max-w-md flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search developers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">Search</Button>
          </form>
          <div className="ml-auto">
            <ViewModeToggle viewMode={viewMode} onChangeViewMode={changeViewMode} />
          </div>
        </div>
        {enabledPlatforms && enabledPlatforms.length > 1 && (
          <PlatformFilterChips
            enabledPlatforms={enabledPlatforms}
            activePlatforms={activePlatforms}
            onToggle={togglePlatform}
          />
        )}
      </div>

      {loading && !data ? (
        <TableSkeleton rows={10} cols={viewMode === "grouped" ? groupedColCount : flatColCount} />
      ) : viewMode === "grouped" ? (
        <PlatformGroupedTable
          groups={platformGroups}
          colCount={groupedColCount}
          renderHeaderRow={renderGroupedHeaders}
          renderRow={(dev) => renderDeveloperRow(dev)}
          entityLabel="developer"
          emptyMessage={emptyMessage}
        />
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table className="table-fixed min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                      Developer <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="w-72">Apps</TableHead>
                  <TableHead className="w-28 text-right">
                    <button onClick={() => toggleSort("apps")} className="flex items-center gap-1 justify-end hover:text-foreground ml-auto">
                      App Count <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="w-56">Platforms</TableHead>
                  <TableHead className="w-36 text-right">
                    <button onClick={() => toggleSort("platforms")} className="flex items-center gap-1 justify-end hover:text-foreground ml-auto">
                      Platform Count <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {developers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                ) : (
                  developers.map((dev) => renderDeveloperRow(dev))
                )}
              </TableBody>
            </Table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({enabledPlatforms.length > 0 ? developers.length : pagination.total} developers)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
