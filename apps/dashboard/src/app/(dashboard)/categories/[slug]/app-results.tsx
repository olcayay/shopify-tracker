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
import { useFormatDate } from "@/lib/format-date";
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
  name: string;
  slug: string;
  logo_url?: string;
  average_rating?: number;
  rating_count?: number;
  pricing_hint?: string;
  is_sponsored?: boolean;
  is_built_for_shopify?: boolean;
  launched_date?: string;
  source_categories?: { title: string; slug: string }[];
}

type SortKey = "position" | "name" | "average_rating" | "rating_count" | "min_paid" | "launched_date" | "reverse_similar";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "tracked_or_competitor";

const PAGE_SIZE = 24;

export function CategoryAppResults({
  apps,
  trackedSlugs,
  competitorSlugs,
  lastChanges,
  minPaidPrices,
  reverseSimilarCounts,
  isHubPage,
}: {
  apps: App[];
  trackedSlugs: string[];
  competitorSlugs: string[];
  lastChanges?: Record<string, string>;
  minPaidPrices?: Record<string, number | null>;
  reverseSimilarCounts?: Record<string, number>;
  isHubPage?: boolean;
}) {
  const { formatDateOnly } = useFormatDate();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(isHubPage ? "rating_count" : "position");
  const [sortDir, setSortDir] = useState<SortDir>(isHubPage ? "desc" : "asc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const trackedSet = useMemo(() => new Set(trackedSlugs), [trackedSlugs]);
  const competitorSet = useMemo(() => new Set(competitorSlugs), [competitorSlugs]);

  const filtered = useMemo(() => {
    let result = apps;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(q));
    }

    if (statusFilter === "tracked_or_competitor") {
      result = result.filter((a) => trackedSet.has(a.slug) || competitorSet.has(a.slug));
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "position":
          cmp = a.position - b.position;
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "average_rating":
          cmp = (a.average_rating ?? 0) - (b.average_rating ?? 0);
          break;
        case "rating_count":
          cmp = (a.rating_count ?? 0) - (b.rating_count ?? 0);
          break;
        case "min_paid": {
          const aPrice = minPaidPrices?.[a.slug] ?? Infinity;
          const bPrice = minPaidPrices?.[b.slug] ?? Infinity;
          cmp = (aPrice === null ? Infinity : aPrice) - (bPrice === null ? Infinity : bPrice);
          break;
        }
        case "launched_date": {
          const aDate = a.launched_date ? new Date(a.launched_date).getTime() : 0;
          const bDate = b.launched_date ? new Date(b.launched_date).getTime() : 0;
          cmp = aDate - bDate;
          break;
        }
        case "reverse_similar":
          cmp = (reverseSimilarCounts?.[a.slug] ?? 0) - (reverseSimilarCounts?.[b.slug] ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [apps, search, statusFilter, sortKey, sortDir, trackedSet, competitorSet, minPaidPrices, reverseSimilarCounts]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
      ? apps.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
      : apps;
    return {
      all: base.length,
      tracked_or_competitor: base.filter((a) => trackedSet.has(a.slug) || competitorSet.has(a.slug)).length,
    };
  }, [apps, search, trackedSet, competitorSet]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Apps ({filtered.length})</CardTitle>
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
        <div className="flex gap-1.5 pt-1">
          {(
            [
              ["all", "All"],
              ["tracked_or_competitor", "Tracked & Competitors"],
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
              {!isHubPage && (
                <TableHead
                  className="w-12 cursor-pointer select-none"
                  onClick={() => toggleSort("position")}
                >
                  # <SortIcon col="position" />
                </TableHead>
              )}
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("name")}
              >
                App <SortIcon col="name" />
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
              <TableHead>Pricing</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("min_paid")}
              >
                Min. Paid <SortIcon col="min_paid" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("reverse_similar")}
                title="Number of apps that list this app as similar"
              >
                Similar <SortIcon col="reverse_similar" />
              </TableHead>
              {isHubPage && <TableHead>Category</TableHead>}
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("launched_date")}
              >
                Launched <SortIcon col="launched_date" />
              </TableHead>
              <TableHead>Last Change</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center text-muted-foreground py-8"
                >
                  No apps found.
                </TableCell>
              </TableRow>
            ) : (
              paged.map((app) => {
                const isTracked = trackedSet.has(app.slug);
                const isCompetitor = competitorSet.has(app.slug);
                return (
                  <TableRow
                    key={app.slug}
                    className={
                      isTracked
                        ? "border-l-2 border-l-emerald-500 bg-emerald-500/10"
                        : isCompetitor
                          ? "border-l-2 border-l-amber-500 bg-amber-500/10"
                          : ""
                    }
                  >
                    {!isHubPage && (
                      <TableCell className="font-mono">{app.position}</TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {app.logo_url && (
                          <img src={app.logo_url} alt="" className="h-6 w-6 rounded shrink-0" />
                        )}
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/apps/${app.slug}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {app.name}
                          </Link>
                          {app.is_sponsored && (
                            <Badge variant="secondary" className="ml-1">
                              Ad
                            </Badge>
                          )}
                          {app.is_built_for_shopify && <span title="Built for Shopify">💎</span>}
                          {isTracked && (
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50">
                              Tracked
                            </Badge>
                          )}
                          {isCompetitor && (
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50">
                              Competitor
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{app.average_rating?.toFixed(1) ?? "\u2014"}</TableCell>
                    <TableCell>{app.rating_count?.toLocaleString() ?? "\u2014"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.pricing_hint || "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {minPaidPrices?.[app.slug] != null ? (
                        <Link href={`/apps/${app.slug}/details#pricing-plans`} className="text-primary hover:underline">
                          {minPaidPrices[app.slug] === 0
                            ? "Free"
                            : `$${minPaidPrices[app.slug]}/mo`}
                        </Link>
                      ) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {reverseSimilarCounts?.[app.slug] ?? "\u2014"}
                    </TableCell>
                    {isHubPage && (
                      <TableCell className="text-sm">
                        {app.source_categories?.length ? (
                          <div className="flex flex-col gap-0.5">
                            {app.source_categories.map((cat) => (
                              <Link
                                key={cat.slug}
                                href={`/categories/${cat.slug}`}
                                className="text-primary hover:underline"
                              >
                                {cat.title}
                              </Link>
                            ))}
                          </div>
                        ) : "\u2014"}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-muted-foreground">
                      {app.launched_date
                        ? formatDateOnly(app.launched_date)
                        : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lastChanges?.[app.slug]
                        ? formatDateOnly(lastChanges[app.slug])
                        : "\u2014"}
                    </TableCell>
                    <TableCell>
                      <StarAppButton
                        appSlug={app.slug}
                        initialStarred={competitorSet.has(app.slug)}
                        size="sm"
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

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
