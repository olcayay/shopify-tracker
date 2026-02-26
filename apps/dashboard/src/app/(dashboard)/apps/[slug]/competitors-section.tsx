"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFormatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, ArrowUpDown, ArrowUp, ArrowDown, ChevronUp, ChevronDown, Pin, PinOff, ExternalLink } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import { AppSearchBar } from "@/components/app-search-bar";
import { VelocityCell } from "@/components/velocity-cell";
import { MomentumBadge } from "@/components/momentum-badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type SortKey = "order" | "name" | "rating" | "reviews" | "v7d" | "v30d" | "v90d" | "momentum" | "pricing" | "minPaidPrice" | "launchedDate" | "lastChange" | "featured" | "ads" | "ranked" | "similar" | "catRank";
type SortDir = "asc" | "desc";

export function CompetitorsSection({ appSlug }: { appSlug: string }) {
  const { fetchWithAuth, user, account, refreshUser } = useAuth();
  const { formatDateOnly } = useFormatDate();
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [lastChanges, setLastChanges] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<{
    slug: string;
    name: string;
  } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("order");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [reordering, setReordering] = useState(false);
  const [selfPinned, setSelfPinned] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`competitors-pin-self-${appSlug}`);
      if (saved !== null) setSelfPinned(JSON.parse(saved));
    } catch {}
  }, [appSlug]);

  function toggleSelfPinned() {
    const next = !selfPinned;
    setSelfPinned(next);
    localStorage.setItem(`competitors-pin-self-${appSlug}`, JSON.stringify(next));
  }

  const canEdit = user?.role === "owner" || user?.role === "editor";

  useEffect(() => {
    loadCompetitors();
  }, []);

  async function loadCompetitors() {
    setLoading(true);
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors?includeSelf=true`
    );
    if (res.ok) {
      const comps = await res.json();
      setCompetitors(comps);

      // Fetch last changes for all apps (including self)
      const slugs = comps.map((c: any) => c.appSlug);
      if (slugs.length > 0) {
        const changesRes = await fetchWithAuth(`/api/apps/last-changes`, {
          method: "POST",
          body: JSON.stringify({ slugs }),
        });
        if (changesRes.ok) {
          setLastChanges(await changesRes.json());
        }
      }
    }
    setLoading(false);
  }

  async function addCompetitor(slug: string, name: string) {
    setMessage("");
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors`,
      {
        method: "POST",
        body: JSON.stringify({ slug }),
      }
    );
    if (res.ok) {
      setMessage(`"${name}" added as competitor`);
      loadCompetitors();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to add competitor");
    }
  }

  async function removeCompetitor(slug: string, name: string) {
    setMessage("");
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors/${encodeURIComponent(slug)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setMessage(`"${name}" removed from competitors`);
      loadCompetitors();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to remove competitor");
    }
  }

  async function moveCompetitor(index: number, direction: "up" | "down") {
    const newList = [...competitors];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    // Don't swap with the self row
    if (newList[targetIndex]?.isSelf || newList[index]?.isSelf) return;

    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    setCompetitors(newList);

    setReordering(true);
    const slugs = newList.filter((c) => !c.isSelf).map((c) => c.appSlug);
    await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors/reorder`,
      {
        method: "PATCH",
        body: JSON.stringify({ slugs }),
      }
    );
    setReordering(false);
  }

  // Whether we're in custom order mode (showing move buttons)
  const isCustomOrder = sortKey === "order";

  function sortedCompetitors() {
    if (sortKey === "order") return competitors; // preserve API order
    const pinnedSelf = selfPinned ? competitors.filter((c) => c.isSelf) : [];
    const rest = selfPinned ? competitors.filter((c) => !c.isSelf) : [...competitors];
    return [...pinnedSelf, ...rest.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = (a.appName || a.appSlug).localeCompare(b.appName || b.appSlug);
          break;
        case "rating":
          cmp = (a.latestSnapshot?.averageRating ?? 0) - (b.latestSnapshot?.averageRating ?? 0);
          break;
        case "reviews":
          cmp = (a.latestSnapshot?.ratingCount ?? 0) - (b.latestSnapshot?.ratingCount ?? 0);
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
        case "minPaidPrice":
          cmp = (a.minPaidPrice ?? 0) - (b.minPaidPrice ?? 0);
          break;
        case "launchedDate":
          cmp = (a.launchedDate || "").localeCompare(b.launchedDate || "");
          break;
        case "lastChange":
          cmp = (lastChanges[a.appSlug] || "").localeCompare(lastChanges[b.appSlug] || "");
          break;
        case "featured":
          cmp = (a.featuredSections ?? 0) - (b.featuredSections ?? 0);
          break;
        case "ads":
          cmp = (a.adKeywords ?? 0) - (b.adKeywords ?? 0);
          break;
        case "ranked":
          cmp = (a.rankedKeywordCount ?? 0) - (b.rankedKeywordCount ?? 0);
          break;
        case "similar":
          cmp = (a.reverseSimilarCount ?? 0) - (b.reverseSimilarCount ?? 0);
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
    })];
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "order" || key === "catRank" ? "asc" : "desc");
    }
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

  const competitorSlugs = new Set(competitors.map((c) => c.appSlug));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Competitors for this app
          {account
            ? ` (${account.usage.competitorApps}/${account.limits.maxCompetitorApps} unique across all apps)`
            : ""}
        </p>
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      <AppSearchBar
        mode="competitor"
        competitorSlugs={competitorSlugs}
        currentAppSlug={appSlug}
        onAddCompetitor={addCompetitor}
        placeholder="Search apps..."
        className="max-w-md"
      />

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : competitors.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No competitors added yet.
          {canEdit && " Use the search above to add competitors."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {canEdit && (
                <TableHead
                  className="w-12 cursor-pointer select-none"
                  onClick={() => toggleSort("order")}
                >
                  # <SortIcon col="order" />
                </TableHead>
              )}
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                App <SortIcon col="name" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("rating")}>
                Rating <SortIcon col="rating" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("reviews")}>
                Reviews <SortIcon col="reviews" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("v7d")}>
                <Tooltip><TooltipTrigger asChild><span>R7d <SortIcon col="v7d" /></span></TooltipTrigger><TooltipContent>Reviews received in the last 7 days</TooltipContent></Tooltip>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("v30d")}>
                <Tooltip><TooltipTrigger asChild><span>R30d <SortIcon col="v30d" /></span></TooltipTrigger><TooltipContent>Reviews received in the last 30 days</TooltipContent></Tooltip>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("v90d")}>
                <Tooltip><TooltipTrigger asChild><span>R90d <SortIcon col="v90d" /></span></TooltipTrigger><TooltipContent>Reviews received in the last 90 days</TooltipContent></Tooltip>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("momentum")}>
                <Tooltip><TooltipTrigger asChild><span>Momentum <SortIcon col="momentum" /></span></TooltipTrigger><TooltipContent>Review growth trend: compares recent pace (7d) vs longer-term pace (30d/90d)</TooltipContent></Tooltip>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("pricing")}>
                Pricing <SortIcon col="pricing" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("minPaidPrice")}>
                <Tooltip><TooltipTrigger asChild><span>Min. Paid <SortIcon col="minPaidPrice" /></span></TooltipTrigger><TooltipContent>Lowest paid plan price per month</TooltipContent></Tooltip>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("launchedDate")}>
                Launched <SortIcon col="launchedDate" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("featured")}>
                <Tooltip><TooltipTrigger asChild><span>Featured <SortIcon col="featured" /></span></TooltipTrigger><TooltipContent>Number of featured sections this app appears in</TooltipContent></Tooltip>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("ads")}>
                <Tooltip><TooltipTrigger asChild><span>Ads <SortIcon col="ads" /></span></TooltipTrigger><TooltipContent>Number of keywords this app is running ads for</TooltipContent></Tooltip>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("ranked")}>
                <Tooltip><TooltipTrigger asChild><span>Ranked <SortIcon col="ranked" /></span></TooltipTrigger><TooltipContent>Number of keywords this app ranks for in search results</TooltipContent></Tooltip>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("similar")}>
                <Tooltip><TooltipTrigger asChild><span>Similar <SortIcon col="similar" /></span></TooltipTrigger><TooltipContent>Number of other apps that list this app as similar</TooltipContent></Tooltip>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("catRank")}>
                Cat. Rank <SortIcon col="catRank" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("lastChange")}>
                <Tooltip><TooltipTrigger asChild><span>Last Change <SortIcon col="lastChange" /></span></TooltipTrigger><TooltipContent>Date of the most recent detected change in app listing</TooltipContent></Tooltip>
              </TableHead>
              {canEdit && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const sorted = sortedCompetitors();
              let competitorNum = 0;
              return sorted.map((comp, idx) => {
              if (!comp.isSelf || !selfPinned) competitorNum++;
              return (
              <TableRow key={comp.appSlug} className={comp.isSelf ? "border-l-2 border-l-emerald-500 bg-emerald-500/10" : ""}>
                {canEdit && (
                  <TableCell className="py-1">
                    {comp.isSelf ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors"
                            onClick={toggleSelfPinned}
                          >
                            {selfPinned
                              ? <Pin className="h-3.5 w-3.5 text-emerald-500" />
                              : <PinOff className="h-3.5 w-3.5 text-muted-foreground" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {selfPinned ? "Unpin: sort this app with competitors" : "Pin: keep this app at the top"}
                        </TooltipContent>
                      </Tooltip>
                    ) : isCustomOrder ? (
                      <div className="flex flex-col items-center gap-0">
                        <button
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent disabled:opacity-20 transition-colors"
                          disabled={idx === 0 || reordering}
                          onClick={() => moveCompetitor(idx, "up")}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent disabled:opacity-20 transition-colors"
                          disabled={idx === competitors.length - 1 || reordering}
                          onClick={() => moveCompetitor(idx, "down")}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{competitorNum}</span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-2">
                    {comp.iconUrl && (
                      <img
                        src={comp.iconUrl}
                        alt=""
                        className="h-6 w-6 rounded shrink-0"
                      />
                    )}
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/apps/${comp.appSlug}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {comp.appName}
                      </Link>
                      {comp.isBuiltForShopify && (
                        <span title="Built for Shopify">💎</span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {comp.latestSnapshot?.averageRating ?? "\u2014"}
                </TableCell>
                <TableCell>
                  {comp.latestSnapshot?.ratingCount != null ? (
                    <Link href={`/apps/${comp.appSlug}/reviews`} className="text-primary hover:underline">
                      {comp.latestSnapshot.ratingCount}
                    </Link>
                  ) : "\u2014"}
                </TableCell>
                <TableCell className="text-sm">
                  <VelocityCell value={comp.reviewVelocity?.v7d} />
                </TableCell>
                <TableCell className="text-sm">
                  <VelocityCell value={comp.reviewVelocity?.v30d} />
                </TableCell>
                <TableCell className="text-sm">
                  <VelocityCell value={comp.reviewVelocity?.v90d} />
                </TableCell>
                <TableCell className="text-sm">
                  <MomentumBadge momentum={comp.reviewVelocity?.momentum} />
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {(() => {
                    const p = comp.latestSnapshot?.pricing;
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
                <TableCell className="text-sm">
                  {comp.minPaidPrice != null ? (
                    <Link href={`/apps/${comp.appSlug}/details#pricing-plans`} className="text-primary hover:underline">
                      ${comp.minPaidPrice}/mo
                    </Link>
                  ) : "\u2014"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {comp.launchedDate
                    ? formatDateOnly(comp.launchedDate)
                    : "\u2014"}
                </TableCell>
                <TableCell className="text-sm">
                  {comp.featuredSections > 0 ? (
                    <Link
                      href={`/apps/${comp.appSlug}/featured`}
                      className="text-primary hover:underline"
                    >
                      {comp.featuredSections}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {comp.adKeywords > 0 ? (
                    <Link
                      href={`/apps/${comp.appSlug}/ads`}
                      className="text-primary hover:underline"
                    >
                      {comp.adKeywords}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {comp.rankedKeywordCount > 0 ? (
                    <Link href={`/apps/${comp.appSlug}/keywords`} className="text-primary hover:underline">
                      {comp.rankedKeywordCount}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {comp.reverseSimilarCount > 0 ? (
                    <Link href={`/apps/${comp.appSlug}/similar`} className="text-primary hover:underline">
                      {comp.reverseSimilarCount}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {(() => {
                    const primary = comp.categories?.find((cat: any) => cat.type === "primary");
                    const secondary = comp.categories?.find((cat: any) => cat.type === "secondary");
                    if (!primary && !secondary) return "\u2014";
                    const rankMap = new Map<string, { position: number; prevPosition: number | null; appCount: number | null }>(
                      (comp.categoryRankings ?? []).map((cr: any) => [
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
                                Rank {rank.position} of {rank.appCount} apps
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
                <TableCell className="text-sm">
                  {lastChanges[comp.appSlug] ? (
                    <Link href={`/apps/${comp.appSlug}/changes`} className="text-primary hover:underline">
                      {formatDateOnly(lastChanges[comp.appSlug])}
                    </Link>
                  ) : "\u2014"}
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <a
                        href={`https://apps.shopify.com/${comp.appSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      {!comp.isSelf && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setConfirmRemove({
                              slug: comp.appSlug,
                              name: comp.appName,
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
              );
              });
            })()}
          </TableBody>
        </Table>
      )}

      <ConfirmModal
        open={!!confirmRemove}
        title="Remove Competitor"
        description={`Are you sure you want to remove "${confirmRemove?.name}" from competitors?`}
        onConfirm={() => {
          if (confirmRemove) {
            removeCompetitor(confirmRemove.slug, confirmRemove.name);
            setConfirmRemove(null);
          }
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
