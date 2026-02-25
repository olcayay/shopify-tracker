"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { TablePagination } from "@/components/pagination";

interface AppItem {
  slug: string;
  name: string;
  icon_url?: string | null;
  is_built_for_shopify?: boolean;
  average_rating?: number | string | null;
  rating_count?: number | string | null;
  pricing?: string | null;
}

type SortKey =
  | "name"
  | "average_rating"
  | "rating_count"
  | "min_paid"
  | "last_change"
  | "launched_date"
  | "cat_rank"
  | "similar"
  | "featured"
  | "ads";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "tracked_or_competitor";

const PAGE_SIZE = 24;

export function AppListTable({
  title,
  apps,
  trackedSlugs,
  competitorSlugs,
  lastChanges,
  minPaidPrices,
  launchedDates,
  appCategories,
  reverseSimilarCounts,
  featuredSectionCounts,
  adKeywordCounts,
}: {
  title: string;
  apps: AppItem[];
  trackedSlugs: string[];
  competitorSlugs: string[];
  lastChanges: Record<string, string>;
  minPaidPrices: Record<string, number | null>;
  launchedDates: Record<string, string | null>;
  appCategories: Record<string, { title: string; slug: string; position: number | null }[]>;
  reverseSimilarCounts: Record<string, number>;
  featuredSectionCounts: Record<string, number>;
  adKeywordCounts: Record<string, number>;
}) {
  const { formatDateOnly } = useFormatDate();
  const [sortKey, setSortKey] = useState<SortKey>("rating_count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const trackedSet = useMemo(() => new Set(trackedSlugs), [trackedSlugs]);
  const competitorSet = useMemo(() => new Set(competitorSlugs), [competitorSlugs]);

  function bestRank(slug: string): number {
    const cats = appCategories[slug];
    if (!cats?.length) return Infinity;
    let best = Infinity;
    for (const c of cats) {
      if (c.position != null && c.position < best) best = c.position;
    }
    return best;
  }

  const filtered = useMemo(() => {
    let result = apps;

    if (statusFilter === "tracked_or_competitor") {
      result = result.filter(
        (a) => trackedSet.has(a.slug) || competitorSet.has(a.slug)
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "average_rating":
          cmp = (Number(a.average_rating) || 0) - (Number(b.average_rating) || 0);
          break;
        case "rating_count":
          cmp = (Number(a.rating_count) || 0) - (Number(b.rating_count) || 0);
          break;
        case "min_paid": {
          const aP = minPaidPrices[a.slug] ?? Infinity;
          const bP = minPaidPrices[b.slug] ?? Infinity;
          cmp = (aP === null ? Infinity : aP) - (bP === null ? Infinity : bP);
          break;
        }
        case "last_change": {
          const aD = lastChanges[a.slug]
            ? new Date(lastChanges[a.slug]).getTime()
            : 0;
          const bD = lastChanges[b.slug]
            ? new Date(lastChanges[b.slug]).getTime()
            : 0;
          cmp = aD - bD;
          break;
        }
        case "launched_date": {
          const aD = launchedDates[a.slug]
            ? new Date(launchedDates[a.slug]!).getTime()
            : 0;
          const bD = launchedDates[b.slug]
            ? new Date(launchedDates[b.slug]!).getTime()
            : 0;
          cmp = aD - bD;
          break;
        }
        case "cat_rank":
          cmp = bestRank(a.slug) - bestRank(b.slug);
          break;
        case "similar":
          cmp = (reverseSimilarCounts[a.slug] ?? 0) - (reverseSimilarCounts[b.slug] ?? 0);
          break;
        case "featured":
          cmp = (featuredSectionCounts[a.slug] ?? 0) - (featuredSectionCounts[b.slug] ?? 0);
          break;
        case "ads":
          cmp = (adKeywordCounts[a.slug] ?? 0) - (adKeywordCounts[b.slug] ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [
    apps,
    statusFilter,
    sortKey,
    sortDir,
    trackedSet,
    competitorSet,
    minPaidPrices,
    lastChanges,
    launchedDates,
    appCategories,
    reverseSimilarCounts,
    featuredSectionCounts,
    adKeywordCounts,
  ]);

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
      setSortDir(key === "name" || key === "cat_rank" ? "asc" : "desc");
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
    return {
      all: apps.length,
      tracked_or_competitor: apps.filter(
        (a) => trackedSet.has(a.slug) || competitorSet.has(a.slug)
      ).length,
    };
  }, [apps, trackedSet, competitorSet]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>
            {title} ({filtered.length})
          </CardTitle>
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
                onClick={() => toggleSort("cat_rank")}
              >
                Cat. Rank <SortIcon col="cat_rank" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("similar")}
                title="Number of apps that list this app as similar"
              >
                Similar <SortIcon col="similar" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("featured")}
                title="Featured sections (last 30 days)"
              >
                Featured <SortIcon col="featured" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("ads")}
                title="Ad keywords (last 30 days)"
              >
                Ads <SortIcon col="ads" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("launched_date")}
              >
                Launched <SortIcon col="launched_date" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("last_change")}
              >
                Last Change <SortIcon col="last_change" />
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={12}
                  className="text-center text-muted-foreground py-8"
                >
                  No apps found.
                </TableCell>
              </TableRow>
            ) : (
              paged.map((app) => {
                const isTracked = trackedSet.has(app.slug);
                const isCompetitor = competitorSet.has(app.slug);
                const cats = appCategories[app.slug];
                const similarCount = reverseSimilarCounts[app.slug] ?? 0;
                const featuredCount = featuredSectionCounts[app.slug] ?? 0;
                const adsCount = adKeywordCounts[app.slug] ?? 0;
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {app.icon_url && (
                          <img
                            src={app.icon_url}
                            alt=""
                            className="h-6 w-6 rounded shrink-0"
                          />
                        )}
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/apps/${app.slug}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {app.name}
                          </Link>
                          {app.is_built_for_shopify && (
                            <span title="Built for Shopify">💎</span>
                          )}
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
                    <TableCell>
                      {app.average_rating != null
                        ? Number(app.average_rating).toFixed(1)
                        : "\u2014"}
                    </TableCell>
                    <TableCell>
                      {app.rating_count != null ? (
                        <Link
                          href={`/apps/${app.slug}#reviews`}
                          className="text-primary hover:underline"
                        >
                          {Number(app.rating_count).toLocaleString()}
                        </Link>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.pricing ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {minPaidPrices[app.slug] != null ? (
                        <Link
                          href={`/apps/${app.slug}/details#pricing-plans`}
                          className="text-primary hover:underline"
                        >
                          {minPaidPrices[app.slug] === 0
                            ? "Free"
                            : `$${minPaidPrices[app.slug]}/mo`}
                        </Link>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {cats?.length ? (
                        <div className="flex flex-col gap-0.5">
                          {cats.map((cat) => (
                            <div key={cat.slug} className="flex items-center gap-1">
                              {cat.position != null && (
                                <span className="font-medium text-muted-foreground">
                                  #{cat.position}
                                </span>
                              )}
                              <Link
                                href={`/categories/${cat.slug}`}
                                className="text-primary hover:underline"
                              >
                                {cat.title}
                              </Link>
                            </div>
                          ))}
                        </div>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {similarCount > 0 ? (
                        <Link
                          href={`/apps/${app.slug}/similar`}
                          className="text-primary hover:underline"
                        >
                          {similarCount}
                        </Link>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {featuredCount > 0 ? (
                        <Link
                          href={`/apps/${app.slug}/featured`}
                          className="text-primary hover:underline"
                        >
                          {featuredCount}
                        </Link>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {adsCount > 0 ? (
                        <Link
                          href={`/apps/${app.slug}/rankings`}
                          className="text-primary hover:underline"
                        >
                          {adsCount}
                        </Link>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {launchedDates[app.slug]
                        ? formatDateOnly(launchedDates[app.slug]!)
                        : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lastChanges[app.slug] ? (
                        <Link
                          href={`/apps/${app.slug}/details`}
                          className="text-primary hover:underline"
                        >
                          {formatDateOnly(lastChanges[app.slug])}
                        </Link>
                      ) : (
                        "\u2014"
                      )}
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

        <TablePagination
          currentPage={safePage}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </CardContent>
    </Card>
  );
}
