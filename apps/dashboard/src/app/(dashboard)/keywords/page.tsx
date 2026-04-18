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
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { TableSkeleton } from "@/components/skeletons";
import { PlatformBadgeCell } from "@/components/platform-badge-cell";
import { PlatformFilterChips } from "@/components/platform-filter-chips";
import { ViewModeToggle, useViewMode } from "@/components/view-mode-toggle";
import { PlatformGroupedTable, type PlatformGroup } from "@/components/platform-grouped-table";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { PlatformId } from "@appranks/shared";
import { KeywordWordGroupFilter } from "@/components/keyword-word-group-filter";
import { extractWordGroups, filterKeywordsByWords } from "@/lib/keyword-word-groups";

interface TrackedApp {
  iconUrl: string | null;
  name: string;
  slug: string;
  platform: string;
}

interface KeywordItem {
  id: number;
  platform: string;
  keyword: string;
  slug: string;
  isActive: boolean;
  appCount: number;
  trackedApps: TrackedApp[];
  totalResults: number | null;
  createdAt: string;
}

interface KeywordResponse {
  items: KeywordItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function CrossPlatformKeywordsPage() {
  const { fetchWithAuth } = useAuth();
  const { accessiblePlatforms: enabledPlatforms } = usePlatformAccess();
  const [data, setData] = useState<KeywordResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("keyword");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [activePlatforms, setActivePlatforms] = useState<PlatformId[]>(enabledPlatforms);
  const [activeWordFilters, setActiveWordFilters] = useState<Set<string>>(new Set());
  const { viewMode, changeViewMode } = useViewMode("keywords-view-mode", () => setPage(1));
  const limit = viewMode === "grouped" ? 200 : 25;

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
      const res = await fetchWithAuth(`/api/cross-platform/keywords?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, page, search, sort, order, activePlatforms, enabledPlatforms.length, limit]);

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

  const allItems = data?.items ?? [];
  const pagination = data?.pagination;
  const emptyMessage = search ? "No keywords found matching your search." : "No tracked keywords.";

  // Common words grouping
  const wordGroups = useMemo(
    () => extractWordGroups(allItems.map((kw) => kw.keyword)),
    [allItems]
  );

  const items = useMemo(
    () => filterKeywordsByWords(allItems, activeWordFilters),
    [allItems, activeWordFilters]
  );

  const platformGroups = useMemo<PlatformGroup<KeywordItem>[]>(() => {
    if (viewMode !== "grouped") return [];
    const grouped = items.reduce<Record<string, KeywordItem[]>>((acc, item) => {
      (acc[item.platform] ??= []).push(item);
      return acc;
    }, {});
    return Object.entries(grouped)
      .sort(([a], [b]) => {
        const labelA = PLATFORM_DISPLAY[a as PlatformId]?.label ?? a;
        const labelB = PLATFORM_DISPLAY[b as PlatformId]?.label ?? b;
        return labelA.localeCompare(labelB);
      })
      .map(([platform, kws]) => ({ platform, items: kws }));
  }, [items, viewMode]);

  function renderKeywordRow(kw: KeywordItem, showPlatform: boolean) {
    const maxIcons = 5;
    const visibleApps = kw.trackedApps?.slice(0, maxIcons) ?? [];
    const remainingCount = kw.appCount - visibleApps.length;

    return (
      <TableRow key={kw.id}>
        {showPlatform && <TableCell><PlatformBadgeCell platform={kw.platform} /></TableCell>}
        <TableCell>
          <Link href={`/${kw.platform}/keywords/${kw.slug}`} className="font-medium hover:underline">
            {kw.keyword}
          </Link>
        </TableCell>
        <TableCell>
          {visibleApps.length > 0 ? (
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center -space-x-1.5">
                {visibleApps.map((app, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <Link
                        href={`/${app.platform}/apps/${app.slug}`}
                        className="shrink-0 rounded border border-background hover:z-10 hover:scale-110 transition-transform"
                      >
                        {app.iconUrl ? (
                          <img src={app.iconUrl} alt={app.name} className="w-6 h-6 rounded" />
                        ) : (
                          <span className="w-6 h-6 rounded bg-muted flex items-center justify-center text-[10px] font-medium">
                            {app.name.charAt(0)}
                          </span>
                        )}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">{app.name}</TooltipContent>
                  </Tooltip>
                ))}
                {remainingCount > 0 && (
                  <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium border border-background shrink-0">
                    +{remainingCount}
                  </span>
                )}
              </div>
            </TooltipProvider>
          ) : (
            <span className="text-muted-foreground text-sm">0</span>
          )}
        </TableCell>
        <TableCell>
          <span className={`text-xs px-1.5 py-0.5 rounded ${kw.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
            {kw.isActive ? "Active" : "Paused"}
          </span>
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {kw.totalResults != null ? kw.totalResults.toLocaleString() : "—"}
        </TableCell>
      </TableRow>
    );
  }

  const groupedColCount = 4;
  const flatColCount = 5;

  const renderGroupedHeaders = () => (
    <>
      <TableHead>
        <button onClick={() => toggleSort("keyword")} className="flex items-center gap-1 hover:text-foreground">
          Keyword <ArrowUpDown className="h-3 w-3" />
        </button>
      </TableHead>
      <TableHead>
        <button onClick={() => toggleSort("apps")} className="flex items-center gap-1 hover:text-foreground">
          Tracked Apps <ArrowUpDown className="h-3 w-3" />
        </button>
      </TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">
        <button onClick={() => toggleSort("totalResults")} className="flex items-center gap-1 justify-end hover:text-foreground ml-auto">
          Total Results <ArrowUpDown className="h-3 w-3" />
        </button>
      </TableHead>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Keywords</h1>
          <p className="text-sm text-muted-foreground">Tracked keywords across all platforms</p>
        </div>
        <ViewModeToggle viewMode={viewMode} onChangeViewMode={changeViewMode} />
      </div>

      <PlatformFilterChips
        enabledPlatforms={enabledPlatforms}
        activePlatforms={activePlatforms}
        onToggle={togglePlatform}
      />

      <form onSubmit={(e) => { e.preventDefault(); setPage(1); loadData(); }} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search keywords..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button type="submit" variant="outline" size="sm">Search</Button>
      </form>

      {wordGroups.length > 0 && (
        <KeywordWordGroupFilter
          wordGroups={wordGroups}
          activeWords={activeWordFilters}
          onToggle={(word) =>
            setActiveWordFilters((prev) => {
              const next = new Set(prev);
              if (next.has(word)) next.delete(word);
              else next.add(word);
              return next;
            })
          }
          onClear={() => setActiveWordFilters(new Set())}
        />
      )}

      {loading && !data ? (
        <TableSkeleton rows={10} cols={viewMode === "grouped" ? groupedColCount : flatColCount} />
      ) : viewMode === "grouped" ? (
        <PlatformGroupedTable
          groups={platformGroups}
          colCount={groupedColCount}
          renderHeaderRow={renderGroupedHeaders}
          renderRow={(kw) => renderKeywordRow(kw, false)}
          entityLabel="keyword"
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
                    <button onClick={() => toggleSort("keyword")} className="flex items-center gap-1 hover:text-foreground">
                      Keyword <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("apps")} className="flex items-center gap-1 hover:text-foreground">
                      Tracked Apps <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <button onClick={() => toggleSort("totalResults")} className="flex items-center gap-1 justify-end hover:text-foreground ml-auto">
                      Total Results <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((kw) => renderKeywordRow(kw, true))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {pagination && pagination.totalPages > 1 && viewMode !== "grouped" && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} keywords)
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
