"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { StarAppButton } from "@/components/star-app-button";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface App {
  position: number;
  app_slug: string;
  app_name: string;
  short_description: string;
  average_rating: number;
  rating_count: number;
  app_url: string;
  is_sponsored: boolean;
  is_built_in: boolean;
  is_built_for_shopify?: boolean;
}

type SortKey = "position" | "app_name" | "average_rating" | "rating_count";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "tracked" | "competitor";

const PAGE_SIZE = 24;

export function KeywordAppResults({
  apps,
  trackedSlugs,
  competitorSlugs,
  positionChanges,
}: {
  apps: App[];
  trackedSlugs: string[];
  competitorSlugs: string[];
  positionChanges?: Record<string, number> | null;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const trackedSet = useMemo(() => new Set(trackedSlugs), [trackedSlugs]);
  const competitorSet = useMemo(
    () => new Set(competitorSlugs),
    [competitorSlugs]
  );

  const filtered = useMemo(() => {
    let result = apps;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.app_name.toLowerCase().includes(q) ||
          a.short_description.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter === "tracked") {
      result = result.filter((a) => trackedSet.has(a.app_slug));
    } else if (statusFilter === "competitor") {
      result = result.filter((a) => competitorSet.has(a.app_slug));
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "position":
          cmp = a.position - b.position;
          break;
        case "app_name":
          cmp = a.app_name.localeCompare(b.app_name);
          break;
        case "average_rating":
          cmp = (a.average_rating ?? 0) - (b.average_rating ?? 0);
          break;
        case "rating_count":
          cmp = (a.rating_count ?? 0) - (b.rating_count ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [apps, search, statusFilter, sortKey, sortDir, trackedSet, competitorSet]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "position" ? "asc" : "desc");
    }
    setPage(1);
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col)
      return <ArrowUpDown className="inline h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="inline h-3.5 w-3.5 ml-1" />
    ) : (
      <ArrowDown className="inline h-3.5 w-3.5 ml-1" />
    );
  }

  const statusCounts = useMemo(() => {
    const base = search.trim()
      ? apps.filter((a) => {
          const q = search.toLowerCase();
          return (
            a.app_name.toLowerCase().includes(q) ||
            a.short_description.toLowerCase().includes(q)
          );
        })
      : apps;
    return {
      all: base.length,
      tracked: base.filter((a) => trackedSet.has(a.app_slug)).length,
      competitor: base.filter((a) => competitorSet.has(a.app_slug)).length,
    };
  }, [apps, search, trackedSet, competitorSet]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Organic Results ({filtered.length})</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search apps..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9"
            />
          </div>
        </div>
        {/* Status filter */}
        <div className="flex gap-1.5 pt-1">
          {(
            [
              ["all", "All"],
              ["tracked", "Tracked"],
              ["competitor", "Competitor"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={statusFilter === key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setStatusFilter(key);
                setPage(1);
              }}
            >
              {label}
              {statusCounts[key] > 0 && (
                <span className="ml-1 opacity-70">({statusCounts[key]})</span>
              )}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="w-12 cursor-pointer select-none"
                onClick={() => toggleSort("position")}
              >
                # <SortIcon col="position" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("app_name")}
              >
                App <SortIcon col="app_name" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("average_rating")}
              >
                Rating <SortIcon col="average_rating" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("rating_count")}
              >
                Reviews <SortIcon col="rating_count" />
              </TableHead>
              <TableHead className="w-16">Change</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  No apps found.
                </TableCell>
              </TableRow>
            ) : (
              paged.map((app) => {
                const isTracked = trackedSet.has(app.app_slug);
                const isCompetitor = competitorSet.has(app.app_slug);
                return (
                  <TableRow
                    key={app.app_slug}
                    className={
                      isTracked
                        ? "border-l-2 border-l-emerald-500 bg-emerald-500/10"
                        : isCompetitor
                          ? "border-l-2 border-l-amber-500 bg-amber-500/10"
                          : ""
                    }
                  >
                    <TableCell className="font-mono">{app.position}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/apps/${app.app_slug}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {app.app_name}
                        </Link>
                        {app.is_built_for_shopify && (
                          <span title="Built for Shopify">💎</span>
                        )}
                        {isTracked && (
                          <Badge
                            className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50"
                          >
                            Tracked
                          </Badge>
                        )}
                        {isCompetitor && (
                          <Badge
                            className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50"
                          >
                            Competitor
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {app.short_description}
                      </p>
                    </TableCell>
                    <TableCell>
                      {app.average_rating?.toFixed(1) ?? "\u2014"}
                    </TableCell>
                    <TableCell>
                      {app.rating_count?.toLocaleString() ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-center">
                      {positionChanges?.[app.app_slug] !== undefined && positionChanges[app.app_slug] !== 0 ? (
                        <span className={positionChanges[app.app_slug] > 0 ? "text-green-600" : "text-red-500"}>
                          {positionChanges[app.app_slug] > 0 ? `+${positionChanges[app.app_slug]}` : positionChanges[app.app_slug]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{"\u2014"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StarAppButton
                        appSlug={app.app_slug}
                        initialStarred={competitorSet.has(app.app_slug)}
                        size="sm"
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE + 1}&ndash;
              {Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === safePage ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
