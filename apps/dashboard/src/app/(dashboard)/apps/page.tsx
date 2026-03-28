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
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Star } from "lucide-react";
import { TableSkeleton } from "@/components/skeletons";
import { PlatformBadgeCell } from "@/components/platform-badge-cell";
import { PlatformFilterChips } from "@/components/platform-filter-chips";
import type { PlatformId } from "@appranks/shared";

interface AppItem {
  id: number;
  platform: string;
  slug: string;
  name: string;
  iconUrl: string | null;
  averageRating: number | null;
  ratingCount: number | null;
  pricingHint: string | null;
  isTracked: boolean;
  isCompetitor: boolean;
  activeInstalls: number | null;
}

interface AppResponse {
  items: AppItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

type StatusFilter = "all" | "tracked" | "competitor";

export default function CrossPlatformAppsPage() {
  const { fetchWithAuth, account } = useAuth();
  const enabledPlatforms = (account?.enabledPlatforms ?? []) as PlatformId[];
  const [data, setData] = useState<AppResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [activePlatforms, setActivePlatforms] = useState<PlatformId[]>(enabledPlatforms);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const limit = 25;

  // Sync activePlatforms when enabledPlatforms loads
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
      const res = await fetchWithAuth(`/api/cross-platform/apps?${params}`);
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
    if (sort === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setOrder("asc");
    }
    setPage(1);
  }

  const items = data?.items ?? [];
  const filtered = statusFilter === "all" ? items
    : statusFilter === "tracked" ? items.filter((a) => a.isTracked)
    : items.filter((a) => a.isCompetitor);
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Apps</h1>
        <p className="text-sm text-muted-foreground">Tracked and competitor apps across all platforms</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <PlatformFilterChips
          enabledPlatforms={enabledPlatforms}
          activePlatforms={activePlatforms}
          onToggle={togglePlatform}
        />
        <div className="flex gap-1.5">
          {(["all", "tracked", "competitor"] as StatusFilter[]).map((f) => (
            <Button
              key={f}
              variant={statusFilter === f ? "default" : "outline"}
              size="sm"
              onClick={() => { setStatusFilter(f); setPage(1); }}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setPage(1); loadData(); }} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search apps..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button type="submit" variant="outline" size="sm">Search</Button>
      </form>

      {loading && !data ? (
        <TableSkeleton rows={10} cols={5} />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                      App <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Type</TableHead>
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
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No apps found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell><PlatformBadgeCell platform={app.platform} /></TableCell>
                      <TableCell>
                        <Link href={`/${app.platform}/apps/${app.slug}`} className="flex items-center gap-2 font-medium hover:underline">
                          {app.iconUrl && (
                            <img src={app.iconUrl} alt="" className="w-6 h-6 rounded" />
                          )}
                          {app.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${app.isTracked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {app.isTracked ? "Tracked" : "Competitor"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {app.averageRating != null ? (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                            {app.averageRating.toFixed(1)}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{app.ratingCount ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{app.pricingHint || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} apps)
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
        </>
      )}
    </div>
  );
}
