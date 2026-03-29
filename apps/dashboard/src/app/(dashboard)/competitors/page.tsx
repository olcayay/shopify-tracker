"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
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
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Star, LayoutList, Group } from "lucide-react";
import { TableSkeleton } from "@/components/skeletons";
import { PlatformBadgeCell } from "@/components/platform-badge-cell";
import { PlatformFilterChips } from "@/components/platform-filter-chips";
import { PLATFORM_DISPLAY, getPlatformColor } from "@/lib/platform-display";
import type { PlatformId } from "@appranks/shared";

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
  activeInstalls: number | null;
}

interface CompetitorResponse {
  items: CompetitorItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function CrossPlatformCompetitorsPage() {
  const { fetchWithAuth, account } = useAuth();
  const enabledPlatforms = (account?.enabledPlatforms ?? []) as PlatformId[];
  const [data, setData] = useState<CompetitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [activePlatforms, setActivePlatforms] = useState<PlatformId[]>(enabledPlatforms);
  const [groupByPlatform, setGroupByPlatform] = useState(false);
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
      if (activePlatforms.length > 0 && activePlatforms.length < enabledPlatforms.length) {
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

  // Group items by platform for grouped view
  const groupedItems = groupByPlatform
    ? items.reduce<Record<string, CompetitorItem[]>>((acc, item) => {
        (acc[item.platform] ??= []).push(item);
        return acc;
      }, {})
    : {};
  const platformGroups = Object.entries(groupedItems).sort(([a], [b]) => {
    const labelA = PLATFORM_DISPLAY[a as PlatformId]?.label ?? a;
    const labelB = PLATFORM_DISPLAY[b as PlatformId]?.label ?? b;
    return labelA.localeCompare(labelB);
  });

  function renderCompetitorRow(comp: CompetitorItem, showPlatform: boolean) {
    return (
      <TableRow key={comp.id}>
        {showPlatform && (
          <TableCell><PlatformBadgeCell platform={comp.platform} /></TableCell>
        )}
        <TableCell>
          <Link href={`/${comp.platform}/apps/${comp.slug}`} className="flex items-center gap-2 font-medium hover:underline">
            {comp.iconUrl && (
              <img src={comp.iconUrl} alt="" className="w-6 h-6 rounded" />
            )}
            {comp.name}
          </Link>
        </TableCell>
        <TableCell>
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {comp.trackedForCount} app{comp.trackedForCount !== 1 ? "s" : ""}
          </span>
        </TableCell>
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
      </TableRow>
    );
  }

  const colCount = groupByPlatform ? 5 : 6;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Competitors</h1>
          <p className="text-sm text-muted-foreground">Competitor apps tracked across all platforms</p>
        </div>
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button
            variant={groupByPlatform ? "ghost" : "secondary"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setGroupByPlatform(false)}
            title="Flat list"
          >
            <LayoutList className="h-3.5 w-3.5 mr-1" />
            List
          </Button>
          <Button
            variant={groupByPlatform ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setGroupByPlatform(true)}
            title="Group by platform"
          >
            <Group className="h-3.5 w-3.5 mr-1" />
            By Platform
          </Button>
        </div>
      </div>

      <PlatformFilterChips
        enabledPlatforms={enabledPlatforms}
        activePlatforms={activePlatforms}
        onToggle={togglePlatform}
      />

      <form onSubmit={(e) => { e.preventDefault(); setPage(1); loadData(); }} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search competitors..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button type="submit" variant="outline" size="sm">Search</Button>
      </form>

      {loading && !data ? (
        <TableSkeleton rows={10} cols={colCount} />
      ) : groupByPlatform ? (
        /* ── Grouped by platform view ── */
        items.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 border rounded-md">
            {search ? "No competitors found matching your search." : "No competitors tracked."}
          </div>
        ) : (
          <div className="space-y-6">
            {platformGroups.map(([platform, platformItems]) => {
              const color = getPlatformColor(platform as PlatformId);
              const label = PLATFORM_DISPLAY[platform as PlatformId]?.label ?? platform;
              return (
                <div key={platform} className="rounded-md border overflow-hidden">
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 border-b"
                    style={{ borderLeftWidth: 3, borderLeftColor: color }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-semibold text-sm">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      ({platformItems.length} competitor{platformItems.length !== 1 ? "s" : ""})
                    </span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
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
                      {platformItems.map((comp) => renderCompetitorRow(comp, false))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ── Flat list view ── */
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
                      {search ? "No competitors found matching your search." : "No competitors tracked."}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((comp) => renderCompetitorRow(comp, true))
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
