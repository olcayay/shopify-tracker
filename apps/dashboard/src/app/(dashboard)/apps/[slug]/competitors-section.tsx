"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFormatDate } from "@/lib/format-date";
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
import { X, Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronUp, ChevronDown } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";

type SortKey = "order" | "name" | "rating" | "reviews" | "pricing" | "minPaidPrice" | "launchedDate" | "lastChange" | "featured" | "ads" | "ranked" | "similar";
type SortDir = "asc" | "desc";

export function CompetitorsSection({ appSlug }: { appSlug: string }) {
  const { fetchWithAuth, user, account, refreshUser } = useAuth();
  const { formatDateOnly } = useFormatDate();
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [lastChanges, setLastChanges] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<{
    slug: string;
    name: string;
  } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [sortKey, setSortKey] = useState<SortKey>("order");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [reordering, setReordering] = useState(false);

  const canEdit = user?.role === "owner" || user?.role === "editor";

  useEffect(() => {
    loadCompetitors();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  function handleSearchInput(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await fetchWithAuth(
        `/api/apps/search?q=${encodeURIComponent(value)}`
      );
      if (res.ok) {
        setSuggestions(await res.json());
        setShowSuggestions(true);
      }
      setSearchLoading(false);
    }, 300);
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
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
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
    // Always keep self row at the top
    const self = competitors.filter((c) => c.isSelf);
    const rest = competitors.filter((c) => !c.isSelf);
    return [...self, ...rest.sort((a, b) => {
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
      }
      return sortDir === "asc" ? cmp : -cmp;
    })];
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "order" ? "asc" : "desc");
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

      {canEdit && (
        <div ref={searchRef} className="relative max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search apps to add as competitor..."
              value={query}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() =>
                suggestions.length > 0 && setShowSuggestions(true)
              }
              className="pl-9"
            />
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
              {suggestions.map((s) => (
                <button
                  key={s.slug}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                  onClick={() => {
                    if (competitorSlugs.has(s.slug) || s.slug === appSlug)
                      return;
                    addCompetitor(s.slug, s.name);
                  }}
                >
                  <span>
                    {s.name}
                    {s.averageRating != null && (
                      <span className="text-muted-foreground ml-1">
                        ({Number(s.averageRating).toFixed(1)} /{" "}
                        {s.ratingCount?.toLocaleString() ?? 0})
                      </span>
                    )}
                  </span>
                  {s.slug === appSlug ? (
                    <span className="text-xs text-muted-foreground">
                      This app
                    </span>
                  ) : competitorSlugs.has(s.slug) ? (
                    <span className="text-xs text-muted-foreground">
                      Competitor
                    </span>
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}
          {showSuggestions &&
            query.length >= 1 &&
            suggestions.length === 0 &&
            !searchLoading && (
              <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md p-3 text-sm text-muted-foreground">
                No apps found
              </div>
            )}
        </div>
      )}

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
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("pricing")}>
                Pricing <SortIcon col="pricing" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("minPaidPrice")}>
                Min. Paid <SortIcon col="minPaidPrice" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("launchedDate")}>
                Launched <SortIcon col="launchedDate" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("featured")}>
                Featured <SortIcon col="featured" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("ads")}>
                Ads <SortIcon col="ads" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("ranked")}>
                Ranked <SortIcon col="ranked" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("similar")}>
                Similar <SortIcon col="similar" />
              </TableHead>
              <TableHead>Categories</TableHead>
              <TableHead>Cat. Rank</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("lastChange")}>
                Last Change <SortIcon col="lastChange" />
              </TableHead>
              {canEdit && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCompetitors().map((comp, idx) => (
              <TableRow key={comp.appSlug} className={comp.isSelf ? "border-l-2 border-l-emerald-500 bg-emerald-500/10" : ""}>
                {canEdit && (
                  <TableCell className="py-1">
                    {comp.isSelf ? (
                      <span />
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
                      <span className="text-xs text-muted-foreground">{idx + 1 - (competitors.some((c) => c.isSelf) ? 1 : 0)}</span>
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
                  {comp.latestSnapshot?.pricing ?? "\u2014"}
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
                    return (
                      <div className="space-y-0.5">
                        {primary && <div>{primary.slug ? <Link href={`/categories/${primary.slug}`} className="text-primary hover:underline">{primary.title}</Link> : primary.title}</div>}
                        {secondary && <div className="text-muted-foreground">{secondary.slug ? <Link href={`/categories/${secondary.slug}`} className="hover:underline">{secondary.title}</Link> : secondary.title}</div>}
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-sm">
                  {comp.categoryRankings?.length > 0 ? (
                    <div className="space-y-0.5">
                      {comp.categoryRankings.map((cr: any) => (
                        <div key={cr.categorySlug}>
                          <span className="font-medium">#{cr.position}</span>
                          <Link href={`/categories/${cr.categorySlug}`} className="text-muted-foreground hover:underline ml-1">{cr.categoryTitle}</Link>
                        </div>
                      ))}
                    </div>
                  ) : "\u2014"}
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
                  </TableCell>
                )}
              </TableRow>
            ))}
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
