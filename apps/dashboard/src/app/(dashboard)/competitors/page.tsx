"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFormatDate } from "@/lib/format-date";
import { TableSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { X, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Settings2, Check } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { ConfirmModal } from "@/components/confirm-modal";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";
import { AppSearchBar } from "@/components/app-search-bar";
import { VelocityCell } from "@/components/velocity-cell";
import { MomentumBadge } from "@/components/momentum-badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type SortKey =
  | "name"
  | "similarity"
  | "rating"
  | "reviews"
  | "v7d"
  | "v30d"
  | "v90d"
  | "momentum"
  | "pricing"
  | "minPaidPrice"
  | "rankedKeywords"
  | "adKeywords"
  | "featured"
  | "similar"
  | "lastChangeAt"
  | "launchedDate"
  | "catRank";
type SortDir = "asc" | "desc";

const TOGGLEABLE_COLUMNS: { key: string; label: string; tip?: string }[] = [
  { key: "similarity", label: "Similarity", tip: "Similarity score based on categories, features, keywords, and text" },
  { key: "rating", label: "Rating" },
  { key: "reviews", label: "Reviews" },
  { key: "v7d", label: "R7d", tip: "Reviews received in the last 7 days" },
  { key: "v30d", label: "R30d", tip: "Reviews received in the last 30 days" },
  { key: "v90d", label: "R90d", tip: "Reviews received in the last 90 days" },
  { key: "momentum", label: "Momentum", tip: "Review growth trend: compares recent vs longer-term pace" },
  { key: "pricing", label: "Pricing" },
  { key: "minPaidPrice", label: "Min. Paid", tip: "Lowest paid plan price per month" },
  { key: "launchedDate", label: "Launched" },
  { key: "featured", label: "Featured", tip: "Number of featured sections this app appears in" },
  { key: "adKeywords", label: "Ads", tip: "Number of keywords this app is running ads for" },
  { key: "rankedKeywords", label: "Ranked", tip: "Number of keywords this app ranks for in search results" },
  { key: "similar", label: "Similar", tip: "Number of other apps that list this app as similar" },
  { key: "catRank", label: "Category Rank", tip: "Average category ranking across all categories" },
  { key: "lastChangeAt", label: "Last Change", tip: "Date of the most recent detected change in app listing" },
];

const STORAGE_KEY = "global-competitors-columns";

export default function CompetitorsPage() {
  const { fetchWithAuth, user, account, refreshUser } = useAuth();
  const { formatDateOnly } = useFormatDate();
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [myApps, setMyApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<{
    slug: string;
    name: string;
    trackedAppSlug: string;
  } | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const canEdit = user?.role === "owner" || user?.role === "editor";

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHiddenColumns(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  function toggleColumn(key: string) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (sortKey === key) {
          setSortKey("name");
          setSortDir("asc");
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const isCol = (key: string) => !hiddenColumns.has(key);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [compRes, appsRes] = await Promise.all([
      fetchWithAuth("/api/account/competitors"),
      fetchWithAuth("/api/account/tracked-apps"),
    ]);
    if (compRes.ok) setCompetitors(await compRes.json());
    if (appsRes.ok) setMyApps(await appsRes.json());
    setLoading(false);
  }

  async function removeCompetitor(
    slug: string,
    name: string,
    trackedAppSlug: string
  ) {
    setMessage("");
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(trackedAppSlug)}/competitors/${encodeURIComponent(slug)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setMessage(`"${name}" removed from competitors`);
      loadData();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to remove competitor");
    }
  }

  // Group competitors by trackedAppSlug
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const c of competitors) {
      const key = c.trackedAppSlug;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [competitors]);

  // Build app name lookup
  const appNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of myApps) {
      map.set(a.appSlug, a.appName);
    }
    return map;
  }, [myApps]);

  // Count unique competitors
  const uniqueCount = useMemo(() => {
    return new Set(competitors.map((c) => c.appSlug)).size;
  }, [competitors]);

  const trackedSlugs = useMemo(() => new Set(myApps.map((a) => a.appSlug)), [myApps]);
  const competitorSlugs = useMemo(() => new Set(competitors.map((c) => c.appSlug)), [competitors]);

  function sortCompetitors(list: any[]) {
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = (a.appName || a.appSlug).localeCompare(
            b.appName || b.appSlug
          );
          break;
        case "similarity":
          cmp = parseFloat(a.similarityScore?.overall ?? "0") - parseFloat(b.similarityScore?.overall ?? "0");
          break;
        case "rating":
          cmp =
            (a.latestSnapshot?.averageRating ?? 0) -
            (b.latestSnapshot?.averageRating ?? 0);
          break;
        case "reviews":
          cmp =
            (a.latestSnapshot?.ratingCount ?? 0) -
            (b.latestSnapshot?.ratingCount ?? 0);
          break;
        case "minPaidPrice":
          cmp = (a.minPaidPrice ?? 0) - (b.minPaidPrice ?? 0);
          break;
        case "rankedKeywords":
          cmp = (a.rankedKeywords ?? 0) - (b.rankedKeywords ?? 0);
          break;
        case "adKeywords":
          cmp = (a.adKeywords ?? 0) - (b.adKeywords ?? 0);
          break;
        case "featured":
          cmp = (a.featuredSections ?? 0) - (b.featuredSections ?? 0);
          break;
        case "similar":
          cmp = (a.reverseSimilarCount ?? 0) - (b.reverseSimilarCount ?? 0);
          break;
        case "lastChangeAt":
          cmp = (a.lastChangeAt || "").localeCompare(b.lastChangeAt || "");
          break;
        case "launchedDate":
          cmp = (a.launchedDate || "").localeCompare(b.launchedDate || "");
          break;
        case "v7d":
          cmp = (a.reviewVelocity?.v7d ?? -Infinity) - (b.reviewVelocity?.v7d ?? -Infinity);
          break;
        case "v30d":
          cmp = (a.reviewVelocity?.v30d ?? -Infinity) - (b.reviewVelocity?.v30d ?? -Infinity);
          break;
        case "v90d":
          cmp = (a.reviewVelocity?.v90d ?? -Infinity) - (b.reviewVelocity?.v90d ?? -Infinity);
          break;
        case "momentum": {
          const order: Record<string, number> = { spike: 5, accelerating: 4, stable: 3, slowing: 2, flat: 1 };
          cmp = (order[a.reviewVelocity?.momentum ?? ""] ?? 0) - (order[b.reviewVelocity?.momentum ?? ""] ?? 0);
          break;
        }
        case "pricing":
          cmp = (a.latestSnapshot?.pricing || "").localeCompare(b.latestSnapshot?.pricing || "");
          break;
        case "catRank": {
          const avgRank = (comp: any) => {
            const rankings = comp.categoryRankings ?? [];
            if (!rankings.length) return Infinity;
            let sum = 0;
            let count = 0;
            for (const cr of rankings) {
              if (cr.position != null) {
                sum += cr.position;
                count++;
              }
            }
            return count > 0 ? sum / count : Infinity;
          };
          cmp = avgRank(a) - avgRank(b);
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "catRank" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col)
      return (
        <ArrowUpDown className="inline h-3.5 w-3.5 ml-1 opacity-40" />
      );
    return sortDir === "asc" ? (
      <ArrowUp className="inline h-3.5 w-3.5 ml-1" />
    ) : (
      <ArrowDown className="inline h-3.5 w-3.5 ml-1" />
    );
  }

  function renderTableHeaders() {
    return (
      <TableRow>
        <TableHead
          className="cursor-pointer select-none md:sticky md:left-0 md:z-20 bg-background md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
          onClick={() => toggleSort("name")}
        >
          App <SortIcon col="name" />
        </TableHead>
        {isCol("similarity") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("similarity")}>
            <Tooltip><TooltipTrigger asChild><span>Similarity <SortIcon col="similarity" /></span></TooltipTrigger><TooltipContent>Similarity score based on categories, features, keywords, and text</TooltipContent></Tooltip>
          </TableHead>
        )}
        {isCol("rating") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("rating")}>
            Rating <SortIcon col="rating" />
          </TableHead>
        )}
        {isCol("reviews") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("reviews")}>
            Reviews <SortIcon col="reviews" />
          </TableHead>
        )}
        {isCol("v7d") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("v7d")}>
            <Tooltip><TooltipTrigger asChild><span>R7d <SortIcon col="v7d" /></span></TooltipTrigger><TooltipContent>Reviews received in the last 7 days</TooltipContent></Tooltip>
          </TableHead>
        )}
        {isCol("v30d") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("v30d")}>
            <Tooltip><TooltipTrigger asChild><span>R30d <SortIcon col="v30d" /></span></TooltipTrigger><TooltipContent>Reviews received in the last 30 days</TooltipContent></Tooltip>
          </TableHead>
        )}
        {isCol("v90d") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("v90d")}>
            <Tooltip><TooltipTrigger asChild><span>R90d <SortIcon col="v90d" /></span></TooltipTrigger><TooltipContent>Reviews received in the last 90 days</TooltipContent></Tooltip>
          </TableHead>
        )}
        {isCol("momentum") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("momentum")}>
            <Tooltip><TooltipTrigger asChild><span>Momentum <SortIcon col="momentum" /></span></TooltipTrigger><TooltipContent>Review growth trend: compares recent pace (7d) vs longer-term pace (30d/90d)</TooltipContent></Tooltip>
          </TableHead>
        )}
        {isCol("pricing") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("pricing")}>
            Pricing <SortIcon col="pricing" />
          </TableHead>
        )}
        {isCol("minPaidPrice") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("minPaidPrice")}>
            <Tooltip><TooltipTrigger asChild><span>Min. Paid <SortIcon col="minPaidPrice" /></span></TooltipTrigger><TooltipContent>Lowest paid plan price per month</TooltipContent></Tooltip>
          </TableHead>
        )}
        {isCol("launchedDate") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("launchedDate")}>
            Launched <SortIcon col="launchedDate" />
          </TableHead>
        )}
        {isCol("featured") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("featured")}>
            <Tooltip><TooltipTrigger asChild><span>Featured <SortIcon col="featured" /></span></TooltipTrigger><TooltipContent>Number of featured sections this app appears in</TooltipContent></Tooltip>
          </TableHead>
        )}
        {isCol("adKeywords") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("adKeywords")}>
            <Tooltip><TooltipTrigger asChild><span>Ads <SortIcon col="adKeywords" /></span></TooltipTrigger><TooltipContent>Number of keywords this app is running ads for</TooltipContent></Tooltip>
          </TableHead>
        )}
        {isCol("rankedKeywords") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("rankedKeywords")}>
            <Tooltip><TooltipTrigger asChild><span>Ranked <SortIcon col="rankedKeywords" /></span></TooltipTrigger><TooltipContent>Number of keywords this app ranks for in search results</TooltipContent></Tooltip>
          </TableHead>
        )}
        {isCol("similar") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("similar")}>
            <Tooltip><TooltipTrigger asChild><span>Similar <SortIcon col="similar" /></span></TooltipTrigger><TooltipContent>Number of other apps that list this app as similar</TooltipContent></Tooltip>
          </TableHead>
        )}
        {isCol("catRank") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("catRank")}>
            Category Rank <SortIcon col="catRank" />
          </TableHead>
        )}
        {isCol("lastChangeAt") && (
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("lastChangeAt")}>
            <Tooltip><TooltipTrigger asChild><span>Last Change <SortIcon col="lastChangeAt" /></span></TooltipTrigger><TooltipContent>Date of the most recent detected change in app listing</TooltipContent></Tooltip>
          </TableHead>
        )}
        <TableHead className="w-10" />
        {canEdit && <TableHead className="w-12" />}
      </TableRow>
    );
  }

  function renderCompetitorRow(c: any, myAppSlug: string) {
    return (
      <TableRow key={`${myAppSlug}-${c.appSlug}`}>
        <TableCell className="md:sticky md:left-0 md:z-10 bg-background md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
          <div className="flex items-center gap-2">
            {c.iconUrl && (
              <img
                src={c.iconUrl}
                alt=""
                className="h-6 w-6 rounded shrink-0"
              />
            )}
            <div className="flex items-center gap-1.5">
              <Link
                href={`/apps/${c.appSlug}`}
                className="text-primary hover:underline font-medium"
              >
                {c.appName || c.appSlug}
              </Link>
              {c.isBuiltForShopify && (
                <span title="Built for Shopify">💎</span>
              )}
            </div>
          </div>
        </TableCell>
        {isCol("similarity") && (
          <TableCell className="text-sm">
            {c.similarityScore ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          parseFloat(c.similarityScore.overall) >= 0.7 ? "bg-red-500" :
                          parseFloat(c.similarityScore.overall) >= 0.4 ? "bg-amber-500" :
                          "bg-emerald-500"
                        }`}
                        style={{ width: `${(parseFloat(c.similarityScore.overall) * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className="tabular-nums font-medium">
                      {(parseFloat(c.similarityScore.overall) * 100).toFixed(0)}%
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs space-y-1">
                    <div>Category: {(parseFloat(c.similarityScore.category) * 100).toFixed(0)}%</div>
                    <div>Features: {(parseFloat(c.similarityScore.feature) * 100).toFixed(0)}%</div>
                    <div>Keywords: {(parseFloat(c.similarityScore.keyword) * 100).toFixed(0)}%</div>
                    <div>Text: {(parseFloat(c.similarityScore.text) * 100).toFixed(0)}%</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : "\u2014"}
          </TableCell>
        )}
        {isCol("rating") && (
          <TableCell>
            {c.latestSnapshot?.averageRating ?? "\u2014"}
          </TableCell>
        )}
        {isCol("reviews") && (
          <TableCell>
            {c.latestSnapshot?.ratingCount != null ? (
              <Link href={`/apps/${c.appSlug}/reviews`} className="text-primary hover:underline">
                {c.latestSnapshot.ratingCount}
              </Link>
            ) : "\u2014"}
          </TableCell>
        )}
        {isCol("v7d") && (
          <TableCell className="text-sm">
            <VelocityCell value={c.reviewVelocity?.v7d} />
          </TableCell>
        )}
        {isCol("v30d") && (
          <TableCell className="text-sm">
            <VelocityCell value={c.reviewVelocity?.v30d} />
          </TableCell>
        )}
        {isCol("v90d") && (
          <TableCell className="text-sm">
            <VelocityCell value={c.reviewVelocity?.v90d} />
          </TableCell>
        )}
        {isCol("momentum") && (
          <TableCell className="text-sm">
            <MomentumBadge momentum={c.reviewVelocity?.momentum} />
          </TableCell>
        )}
        {isCol("pricing") && (
          <TableCell className="text-sm whitespace-nowrap">
            {(() => {
              const p = c.latestSnapshot?.pricing;
              if (!p) return "\u2014";
              const abbr: Record<string, string> = {
                "Free plan available": "Free plan",
                "Free to install": "Free install",
                "Free trial available": "Free trial",
              };
              const short = abbr[p];
              if (!short) return p;
              return (
                <Tooltip>
                  <TooltipTrigger asChild><span>{short}</span></TooltipTrigger>
                  <TooltipContent>{p}</TooltipContent>
                </Tooltip>
              );
            })()}
          </TableCell>
        )}
        {isCol("minPaidPrice") && (
          <TableCell className="text-sm">
            {c.minPaidPrice != null ? (
              <Link href={`/apps/${c.appSlug}/details#pricing-plans`} className="text-primary hover:underline">
                ${c.minPaidPrice}/mo
              </Link>
            ) : "\u2014"}
          </TableCell>
        )}
        {isCol("launchedDate") && (
          <TableCell className="text-sm text-muted-foreground">
            {c.launchedDate
              ? formatDateOnly(c.launchedDate)
              : "\u2014"}
          </TableCell>
        )}
        {isCol("featured") && (
          <TableCell className="text-sm">
            {c.featuredSections > 0 ? (
              <Link href={`/apps/${c.appSlug}/featured`} className="text-primary hover:underline">
                {c.featuredSections}
              </Link>
            ) : <span className="text-muted-foreground">{"\u2014"}</span>}
          </TableCell>
        )}
        {isCol("adKeywords") && (
          <TableCell className="text-sm">
            {c.adKeywords > 0 ? (
              <Link href={`/apps/${c.appSlug}/ads`} className="text-primary hover:underline">
                {c.adKeywords}
              </Link>
            ) : <span className="text-muted-foreground">{"\u2014"}</span>}
          </TableCell>
        )}
        {isCol("rankedKeywords") && (
          <TableCell className="text-sm">
            {(c.rankedKeywords ?? 0) > 0 ? (
              <Link href={`/apps/${c.appSlug}/keywords`} className="text-primary hover:underline">
                {c.rankedKeywords}
              </Link>
            ) : <span className="text-muted-foreground">{"\u2014"}</span>}
          </TableCell>
        )}
        {isCol("similar") && (
          <TableCell className="text-sm">
            {(c.reverseSimilarCount ?? 0) > 0 ? (
              <Link href={`/apps/${c.appSlug}/similar`} className="text-primary hover:underline">
                {c.reverseSimilarCount}
              </Link>
            ) : <span className="text-muted-foreground">{"\u2014"}</span>}
          </TableCell>
        )}
        {isCol("catRank") && (
          <TableCell className="text-sm">
            {(() => {
              const primary = c.categories?.find((cat: any) => cat.type === "primary");
              const secondary = c.categories?.find((cat: any) => cat.type === "secondary");
              if (!primary && !secondary) return "\u2014";
              const rankMap = new Map<string, { position: number; prevPosition: number | null; appCount: number | null }>(
                (c.categoryRankings ?? []).map((cr: any) => [
                  cr.categorySlug,
                  { position: cr.position, prevPosition: cr.prevPosition ?? null, appCount: cr.appCount ?? null },
                ])
              );

              function renderCategory(cat: { slug: string; title: string }, isPrimary: boolean) {
                const rank = rankMap.get(cat.slug);
                const change = rank && rank.prevPosition != null ? rank.prevPosition - rank.position : null;
                const topPercent = rank && rank.appCount != null && rank.appCount > 0
                  ? Math.max(1, Math.ceil((rank.position / rank.appCount) * 100))
                  : null;
                return (
                  <div className={`flex items-center gap-1.5 ${isPrimary ? "" : "mt-1"}`}>
                    {rank && <span className={`font-semibold tabular-nums shrink-0 ${isPrimary ? "" : "text-muted-foreground"}`}>#{rank.position}</span>}
                    {change != null && change !== 0 && (
                      <span className={`text-xs font-medium shrink-0 ${change > 0 ? "text-green-600" : "text-red-500"}`}>
                        {change > 0 ? "\u2191" : "\u2193"}{Math.abs(change)}
                      </span>
                    )}
                    {cat.slug ? <Link href={`/categories/${cat.slug}`} className={`hover:underline truncate ${isPrimary ? "text-primary" : "text-muted-foreground"}`}>{cat.title}</Link> : <span className={isPrimary ? "" : "text-muted-foreground"}>{cat.title}</span>}
                    {topPercent != null && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`text-xs px-1 py-0.5 rounded shrink-0 ${topPercent <= 5 ? "bg-emerald-500/10 text-emerald-600" : topPercent <= 20 ? "bg-blue-500/10 text-blue-600" : "bg-muted text-muted-foreground"}`}>
                            Top {topPercent}%
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Rank {rank!.position} of {rank!.appCount} apps
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                );
              }

              return (
                <div>
                  {primary && renderCategory(primary, true)}
                  {secondary && renderCategory(secondary, false)}
                </div>
              );
            })()}
          </TableCell>
        )}
        {isCol("lastChangeAt") && (
          <TableCell className="text-sm">
            {c.lastChangeAt ? (
              <Link href={`/apps/${c.appSlug}/changes`} className="text-primary hover:underline">
                {formatDateOnly(c.lastChangeAt)}
              </Link>
            ) : "\u2014"}
          </TableCell>
        )}
        <TableCell>
          <a
            href={`https://apps.shopify.com/${c.appSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            title="View on Shopify App Store"
          >
            <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </a>
        </TableCell>
        {canEdit && (
          <TableCell>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() =>
                setConfirmRemove({
                  slug: c.appSlug,
                  name: c.appName || c.appSlug,
                  trackedAppSlug: myAppSlug,
                })
              }
            >
              <X className="h-4 w-4" />
            </Button>
          </TableCell>
        )}
      </TableRow>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-2xl font-bold shrink-0">
          Competitor Apps ({uniqueCount}
          {account ? `/${account.limits.maxCompetitorApps}` : ""})
        </h1>
        <div className="flex items-center gap-3 flex-wrap sm:ml-auto">
          <AppSearchBar
            mode="browse-only"
            trackedSlugs={trackedSlugs}
            competitorSlugs={competitorSlugs}
            placeholder="Search apps..."
            className="w-full sm:w-72"
          />
          <DropdownMenuPrimitive.Root>
            <DropdownMenuPrimitive.Trigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 relative">
                <Settings2 className="h-4 w-4" />
                {hiddenColumns.size > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-medium leading-none px-1">
                    {hiddenColumns.size}
                  </span>
                )}
              </Button>
            </DropdownMenuPrimitive.Trigger>
            <DropdownMenuPrimitive.Portal>
              <DropdownMenuPrimitive.Content
                align="end"
                className="z-50 min-w-[200px] bg-popover border rounded-md shadow-md p-1 animate-in fade-in-0 zoom-in-95"
              >
                <DropdownMenuPrimitive.Label className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Toggle columns
                </DropdownMenuPrimitive.Label>
                <div className="flex items-center gap-1 px-2 py-1">
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      setHiddenColumns(new Set());
                      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
                    }}
                  >
                    Show all
                  </button>
                  <span className="text-muted-foreground text-xs">&middot;</span>
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      const allKeys = new Set(TOGGLEABLE_COLUMNS.map((c) => c.key));
                      setHiddenColumns(allKeys);
                      localStorage.setItem(STORAGE_KEY, JSON.stringify([...allKeys]));
                      if (allKeys.has(sortKey)) {
                        setSortKey("name");
                        setSortDir("asc");
                      }
                    }}
                  >
                    Hide all
                  </button>
                </div>
                <DropdownMenuPrimitive.Separator className="h-px bg-border my-1" />
                <div className="max-h-[300px] overflow-y-auto">
                  {TOGGLEABLE_COLUMNS.map((col) => (
                    <DropdownMenuPrimitive.CheckboxItem
                      key={col.key}
                      checked={isCol(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                      onSelect={(e) => e.preventDefault()}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent focus:bg-accent"
                    >
                      <span className="w-4 h-4 flex items-center justify-center shrink-0">
                        {isCol(col.key) && <Check className="h-3 w-3" />}
                      </span>
                      {col.tip ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="border-b border-dotted border-muted-foreground/50">{col.label}</span>
                          </TooltipTrigger>
                          <TooltipContent side="left">{col.tip}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span>{col.label}</span>
                      )}
                    </DropdownMenuPrimitive.CheckboxItem>
                  ))}
                </div>
              </DropdownMenuPrimitive.Content>
            </DropdownMenuPrimitive.Portal>
          </DropdownMenuPrimitive.Root>
          <AdminScraperTrigger
            scraperType="app_details"
            label="Scrape All Apps"
          />
        </div>
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">
          {message}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : myApps.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-8">
              No tracked apps yet.{" "}
              <Link href="/apps" className="text-primary hover:underline">
                Add apps
              </Link>{" "}
              first, then add competitors from app detail pages.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Apps with competitors first */}
          {myApps
            .filter((myApp) => (grouped.get(myApp.appSlug) || []).length > 0)
            .map((myApp) => {
              const comps = grouped.get(myApp.appSlug)!;
              return (
                <Card key={myApp.appSlug}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      {myApp.iconUrl && (
                        <img
                          src={myApp.iconUrl}
                          alt=""
                          className="h-6 w-6 rounded shrink-0"
                        />
                      )}
                      <CardTitle className="text-base">
                        <Link
                          href={`/apps/${myApp.appSlug}`}
                          className="text-primary hover:underline"
                        >
                          {myApp.appName || myApp.appSlug}
                        </Link>
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {comps.length} competitor{comps.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        {renderTableHeaders()}
                      </TableHeader>
                      <TableBody>
                        {sortCompetitors(comps).map((c) => renderCompetitorRow(c, myApp.appSlug))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}

          {/* Apps without competitors at the bottom */}
          {myApps.filter(
            (myApp) => (grouped.get(myApp.appSlug) || []).length === 0
          ).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-muted-foreground">
                  Apps without competitors
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {myApps
                  .filter(
                    (myApp) =>
                      (grouped.get(myApp.appSlug) || []).length === 0
                  )
                  .map((myApp) => (
                    <Link
                      key={myApp.appSlug}
                      href={`/apps/${myApp.appSlug}/competitors`}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm hover:bg-muted transition-colors"
                    >
                      {myApp.iconUrl && (
                        <img
                          src={myApp.iconUrl}
                          alt=""
                          className="h-5 w-5 rounded shrink-0"
                        />
                      )}
                      {myApp.appName || myApp.appSlug}
                      <Badge variant="outline" className="text-xs">
                        Add
                      </Badge>
                    </Link>
                  ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <ConfirmModal
        open={!!confirmRemove}
        title="Remove Competitor"
        description={`Are you sure you want to remove "${confirmRemove?.name}" from competitors of "${appNameMap.get(confirmRemove?.trackedAppSlug || "") || confirmRemove?.trackedAppSlug}"?`}
        onConfirm={() => {
          if (confirmRemove) {
            removeCompetitor(
              confirmRemove.slug,
              confirmRemove.name,
              confirmRemove.trackedAppSlug
            );
            setConfirmRemove(null);
          }
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
