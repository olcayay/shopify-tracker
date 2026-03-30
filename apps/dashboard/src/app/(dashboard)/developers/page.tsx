"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Bookmark, LayoutList, Layers, ChevronDown } from "lucide-react";
import { TableSkeleton } from "@/components/skeletons";
import { PlatformBadgeCell } from "@/components/platform-badge-cell";
import { PlatformFilterChips } from "@/components/platform-filter-chips";
import { getPlatformLabel, getPlatformColor } from "@/lib/platform-display";
import type { PlatformId } from "@appranks/shared";

interface Developer {
  id: number;
  slug: string;
  name: string;
  website: string | null;
  platformCount: number;
  linkCount: number;
  platforms: string[];
  topAppIcons: string[];
  isStarred: boolean;
}

interface DeveloperResponse {
  developers: Developer[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

type ViewMode = "list" | "grouped";

function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "list";
  return (localStorage.getItem("developers-view-mode") as ViewMode) || "list";
}

export default function DevelopersPage() {
  const { fetchWithAuth, account } = useAuth();
  const enabledPlatforms = (account?.enabledPlatforms ?? []) as PlatformId[];
  const [data, setData] = useState<DeveloperResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [activePlatforms, setActivePlatforms] = useState<PlatformId[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode);
  const [collapsedPlatforms, setCollapsedPlatforms] = useState<Set<string>>(new Set());
  const limit = viewMode === "grouped" ? 200 : 25;

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem("developers-view-mode", mode);
    setPage(1);
  }

  function togglePlatform(pid: PlatformId) {
    setActivePlatforms((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid]
    );
    setPage(1);
  }

  function toggleCollapse(platform: string) {
    setCollapsedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
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

  async function toggleStar(devId: number, currentlyStarred: boolean) {
    if (!data) return;
    setData({
      ...data,
      developers: data.developers.map((d) =>
        d.id === devId ? { ...d, isStarred: !currentlyStarred } : d
      ),
    });
    try {
      const method = currentlyStarred ? "DELETE" : "POST";
      const res = await fetchWithAuth(`/api/account/starred-developers/${devId}`, { method });
      if (!res.ok) throw new Error();
    } catch {
      setData((prev) =>
        prev
          ? {
              ...prev,
              developers: prev.developers.map((d) =>
                d.id === devId ? { ...d, isStarred: currentlyStarred } : d
              ),
            }
          : prev
      );
    }
  }

  const developers = data?.developers ?? [];
  const pagination = data?.pagination;

  // Group developers by platform for grouped view
  const groupedByPlatform = useMemo(() => {
    if (viewMode !== "grouped") return new Map<string, Developer[]>();
    const map = new Map<string, Developer[]>();
    for (const dev of developers) {
      for (const p of dev.platforms) {
        const list = map.get(p) || [];
        list.push(dev);
        map.set(p, list);
      }
    }
    // Sort starred-first within each group
    for (const [key, devs] of map) {
      map.set(key, devs.sort((a, b) => (a.isStarred === b.isStarred ? 0 : a.isStarred ? -1 : 1)));
    }
    return map;
  }, [developers, viewMode]);

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
          <div className="flex items-center gap-2">
            {dev.topAppIcons && dev.topAppIcons.length > 0 && (
              <div className="flex -space-x-1.5 shrink-0">
                {dev.topAppIcons.slice(0, 4).map((url, i) => (
                  <img key={i} src={url} alt="" className="w-5 h-5 rounded border border-background" />
                ))}
                {dev.topAppIcons.length > 4 && (
                  <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium border border-background">
                    +{dev.topAppIcons.length - 4}
                  </span>
                )}
              </div>
            )}
            <Link href={`/developers/${dev.slug}`} className="font-medium hover:underline">
              {dev.name}
            </Link>
          </div>
        </TableCell>
        {viewMode === "list" && (
          <>
            <TableCell>
              <div className="flex flex-wrap gap-1.5">
                {dev.platforms.map((p) => (
                  <PlatformBadgeCell key={p} platform={p} />
                ))}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{dev.platformCount}</TableCell>
          </>
        )}
      </TableRow>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Developers</h1>
          <p className="text-sm text-muted-foreground">Browse all developers across platforms</p>
        </div>
        <div className="flex gap-1 border rounded-md p-0.5">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => changeViewMode("list")}
            className="h-7 px-2"
            aria-label="List view"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grouped" ? "default" : "ghost"}
            size="sm"
            onClick={() => changeViewMode("grouped")}
            className="h-7 px-2"
            aria-label="Grouped view"
          >
            <Layers className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
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
        {enabledPlatforms && enabledPlatforms.length > 1 && (
          <PlatformFilterChips
            enabledPlatforms={enabledPlatforms}
            activePlatforms={activePlatforms}
            onToggle={togglePlatform}
          />
        )}
      </div>

      {loading && !data ? (
        <TableSkeleton rows={10} cols={4} />
      ) : viewMode === "grouped" ? (
        /* Grouped view */
        <div className="space-y-4">
          {groupedByPlatform.size === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {search ? "No developers found matching your search." : "No developers found."}
            </p>
          ) : (
            Array.from(groupedByPlatform.entries()).map(([platform, devs]) => {
              const isCollapsed = collapsedPlatforms.has(platform);
              return (
                <div key={platform} className="rounded-md border">
                  <button
                    onClick={() => toggleCollapse(platform)}
                    className="flex items-center gap-2 w-full p-3 hover:bg-muted/50 transition-colors"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: getPlatformColor(platform) }}
                    />
                    <span className="font-medium">{getPlatformLabel(platform)}</span>
                    <Badge variant="secondary">{devs.length}</Badge>
                  </button>
                  {!isCollapsed && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Developer</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {devs.map((dev) => renderDeveloperRow(dev))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* List view */
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                      Developer <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Platforms</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("platforms")} className="flex items-center gap-1 hover:text-foreground">
                      Platform Count <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {developers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      {search ? "No developers found matching your search." : "No developers found."}
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
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} developers)
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
