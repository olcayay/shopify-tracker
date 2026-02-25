"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFormatDate } from "@/lib/format-date";
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
import { X, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";
import { AppSearchBar } from "@/components/app-search-bar";
import { VelocityCell } from "@/components/velocity-cell";
import { MomentumBadge } from "@/components/momentum-badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { ReviewVelocityMetrics } from "@/lib/api";

type SortKey =
  | "name"
  | "rating"
  | "reviews"
  | "v7d"
  | "v30d"
  | "v90d"
  | "momentum"
  | "minPaidPrice"
  | "rankedKeywords"
  | "adKeywords"
  | "featured"
  | "lastChangeAt"
  | "launchedDate"
  | "catRank";
type SortDir = "asc" | "desc";

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

  const canEdit = user?.role === "owner" || user?.role === "editor";

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
        case "catRank": {
          const bestRank = (comp: any) => {
            const rankings = comp.categoryRankings ?? [];
            if (!rankings.length) return Infinity;
            let best = Infinity;
            for (const cr of rankings) {
              if (cr.position != null && cr.position < best) best = cr.position;
            }
            return best;
          };
          cmp = bestRank(a) - bestRank(b);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Competitor Apps ({uniqueCount}
          {account ? `/${account.limits.maxCompetitorApps}` : ""})
        </h1>
        <div className="flex items-center gap-3">
          <AppSearchBar
            mode="browse-only"
            trackedSlugs={trackedSlugs}
            competitorSlugs={competitorSlugs}
            placeholder="Search apps..."
            className="w-72"
          />
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
        <p className="text-muted-foreground text-center py-8">Loading...</p>
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
                        <TableRow>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => toggleSort("name")}
                          >
                            App <SortIcon col="name" />
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => toggleSort("rating")}
                          >
                            Rating <SortIcon col="rating" />
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => toggleSort("reviews")}
                          >
                            Reviews <SortIcon col="reviews" />
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => toggleSort("v7d")}
                          >
                            <Tooltip><TooltipTrigger asChild><span>R7d <SortIcon col="v7d" /></span></TooltipTrigger><TooltipContent>Reviews received in the last 7 days</TooltipContent></Tooltip>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => toggleSort("v30d")}
                          >
                            <Tooltip><TooltipTrigger asChild><span>R30d <SortIcon col="v30d" /></span></TooltipTrigger><TooltipContent>Reviews received in the last 30 days</TooltipContent></Tooltip>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => toggleSort("v90d")}
                          >
                            <Tooltip><TooltipTrigger asChild><span>R90d <SortIcon col="v90d" /></span></TooltipTrigger><TooltipContent>Reviews received in the last 90 days</TooltipContent></Tooltip>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => toggleSort("momentum")}
                          >
                            <Tooltip><TooltipTrigger asChild><span>Momentum <SortIcon col="momentum" /></span></TooltipTrigger><TooltipContent>Review growth trend: compares recent pace (7d) vs longer-term pace (30d/90d)</TooltipContent></Tooltip>
                          </TableHead>
                          <TableHead>Pricing</TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => toggleSort("minPaidPrice")}
                          >
                            <Tooltip><TooltipTrigger asChild><span>Min. Paid <SortIcon col="minPaidPrice" /></span></TooltipTrigger><TooltipContent>Lowest paid plan price per month</TooltipContent></Tooltip>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => toggleSort("rankedKeywords")}
                          >
                            <Tooltip><TooltipTrigger asChild><span>Keywords <SortIcon col="rankedKeywords" /></span></TooltipTrigger><TooltipContent>Number of keywords this app ranks for in search results</TooltipContent></Tooltip>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => toggleSort("adKeywords")}
                          >
                            <Tooltip><TooltipTrigger asChild><span>Ads <SortIcon col="adKeywords" /></span></TooltipTrigger><TooltipContent>Number of keywords this app is running ads for</TooltipContent></Tooltip>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => toggleSort("featured")}
                          >
                            <Tooltip><TooltipTrigger asChild><span>Featured <SortIcon col="featured" /></span></TooltipTrigger><TooltipContent>Number of featured sections this app appears in</TooltipContent></Tooltip>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("catRank")}>
                            Cat. Rank <SortIcon col="catRank" />
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => toggleSort("lastChangeAt")}
                          >
                            <Tooltip><TooltipTrigger asChild><span>Last Change <SortIcon col="lastChangeAt" /></span></TooltipTrigger><TooltipContent>Date of the most recent detected change in app listing</TooltipContent></Tooltip>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => toggleSort("launchedDate")}
                          >
                            Launched <SortIcon col="launchedDate" />
                          </TableHead>
                          <TableHead className="w-10" />
                          {canEdit && <TableHead className="w-12" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortCompetitors(comps).map((c) => (
                          <TableRow key={`${myApp.appSlug}-${c.appSlug}`}>
                            <TableCell>
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
                            <TableCell>
                              {c.latestSnapshot?.averageRating ?? "\u2014"}
                            </TableCell>
                            <TableCell>
                              {c.latestSnapshot?.ratingCount != null ? (
                                <Link href={`/apps/${c.appSlug}/reviews`} className="text-primary hover:underline">
                                  {c.latestSnapshot.ratingCount}
                                </Link>
                              ) : "\u2014"}
                            </TableCell>
                            <TableCell className="text-sm">
                              <VelocityCell value={c.reviewVelocity?.v7d} />
                            </TableCell>
                            <TableCell className="text-sm">
                              <VelocityCell value={c.reviewVelocity?.v30d} />
                            </TableCell>
                            <TableCell className="text-sm">
                              <VelocityCell value={c.reviewVelocity?.v90d} />
                            </TableCell>
                            <TableCell className="text-sm">
                              <MomentumBadge momentum={c.reviewVelocity?.momentum} />
                            </TableCell>
                            <TableCell className="text-sm">
                              {c.latestSnapshot?.pricing ?? "\u2014"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {c.minPaidPrice != null ? (
                                <Link href={`/apps/${c.appSlug}/details#pricing-plans`} className="text-primary hover:underline">
                                  ${c.minPaidPrice}/mo
                                </Link>
                              ) : "\u2014"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {(c.rankedKeywords ?? 0) > 0 ? (
                                <Link href={`/apps/${c.appSlug}/keywords`} className="text-primary hover:underline">
                                  {c.rankedKeywords}
                                </Link>
                              ) : 0}
                            </TableCell>
                            <TableCell className="text-sm">
                              {c.adKeywords > 0 ? (
                                <Link href={`/apps/${c.appSlug}/ads`} className="text-primary hover:underline">
                                  {c.adKeywords}
                                </Link>
                              ) : "\u2014"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {c.featuredSections > 0 ? (
                                <Link href={`/apps/${c.appSlug}/featured`} className="text-primary hover:underline">
                                  {c.featuredSections}
                                </Link>
                              ) : "\u2014"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {(() => {
                                const primary = c.categories?.find((cat: any) => cat.type === "primary");
                                const secondary = c.categories?.find((cat: any) => cat.type === "secondary");
                                if (!primary && !secondary) return "\u2014";
                                const rankMap = new Map<string, number>((c.categoryRankings ?? []).map((cr: any) => [cr.categorySlug, cr.position]));
                                return (
                                  <div className="space-y-0.5">
                                    {primary && (
                                      <div className="flex items-center gap-1">
                                        {rankMap.has(primary.slug) && <span className="font-medium text-muted-foreground">#{rankMap.get(primary.slug)}</span>}
                                        {primary.slug ? <Link href={`/categories/${primary.slug}`} className="text-primary hover:underline">{primary.title}</Link> : primary.title}
                                      </div>
                                    )}
                                    {secondary && (
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        {rankMap.has(secondary.slug) && <span className="font-medium">#{rankMap.get(secondary.slug)}</span>}
                                        {secondary.slug ? <Link href={`/categories/${secondary.slug}`} className="hover:underline">{secondary.title}</Link> : secondary.title}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-sm">
                              {c.lastChangeAt ? (
                                <Link href={`/apps/${c.appSlug}/changes`} className="text-primary hover:underline">
                                  {formatDateOnly(c.lastChangeAt)}
                                </Link>
                              ) : "\u2014"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {c.launchedDate
                                ? formatDateOnly(c.launchedDate)
                                : "\u2014"}
                            </TableCell>
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
                                      trackedAppSlug: myApp.appSlug,
                                    })
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
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
