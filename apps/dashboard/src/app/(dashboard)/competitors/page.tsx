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
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Star, LayoutList, Group, AppWindow, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import { TableSkeleton } from "@/components/skeletons";
import { GlobalAppSearch } from "@/components/global-app-search";
import { PlatformBadgeCell } from "@/components/platform-badge-cell";
import { PlatformFilterChips } from "@/components/platform-filter-chips";
import { PlatformGroupedTable, type PlatformGroup } from "@/components/platform-grouped-table";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import type { PlatformId } from "@appranks/shared";

interface TrackedForApp {
  id: number;
  name: string;
  iconUrl: string | null;
  slug: string;
  platform: string;
}

interface CompetitorItem {
  id: number;
  platform: string;
  slug: string;
  name: string;
  iconUrl: string | null;
  averageRating: number | null;
  ratingCount: number | null;
  pricingHint: string | null;
  trackedForCount: number;
  trackedForApps: TrackedForApp[];
  activeInstalls: number | null;
}

interface CompetitorResponse {
  items: CompetitorItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// --- Local view mode for competitors (3 modes instead of shared 2) ---

type CompetitorsViewMode = "list" | "grouped" | "by-app";

function readCompetitorsViewMode(key: string): CompetitorsViewMode {
  if (typeof window === "undefined") return "list";
  const stored = localStorage.getItem(key);
  if (stored === "grouped" || stored === "by-app") return stored;
  return "list";
}

function useCompetitorsViewMode(storageKey: string, onChange?: () => void) {
  const [viewMode, setViewMode] = useState<CompetitorsViewMode>(() =>
    readCompetitorsViewMode(storageKey)
  );

  useEffect(() => {
    setViewMode(readCompetitorsViewMode(storageKey));
  }, [storageKey]);

  const changeViewMode = useCallback(
    (mode: CompetitorsViewMode) => {
      setViewMode(mode);
      localStorage.setItem(storageKey, mode);
      onChange?.();
    },
    [storageKey, onChange],
  );

  return { viewMode, changeViewMode } as const;
}

function CompetitorsViewModeToggle({
  viewMode,
  onChangeViewMode,
}: {
  viewMode: CompetitorsViewMode;
  onChangeViewMode: (mode: CompetitorsViewMode) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5">
      <Button
        variant={viewMode === "list" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => onChangeViewMode("list")}
        title="Flat list"
      >
        <LayoutList className="h-3.5 w-3.5 mr-1" />
        List
      </Button>
      <Button
        variant={viewMode === "grouped" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => onChangeViewMode("grouped")}
        title="Group by platform"
      >
        <Group className="h-3.5 w-3.5 mr-1" />
        By Platform
      </Button>
      <Button
        variant={viewMode === "by-app" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => onChangeViewMode("by-app")}
        title="Group by tracked app"
      >
        <AppWindow className="h-3.5 w-3.5 mr-1" />
        By App
      </Button>
    </div>
  );
}

// --- App group type and rendering ---

interface AppGroup {
  appId: number;
  appName: string;
  appIconUrl: string | null;
  appSlug: string;
  appPlatform: string;
  items: CompetitorItem[];
}

export function groupCompetitorsByApp(items: CompetitorItem[]): AppGroup[] {
  const groupMap = new Map<number, AppGroup>();

  for (const comp of items) {
    if (!comp.trackedForApps || comp.trackedForApps.length === 0) {
      // Competitors without trackedForApps go into an "Unknown" group
      const unknownKey = -1;
      if (!groupMap.has(unknownKey)) {
        groupMap.set(unknownKey, {
          appId: unknownKey,
          appName: "Other",
          appIconUrl: null,
          appSlug: "",
          appPlatform: "",
          items: [],
        });
      }
      groupMap.get(unknownKey)!.items.push(comp);
      continue;
    }

    for (const app of comp.trackedForApps) {
      if (!groupMap.has(app.id)) {
        groupMap.set(app.id, {
          appId: app.id,
          appName: app.name,
          appIconUrl: app.iconUrl,
          appSlug: app.slug,
          appPlatform: app.platform,
          items: [],
        });
      }
      groupMap.get(app.id)!.items.push(comp);
    }
  }

  return [...groupMap.values()].sort((a, b) => a.appName.localeCompare(b.appName));
}

function AppGroupedTable({
  groups,
  renderRow,
  renderHeaderRow,
  colCount,
  emptyMessage,
}: {
  groups: AppGroup[];
  renderRow: (item: CompetitorItem) => React.ReactNode;
  renderHeaderRow: () => React.ReactNode;
  colCount: number;
  emptyMessage: string;
}) {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

  if (totalItems === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 border rounded-md">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>{renderHeaderRow()}</TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group, groupIndex) => {
            const isCollapsed = collapsed[group.appId] ?? false;
            const ChevronIcon = isCollapsed ? ChevronRightIcon : ChevronDown;
            const plural = group.items.length !== 1 ? "competitors" : "competitor";

            return (
              <AppGroupRows
                key={group.appId}
                group={group}
                colCount={colCount}
                isCollapsed={isCollapsed}
                isFirst={groupIndex === 0}
                chevronIcon={ChevronIcon}
                plural={plural}
                onToggle={() =>
                  setCollapsed((prev) => ({
                    ...prev,
                    [group.appId]: !prev[group.appId],
                  }))
                }
                renderRow={renderRow}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function AppGroupRows({
  group,
  colCount,
  isCollapsed,
  isFirst,
  chevronIcon: ChevronIcon,
  plural,
  onToggle,
  renderRow,
}: {
  group: AppGroup;
  colCount: number;
  isCollapsed: boolean;
  isFirst: boolean;
  chevronIcon: React.ElementType;
  plural: string;
  onToggle: () => void;
  renderRow: (item: CompetitorItem) => React.ReactNode;
}) {
  return (
    <>
      {!isFirst && (
        <tr>
          <td colSpan={colCount} className="h-2 bg-muted/20 border-t border-border" />
        </tr>
      )}
      <TableRow
        className="bg-muted/50 hover:bg-muted/70 cursor-pointer border-b"
        onClick={onToggle}
        data-testid={`app-group-${group.appId}`}
      >
        <TableCell colSpan={colCount} className="px-4 py-3">
          <div className="flex items-center gap-2">
            <ChevronIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            {group.appIconUrl ? (
              <img src={group.appIconUrl} alt="" aria-hidden="true" className="w-5 h-5 rounded shrink-0" />
            ) : (
              <AppWindow className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <span className="font-semibold text-sm">
              {group.appName}
            </span>
            {group.appPlatform && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {PLATFORM_DISPLAY[group.appPlatform as PlatformId]?.shortLabel ?? group.appPlatform}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              ({group.items.length} {plural})
            </span>
          </div>
        </TableCell>
      </TableRow>
      {!isCollapsed && group.items.map((item) => renderRow(item))}
    </>
  );
}

// --- Main page ---

export default function CrossPlatformCompetitorsPage() {
  const { fetchWithAuth } = useAuth();
  const { accessiblePlatforms: enabledPlatforms } = usePlatformAccess();
  const [data, setData] = useState<CompetitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [activePlatforms, setActivePlatforms] = useState<PlatformId[]>(enabledPlatforms);
  const { viewMode, changeViewMode } = useCompetitorsViewMode("competitors-view-mode", () => setPage(1));
  const limit = 25;

  useEffect(() => {
    if (enabledPlatforms.length > 0 && activePlatforms.length === 0) {
      setActivePlatforms(enabledPlatforms);
    }
  }, [enabledPlatforms, activePlatforms.length]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), sort, order });
      if (search) params.set("search", search);
      if (activePlatforms.length > 0) {
        params.set("platforms", activePlatforms.join(","));
      }
      const res = await fetchWithAuth(`/api/cross-platform/competitors?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, page, search, sort, order, activePlatforms, enabledPlatforms.length]);

  useEffect(() => { loadData(); }, [loadData]);

  function togglePlatform(platform: PlatformId) {
    setActivePlatforms((prev) => {
      if (prev.includes(platform)) {
        const next = prev.filter((p) => p !== platform);
        return next.length === 0 ? enabledPlatforms : next;
      }
      return [...prev, platform];
    });
    setPage(1);
  }

  function toggleSort(field: string) {
    if (sort === field) setOrder(order === "asc" ? "desc" : "asc");
    else { setSort(field); setOrder("asc"); }
    setPage(1);
  }

  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const emptyMessage = search ? "No competitors found matching your search." : "No competitors tracked.";

  const platformGroups = useMemo<PlatformGroup<CompetitorItem>[]>(() => {
    if (viewMode !== "grouped") return [];
    const grouped = items.reduce<Record<string, CompetitorItem[]>>((acc, item) => {
      (acc[item.platform] ??= []).push(item);
      return acc;
    }, {});
    return Object.entries(grouped)
      .sort(([a], [b]) => {
        const labelA = PLATFORM_DISPLAY[a as PlatformId]?.label ?? a;
        const labelB = PLATFORM_DISPLAY[b as PlatformId]?.label ?? b;
        return labelA.localeCompare(labelB);
      })
      .map(([platform, comps]) => ({ platform, items: comps }));
  }, [items, viewMode]);

  const appGroups = useMemo<AppGroup[]>(() => {
    if (viewMode !== "by-app") return [];
    return groupCompetitorsByApp(items);
  }, [items, viewMode]);

  function renderTrackedForCell(comp: CompetitorItem) {
    if (comp.trackedForApps && comp.trackedForApps.length > 0) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {comp.trackedForApps.map((app) => (
            <Link
              key={app.id}
              href={`/${app.platform}/apps/${app.slug}`}
              className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 transition-colors"
              title={app.name}
            >
              {app.iconUrl && (
                <img src={app.iconUrl} alt="" aria-hidden="true" className="w-4 h-4 rounded shrink-0" />
              )}
              <span className="truncate max-w-[120px]">{app.name}</span>
            </Link>
          ))}
        </div>
      );
    }
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
        {comp.trackedForCount} app{comp.trackedForCount !== 1 ? "s" : ""}
      </span>
    );
  }

  function renderRatingCells(comp: CompetitorItem) {
    return (
      <>
        <TableCell>
          {comp.averageRating != null ? (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
              {comp.averageRating.toFixed(1)}
            </span>
          ) : "—"}
        </TableCell>
        <TableCell className="text-muted-foreground">{comp.ratingCount ?? "—"}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{comp.pricingHint || "—"}</TableCell>
      </>
    );
  }

  function renderFlatRow(comp: CompetitorItem) {
    return (
      <TableRow key={comp.id}>
        <TableCell><PlatformBadgeCell platform={comp.platform} /></TableCell>
        <TableCell>
          <Link href={`/${comp.platform}/apps/${comp.slug}`} className="flex items-center gap-2 font-medium hover:underline">
            {comp.iconUrl && <img src={comp.iconUrl} alt="" aria-hidden="true" className="w-6 h-6 rounded" />}
            {comp.name}
          </Link>
        </TableCell>
        <TableCell>{renderTrackedForCell(comp)}</TableCell>
        {renderRatingCells(comp)}
      </TableRow>
    );
  }

  function renderGroupedRow(comp: CompetitorItem) {
    return (
      <TableRow key={comp.id}>
        <TableCell>
          <Link href={`/${comp.platform}/apps/${comp.slug}`} className="flex items-center gap-2 font-medium hover:underline">
            {comp.iconUrl && <img src={comp.iconUrl} alt="" aria-hidden="true" className="w-6 h-6 rounded" />}
            {comp.name}
          </Link>
        </TableCell>
        <TableCell>{renderTrackedForCell(comp)}</TableCell>
        {renderRatingCells(comp)}
      </TableRow>
    );
  }

  function renderByAppRow(comp: CompetitorItem) {
    return (
      <TableRow key={comp.id}>
        <TableCell>
          <Link href={`/${comp.platform}/apps/${comp.slug}`} className="flex items-center gap-2 font-medium hover:underline">
            {comp.iconUrl && <img src={comp.iconUrl} alt="" aria-hidden="true" className="w-6 h-6 rounded" />}
            {comp.name}
          </Link>
        </TableCell>
        <TableCell><PlatformBadgeCell platform={comp.platform} /></TableCell>
        {renderRatingCells(comp)}
      </TableRow>
    );
  }

  const groupedColCount = 5;
  const flatColCount = 6;
  const byAppColCount = 5; // No "Tracked For" column, but has Platform column

  const renderGroupedHeaders = () => (
    <>
      <TableHead>
        <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground">
          Competitor <ArrowUpDown className="h-3 w-3" />
        </button>
      </TableHead>
      <TableHead>Tracked For</TableHead>
      <TableHead>
        <button onClick={() => toggleSort("rating")} className="flex items-center gap-1 hover:text-foreground">
          Rating <ArrowUpDown className="h-3 w-3" />
        </button>
      </TableHead>
      <TableHead>
        <button onClick={() => toggleSort("reviews")} className="flex items-center gap-1 hover:text-foreground">
          Reviews <ArrowUpDown className="h-3 w-3" />
        </button>
      </TableHead>
      <TableHead>Pricing</TableHead>
    </>
  );

  const renderByAppHeaders = () => (
    <>
      <TableHead>
        <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground">
          Competitor <ArrowUpDown className="h-3 w-3" />
        </button>
      </TableHead>
      <TableHead>Platform</TableHead>
      <TableHead>
        <button onClick={() => toggleSort("rating")} className="flex items-center gap-1 hover:text-foreground">
          Rating <ArrowUpDown className="h-3 w-3" />
        </button>
      </TableHead>
      <TableHead>
        <button onClick={() => toggleSort("reviews")} className="flex items-center gap-1 hover:text-foreground">
          Reviews <ArrowUpDown className="h-3 w-3" />
        </button>
      </TableHead>
      <TableHead>Pricing</TableHead>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Competitors</h1>
          <p className="text-sm text-muted-foreground">Competitor apps tracked across all platforms</p>
        </div>
        <CompetitorsViewModeToggle viewMode={viewMode} onChangeViewMode={changeViewMode} />
      </div>

      <PlatformFilterChips
        enabledPlatforms={enabledPlatforms}
        activePlatforms={activePlatforms}
        onToggle={togglePlatform}
      />

      <div className="flex gap-4 items-start flex-wrap">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); loadData(); }} className="flex gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Filter competitors..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button type="submit" variant="outline" size="sm">Filter</Button>
        </form>
        <GlobalAppSearch
          mode="track"
          trackedSlugs={new Set((data?.items ?? []).map((c: any) => c.slug))}
          onAction={() => loadData()}
          placeholder="Discover & track new apps..."
          className="w-full sm:w-72"
        />
      </div>

      {loading && !data ? (
        <TableSkeleton rows={10} cols={viewMode === "list" ? flatColCount : viewMode === "grouped" ? groupedColCount : byAppColCount} />
      ) : viewMode === "grouped" ? (
        <PlatformGroupedTable
          groups={platformGroups}
          colCount={groupedColCount}
          renderHeaderRow={renderGroupedHeaders}
          renderRow={(comp) => renderGroupedRow(comp)}
          entityLabel="competitor"
          emptyMessage={emptyMessage}
        />
      ) : viewMode === "by-app" ? (
        <AppGroupedTable
          groups={appGroups}
          colCount={byAppColCount}
          renderHeaderRow={renderByAppHeaders}
          renderRow={(comp) => renderByAppRow(comp)}
          emptyMessage={emptyMessage}
        />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                      Competitor <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Tracked For</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("rating")} className="flex items-center gap-1 hover:text-foreground">
                      Rating <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("reviews")} className="flex items-center gap-1 hover:text-foreground">
                      Reviews <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Pricing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((comp) => renderFlatRow(comp))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} competitors)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
