"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFormatDate } from "@/lib/format-date";
import { TableSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, ArrowUpDown, ArrowUp, ArrowDown, ChevronUp, ChevronDown, Pin, PinOff, ExternalLink, Settings2, Check, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { ConfirmModal } from "@/components/confirm-modal";
import { AppSearchBar } from "@/components/app-search-bar";
import { VelocityCell } from "@/components/velocity-cell";
import { MomentumBadge } from "@/components/momentum-badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type SortKey = "order" | "name" | "similarity" | "rating" | "reviews" | "v7d" | "v30d" | "v90d" | "momentum" | "pricing" | "minPaidPrice" | "launchedDate" | "lastChange" | "featured" | "ads" | "ranked" | "similar" | "catRank";
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
  { key: "ads", label: "Ads", tip: "Number of keywords this app is running ads for" },
  { key: "ranked", label: "Ranked", tip: "Number of keywords this app ranks for in search results" },
  { key: "similar", label: "Similar", tip: "Number of other apps that list this app as similar" },
  { key: "catRank", label: "Category Rank", tip: "Average category ranking across all categories" },
  { key: "lastChange", label: "Last Change", tip: "Date of the most recent detected change in app listing" },
];

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
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [pendingCompetitorSlugs, setPendingCompetitorSlugs] = useState<Map<string, number>>(new Map());
  const [resolvedCompetitorSlugs, setResolvedCompetitorSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`competitors-pin-self-${appSlug}`);
      if (saved !== null) setSelfPinned(JSON.parse(saved));
    } catch {}
    try {
      const saved = localStorage.getItem(`competitors-columns-${appSlug}`);
      if (saved) setHiddenColumns(new Set(JSON.parse(saved)));
    } catch {}
  }, [appSlug]);

  function toggleColumn(key: string) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (sortKey === key) {
          setSortKey("order");
          setSortDir("asc");
        }
      }
      localStorage.setItem(`competitors-columns-${appSlug}`, JSON.stringify([...next]));
      return next;
    });
  }

  const isCol = (key: string) => !hiddenColumns.has(key);

  function toggleSelfPinned() {
    const next = !selfPinned;
    setSelfPinned(next);
    localStorage.setItem(`competitors-pin-self-${appSlug}`, JSON.stringify(next));
  }

  const canEdit = user?.role === "owner" || user?.role === "editor";

  useEffect(() => {
    loadCompetitors();
  }, []);

  // Poll for pending competitors that are being scraped
  useEffect(() => {
    if (pendingCompetitorSlugs.size === 0) return;

    const interval = setInterval(async () => {
      const res = await fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors?includeSelf=true`
      );
      if (!res.ok) return;
      const freshCompetitors = await res.json();
      setCompetitors(freshCompetitors);

      // Also refresh last changes
      const slugs = freshCompetitors.map((c: any) => c.appSlug);
      if (slugs.length > 0) {
        const changesRes = await fetchWithAuth(`/api/apps/last-changes`, {
          method: "POST",
          body: JSON.stringify({ slugs }),
        });
        if (changesRes.ok) {
          setLastChanges(await changesRes.json());
        }
      }

      // Check which pending competitors now have enriched data (from compute jobs)
      const newlyResolved = new Set<string>();
      const stillPending = new Map<string, number>();
      for (const [slug, addedAt] of pendingCompetitorSlugs) {
        const comp = freshCompetitors.find((c: any) => c.appSlug === slug);
        const elapsed = Date.now() - addedAt;
        const hasEnrichedData = comp && (comp.reviewVelocity !== null || comp.similarityScore !== null);
        if (hasEnrichedData || elapsed > 120_000) {
          newlyResolved.add(slug);
        } else {
          stillPending.set(slug, addedAt);
        }
      }

      if (newlyResolved.size > 0) {
        setPendingCompetitorSlugs(stillPending);
        setResolvedCompetitorSlugs((prev) => {
          const next = new Set(prev);
          for (const s of newlyResolved) next.add(s);
          return next;
        });
        // Clear resolved animation after 2 seconds
        setTimeout(() => {
          setResolvedCompetitorSlugs((prev) => {
            const next = new Set(prev);
            for (const s of newlyResolved) next.delete(s);
            return next;
          });
        }, 2000);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pendingCompetitorSlugs, appSlug]);

  async function loadCompetitors(silent = false) {
    if (!silent) setLoading(true);
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
      const data = await res.json().catch(() => ({}));
      if (data.scraperEnqueued) {
        setPendingCompetitorSlugs((prev) => new Map(prev).set(slug, Date.now()));
      }
      setMessage(`"${name}" added as competitor`);
      loadCompetitors(true);
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
        case "similarity":
          cmp = parseFloat(a.similarityScore?.overall ?? "0") - parseFloat(b.similarityScore?.overall ?? "0");
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

      <div className="flex items-center gap-2">
        <AppSearchBar
          mode="competitor"
          competitorSlugs={competitorSlugs}
          currentAppSlug={appSlug}
          onAddCompetitor={addCompetitor}
          placeholder="Search apps..."
          className="max-w-md flex-1"
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
                    localStorage.setItem(`competitors-columns-${appSlug}`, JSON.stringify([]));
                  }}
                >
                  Show all
                </button>
                <span className="text-muted-foreground text-xs">·</span>
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    const allKeys = new Set(TOGGLEABLE_COLUMNS.map((c) => c.key));
                    setHiddenColumns(allKeys);
                    localStorage.setItem(`competitors-columns-${appSlug}`, JSON.stringify([...allKeys]));
                    if (allKeys.has(sortKey)) {
                      setSortKey("order");
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
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={6} />
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
                  className="w-12 cursor-pointer select-none md:sticky md:left-0 md:z-20 bg-background"
                  onClick={() => toggleSort("order")}
                >
                  # <SortIcon col="order" />
                </TableHead>
              )}
              <TableHead className={`cursor-pointer select-none md:sticky md:z-20 bg-background md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${canEdit ? "md:left-12" : "md:left-0"}`} onClick={() => toggleSort("name")}>
                App <SortIcon col="name" />
              </TableHead>
              {isCol("similarity") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("similarity")}>
                <Tooltip><TooltipTrigger asChild><span>Similarity <SortIcon col="similarity" /></span></TooltipTrigger><TooltipContent>Similarity score based on categories, features, keywords, and text</TooltipContent></Tooltip>
              </TableHead>}
              {isCol("rating") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("rating")}>
                Rating <SortIcon col="rating" />
              </TableHead>}
              {isCol("reviews") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("reviews")}>
                Reviews <SortIcon col="reviews" />
              </TableHead>}
              {isCol("v7d") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("v7d")}>
                <Tooltip><TooltipTrigger asChild><span>R7d <SortIcon col="v7d" /></span></TooltipTrigger><TooltipContent>Reviews received in the last 7 days</TooltipContent></Tooltip>
              </TableHead>}
              {isCol("v30d") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("v30d")}>
                <Tooltip><TooltipTrigger asChild><span>R30d <SortIcon col="v30d" /></span></TooltipTrigger><TooltipContent>Reviews received in the last 30 days</TooltipContent></Tooltip>
              </TableHead>}
              {isCol("v90d") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("v90d")}>
                <Tooltip><TooltipTrigger asChild><span>R90d <SortIcon col="v90d" /></span></TooltipTrigger><TooltipContent>Reviews received in the last 90 days</TooltipContent></Tooltip>
              </TableHead>}
              {isCol("momentum") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("momentum")}>
                <Tooltip><TooltipTrigger asChild><span>Momentum <SortIcon col="momentum" /></span></TooltipTrigger><TooltipContent>Review growth trend: compares recent pace (7d) vs longer-term pace (30d/90d)</TooltipContent></Tooltip>
              </TableHead>}
              {isCol("pricing") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("pricing")}>
                Pricing <SortIcon col="pricing" />
              </TableHead>}
              {isCol("minPaidPrice") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("minPaidPrice")}>
                <Tooltip><TooltipTrigger asChild><span>Min. Paid <SortIcon col="minPaidPrice" /></span></TooltipTrigger><TooltipContent>Lowest paid plan price per month</TooltipContent></Tooltip>
              </TableHead>}
              {isCol("launchedDate") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("launchedDate")}>
                Launched <SortIcon col="launchedDate" />
              </TableHead>}
              {isCol("featured") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("featured")}>
                <Tooltip><TooltipTrigger asChild><span>Featured <SortIcon col="featured" /></span></TooltipTrigger><TooltipContent>Number of featured sections this app appears in</TooltipContent></Tooltip>
              </TableHead>}
              {isCol("ads") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("ads")}>
                <Tooltip><TooltipTrigger asChild><span>Ads <SortIcon col="ads" /></span></TooltipTrigger><TooltipContent>Number of keywords this app is running ads for</TooltipContent></Tooltip>
              </TableHead>}
              {isCol("ranked") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("ranked")}>
                <Tooltip><TooltipTrigger asChild><span>Ranked <SortIcon col="ranked" /></span></TooltipTrigger><TooltipContent>Number of keywords this app ranks for in search results</TooltipContent></Tooltip>
              </TableHead>}
              {isCol("similar") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("similar")}>
                <Tooltip><TooltipTrigger asChild><span>Similar <SortIcon col="similar" /></span></TooltipTrigger><TooltipContent>Number of other apps that list this app as similar</TooltipContent></Tooltip>
              </TableHead>}
              {isCol("catRank") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("catRank")}>
                Category Rank <SortIcon col="catRank" />
              </TableHead>}
              {isCol("lastChange") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("lastChange")}>
                <Tooltip><TooltipTrigger asChild><span>Last Change <SortIcon col="lastChange" /></span></TooltipTrigger><TooltipContent>Date of the most recent detected change in app listing</TooltipContent></Tooltip>
              </TableHead>}
              {canEdit && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const sorted = sortedCompetitors();
              let competitorNum = 0;
              return sorted.map((comp, idx) => {
              if (!comp.isSelf || !selfPinned) competitorNum++;
              const isPending = pendingCompetitorSlugs.has(comp.appSlug);
              const isResolved = resolvedCompetitorSlugs.has(comp.appSlug);
              return (
              <TableRow key={comp.appSlug} className={cn(
                comp.isSelf && "border-l-2 border-l-emerald-500 bg-emerald-500/10",
                isPending && "animate-in fade-in slide-in-from-top duration-300",
              )}>
                {canEdit && (
                  <TableCell className={`py-1 md:sticky md:left-0 md:z-10 ${comp.isSelf ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-background"}`}>
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
                <TableCell className={`md:sticky md:z-10 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${canEdit ? "md:left-12" : "md:left-0"} ${comp.isSelf ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-background"}`}>
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
                      {isPending && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </TableCell>
                {isCol("similarity") && <TableCell className="text-sm">
                  {isPending ? (
                    <Skeleton className="h-4 w-16" />
                  ) : isResolved ? (
                    <span className="animate-in fade-in duration-700">
                      {comp.isSelf ? "\u2014" : comp.similarityScore ? `${(parseFloat(comp.similarityScore.overall) * 100).toFixed(0)}%` : "\u2014"}
                    </span>
                  ) : comp.isSelf ? "\u2014" : comp.similarityScore ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                parseFloat(comp.similarityScore.overall) >= 0.7 ? "bg-red-500" :
                                parseFloat(comp.similarityScore.overall) >= 0.4 ? "bg-amber-500" :
                                "bg-emerald-500"
                              }`}
                              style={{ width: `${(parseFloat(comp.similarityScore.overall) * 100).toFixed(0)}%` }}
                            />
                          </div>
                          <span className="tabular-nums font-medium">
                            {(parseFloat(comp.similarityScore.overall) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs space-y-1">
                          <div>Category: {(parseFloat(comp.similarityScore.category) * 100).toFixed(0)}%</div>
                          <div>Features: {(parseFloat(comp.similarityScore.feature) * 100).toFixed(0)}%</div>
                          <div>Keywords: {(parseFloat(comp.similarityScore.keyword) * 100).toFixed(0)}%</div>
                          <div>Text: {(parseFloat(comp.similarityScore.text) * 100).toFixed(0)}%</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ) : "\u2014"}
                </TableCell>}
                {isCol("rating") && <TableCell>
                  {comp.latestSnapshot?.averageRating ?? "\u2014"}
                </TableCell>}
                {isCol("reviews") && <TableCell>
                  {comp.latestSnapshot?.ratingCount != null ? (
                    <Link href={`/apps/${comp.appSlug}/reviews`} className="text-primary hover:underline">
                      {comp.latestSnapshot.ratingCount}
                    </Link>
                  ) : "\u2014"}
                </TableCell>}
                {isCol("v7d") && <TableCell className="text-sm">
                  {isPending ? <Skeleton className="h-4 w-8" /> : isResolved ? (
                    <span className="animate-in fade-in duration-700"><VelocityCell value={comp.reviewVelocity?.v7d} /></span>
                  ) : <VelocityCell value={comp.reviewVelocity?.v7d} />}
                </TableCell>}
                {isCol("v30d") && <TableCell className="text-sm">
                  {isPending ? <Skeleton className="h-4 w-8" /> : isResolved ? (
                    <span className="animate-in fade-in duration-700"><VelocityCell value={comp.reviewVelocity?.v30d} /></span>
                  ) : <VelocityCell value={comp.reviewVelocity?.v30d} />}
                </TableCell>}
                {isCol("v90d") && <TableCell className="text-sm">
                  {isPending ? <Skeleton className="h-4 w-8" /> : isResolved ? (
                    <span className="animate-in fade-in duration-700"><VelocityCell value={comp.reviewVelocity?.v90d} /></span>
                  ) : <VelocityCell value={comp.reviewVelocity?.v90d} />}
                </TableCell>}
                {isCol("momentum") && <TableCell className="text-sm">
                  {isPending ? <Skeleton className="h-4 w-16" /> : isResolved ? (
                    <span className="animate-in fade-in duration-700"><MomentumBadge momentum={comp.reviewVelocity?.momentum} /></span>
                  ) : <MomentumBadge momentum={comp.reviewVelocity?.momentum} />}
                </TableCell>}
                {isCol("pricing") && <TableCell className="text-sm whitespace-nowrap">
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
                </TableCell>}
                {isCol("minPaidPrice") && <TableCell className="text-sm">
                  {comp.minPaidPrice != null ? (
                    <Link href={`/apps/${comp.appSlug}/details#pricing-plans`} className="text-primary hover:underline">
                      ${comp.minPaidPrice}/mo
                    </Link>
                  ) : "\u2014"}
                </TableCell>}
                {isCol("launchedDate") && <TableCell className="text-sm text-muted-foreground">
                  {comp.launchedDate ? formatDateOnly(comp.launchedDate) : "\u2014"}
                </TableCell>}
                {isCol("featured") && <TableCell className="text-sm">
                  {comp.featuredSections > 0 ? (
                    <Link href={`/apps/${comp.appSlug}/featured`} className="text-primary hover:underline">{comp.featuredSections}</Link>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>}
                {isCol("ads") && <TableCell className="text-sm">
                  {comp.adKeywords > 0 ? (
                    <Link href={`/apps/${comp.appSlug}/ads`} className="text-primary hover:underline">{comp.adKeywords}</Link>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>}
                {isCol("ranked") && <TableCell className="text-sm">
                  {comp.rankedKeywordCount > 0 ? (
                    <Link href={`/apps/${comp.appSlug}/keywords`} className="text-primary hover:underline">{comp.rankedKeywordCount}</Link>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>}
                {isCol("similar") && <TableCell className="text-sm">
                  {comp.reverseSimilarCount > 0 ? (
                    <Link href={`/apps/${comp.appSlug}/similar`} className="text-primary hover:underline">{comp.reverseSimilarCount}</Link>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>}
                {isCol("catRank") && <TableCell className="text-sm">
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
                </TableCell>}
                {isCol("lastChange") && <TableCell className="text-sm">
                  {lastChanges[comp.appSlug] ? (
                    <Link href={`/apps/${comp.appSlug}/changes`} className="text-primary hover:underline">
                      {formatDateOnly(lastChanges[comp.appSlug])}
                    </Link>
                  ) : "\u2014"}
                </TableCell>}
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
