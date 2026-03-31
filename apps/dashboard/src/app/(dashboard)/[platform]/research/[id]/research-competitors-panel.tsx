"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatMonthYear } from "@/lib/format-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  X,
  Plus,
  Star,
  Loader2,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { buildExternalAppUrl, getPlatformName } from "@/lib/platform-urls";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";
import type { ResearchData } from "./research-types";

// ─── Competitor Suggestions ──────────────────────────────────

export function CompetitorSuggestions({
  suggestions, canEdit, onAdd,
}: {
  suggestions: ResearchData["competitorSuggestions"]; canEdit: boolean;
  onAdd: (slug: string) => Promise<void>;
}) {
  const { platform } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const [addingSlug, setAddingSlug] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const INITIAL_COUNT = 10;

  async function handleAdd(slug: string) {
    setAddingSlug(slug);
    try {
      await onAdd(slug);
    } finally {
      setAddingSlug(null);
    }
  }

  const visible = expanded ? suggestions : suggestions.slice(0, INITIAL_COUNT);
  const hasMore = suggestions.length > INITIAL_COUNT;

  return (
    <div className="space-y-2">
      {visible.map((s) => (
        <div key={s.slug} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50">
          <div className="flex items-center gap-3 min-w-0">
            {s.iconUrl ? (
              <img src={s.iconUrl} alt="" className="h-8 w-8 rounded-md" />
            ) : (
              <div className="h-8 w-8 rounded-md bg-muted" />
            )}
            <div className="min-w-0">
              <Link href={`/${platform}/apps/${s.slug}`} className="font-medium text-sm truncate hover:underline block">{s.name}</Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {caps.hasReviews && s.averageRating != null && (
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    {s.averageRating.toFixed(1)}
                  </span>
                )}
                {caps.hasReviews && s.ratingCount != null && <span>({formatNumber(s.ratingCount)})</span>}
                <span className="text-muted-foreground/60">|</span>
                <span>Matches: {s.matchedKeywords.join(", ")}</span>
              </div>
            </div>
          </div>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAdd(s.slug)}
              disabled={addingSlug === s.slug}
              className="shrink-0 ml-2"
            >
              {addingSlug === s.slug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              <span className="ml-1">Add</span>
            </Button>
          )}
        </div>
      ))}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : `Show ${suggestions.length - INITIAL_COUNT} more`}
        </Button>
      )}
    </div>
  );
}

// ─── Inline App Search (header) ──────────────────────────────

export function InlineAppSearch({
  fetchWithAuth, existingSlugs, onAdd,
}: {
  fetchWithAuth: (path: string, options?: any) => Promise<Response>;
  existingSlugs: Set<string>; onAdd: (slug: string) => Promise<void>;
}) {
  const { platform } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingSlug, setAddingSlug] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleSearch(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await fetchWithAuth(`/api/apps/search?q=${encodeURIComponent(value)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(
          data
            .filter((a: any) => !existingSlugs.has(a.slug))
            .sort((a: any, b: any) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0))
        );
      }
      setSearching(false);
    }, 300);
  }

  async function handleAdd(slug: string) {
    setAddingSlug(slug);
    try {
      await onAdd(slug);
      setResults((prev) => prev.filter((r) => r.slug !== slug));
    } finally {
      setAddingSlug(null);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="h-8">
        <Search className="h-3.5 w-3.5 mr-1.5" />
        Add app
      </Button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search apps..."
        className="h-8 w-56 text-sm"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); setQuery(""); setResults([]); } }}
      />
      {(results.length > 0 || searching) && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-popover border rounded-md shadow-lg z-50 max-h-72 overflow-y-auto">
          {results.slice(0, 8).map((app) => (
            <div key={app.slug} className="flex items-center justify-between py-1.5 px-3 hover:bg-muted/50">
              <div className="flex items-center gap-2 min-w-0">
                {app.iconUrl ? (
                  <img src={app.iconUrl} alt="" className="h-6 w-6 rounded" />
                ) : (
                  <div className="h-6 w-6 rounded bg-muted" />
                )}
                <span className="text-sm truncate">{app.name}</span>
                {caps.hasReviews && app.averageRating != null && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    <Star className="h-3 w-3 inline fill-yellow-500 text-yellow-500" /> {parseFloat(app.averageRating).toFixed(1)}
                    {app.ratingCount != null && <span className="ml-1">({formatNumber(Number(app.ratingCount))})</span>}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleAdd(app.slug)}
                disabled={addingSlug === app.slug}
                className="shrink-0 ml-1"
                aria-label={`Add ${app.name}`}
              >
                {addingSlug === app.slug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
          {searching && <p className="text-xs text-muted-foreground px-3 py-2" aria-live="polite">Searching...</p>}
        </div>
      )}
    </div>
  );
}

// ─── Manual App Search ───────────────────────────────────────

export function ManualAppSearch({
  fetchWithAuth, existingSlugs, onAdd,
}: {
  fetchWithAuth: (path: string, options?: any) => Promise<Response>;
  existingSlugs: Set<string>; onAdd: (slug: string) => Promise<void>;
}) {
  const { platform } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingSlug, setAddingSlug] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleSearch(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await fetchWithAuth(`/api/apps/search?q=${encodeURIComponent(value)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(
          data
            .filter((a: any) => !existingSlugs.has(a.slug))
            .sort((a: any, b: any) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0))
        );
      }
      setSearching(false);
    }, 300);
  }

  async function handleAdd(slug: string) {
    setAddingSlug(slug);
    try {
      await onAdd(slug);
      setResults((prev) => prev.filter((r) => r.slug !== slug));
    } finally {
      setAddingSlug(null);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Search & add manually</span>
        </div>
        <div ref={containerRef}>
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search apps..."
            className="h-9"
          />
          {results.length > 0 && (
            <div className="mt-2 space-y-1">
              {results.slice(0, 8).map((app) => (
                <div key={app.slug} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2 min-w-0">
                    {app.iconUrl ? (
                      <img src={app.iconUrl} alt="" className="h-6 w-6 rounded" />
                    ) : (
                      <div className="h-6 w-6 rounded bg-muted" />
                    )}
                    <span className="text-sm truncate">{app.name}</span>
                    {caps.hasReviews && app.averageRating != null && (
                      <span className="text-xs text-muted-foreground">
                        <Star className="h-3 w-3 inline fill-yellow-500 text-yellow-500" /> {parseFloat(app.averageRating).toFixed(1)}
                        {app.ratingCount != null && <span className="ml-1">({formatNumber(Number(app.ratingCount))})</span>}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAdd(app.slug)}
                    disabled={addingSlug === app.slug}
                    aria-label={`Add ${app.name}`}
                  >
                    {addingSlug === app.slug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
          {searching && <p className="text-xs text-muted-foreground mt-2" aria-live="polite">Searching...</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Competitor Table ────────────────────────────────────────

export function CompetitorTable({
  competitors, keywordRankings, keywords, pendingCompetitors, resolvedCompetitors, canEdit, onRemove,
}: {
  competitors: ResearchData["competitors"];
  keywordRankings: ResearchData["keywordRankings"];
  keywords: ResearchData["keywords"];
  pendingCompetitors: Set<string>; resolvedCompetitors: Set<string>; canEdit: boolean;
  onRemove: (slug: string) => Promise<void>;
}) {
  const { platform } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  type CompSortKey = "name" | "rating" | "reviews" | "pricing" | "power" | "rankings" | "featured" | "similar" | "launched";
  const [sortKey, setSortKey] = useState<CompSortKey>(caps.hasReviews ? "reviews" : "name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(caps.hasReviews ? "desc" : "asc");

  function toggleSort(key: CompSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: CompSortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="inline h-3 w-3 ml-0.5 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="inline h-3 w-3 ml-0.5" /> : <ArrowDown className="inline h-3 w-3 ml-0.5" />;
  }

  const rankCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const comp of competitors) {
      let count = 0;
      for (const kwSlug of Object.keys(keywordRankings)) {
        if (keywordRankings[kwSlug]?.[comp.slug] != null) count++;
      }
      map.set(comp.slug, count);
    }
    return map;
  }, [competitors, keywordRankings]);

  const sorted = useMemo(() => {
    return [...competitors].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "rating": cmp = (a.averageRating ?? -1) - (b.averageRating ?? -1); break;
        case "reviews": cmp = (a.ratingCount ?? -1) - (b.ratingCount ?? -1); break;
        case "pricing": cmp = (a.minPaidPrice ?? -1) - (b.minPaidPrice ?? -1); break;
        case "power": cmp = (a.powerScore ?? -1) - (b.powerScore ?? -1); break;
        case "rankings": cmp = (rankCountMap.get(a.slug) ?? 0) - (rankCountMap.get(b.slug) ?? 0); break;
        case "featured": cmp = (a.featuredSections ?? 0) - (b.featuredSections ?? 0); break;
        case "similar": cmp = (a.reverseSimilarCount ?? 0) - (b.reverseSimilarCount ?? 0); break;
        case "launched": cmp = (a.launchedAt ?? "").localeCompare(b.launchedAt ?? ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [competitors, sortKey, sortDir, rankCountMap]);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")} aria-sort={sortKey === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>App <SortIcon col="name" /></TableHead>
            {caps.hasReviews && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("rating")} aria-sort={sortKey === "rating" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Rating <SortIcon col="rating" /></TableHead>}
            {caps.hasReviews && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("reviews")} aria-sort={sortKey === "reviews" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Reviews <SortIcon col="reviews" /></TableHead>}
            {caps.hasPricing && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("pricing")} aria-sort={sortKey === "pricing" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Pricing <SortIcon col="pricing" /></TableHead>}
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("power")} aria-sort={sortKey === "power" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Power <SortIcon col="power" /></TableHead>
            {keywords.length > 0 && <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("rankings")} aria-sort={sortKey === "rankings" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Rankings <SortIcon col="rankings" /></TableHead>}
            {caps.hasFeaturedSections && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("featured")} aria-sort={sortKey === "featured" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Featured <SortIcon col="featured" /></TableHead>}
            {caps.hasSimilarApps && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("similar")} aria-sort={sortKey === "similar" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Similar <SortIcon col="similar" /></TableHead>}
            <TableHead>Categories</TableHead>
            {caps.hasLaunchedDate && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("launched")} aria-sort={sortKey === "launched" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Launched <SortIcon col="launched" /></TableHead>}
            {canEdit && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((comp) => {
            const isPending = pendingCompetitors.has(comp.slug);
            const isResolved = resolvedCompetitors.has(comp.slug);
            const animate = isResolved ? "animate-in fade-in duration-700" : "";
            const rankCount = rankCountMap.get(comp.slug) ?? 0;

            return (
              <TableRow key={comp.slug} className={isPending ? "animate-in fade-in slide-in-from-top duration-300" : ""}>
                <TableCell className="max-w-[260px]">
                  <div className="flex items-center gap-2">
                    {comp.iconUrl ? (
                      <img src={comp.iconUrl} alt="" className="h-7 w-7 rounded shrink-0" />
                    ) : (
                      <div className="h-7 w-7 rounded bg-muted shrink-0" />
                    )}
                    <Link href={`/${platform}/apps/${comp.slug}`} className="font-medium text-sm hover:underline truncate">
                      {comp.name}
                    </Link>
                    {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
                  </div>
                </TableCell>
                {caps.hasReviews && (
                  <TableCell className="text-right">
                    {isPending ? (
                      <Skeleton className="h-4 w-10 ml-auto" />
                    ) : comp.averageRating != null ? (
                      <span className={`flex items-center justify-end gap-1 ${animate}`}>
                        <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                        {comp.averageRating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{"\u2014"}</span>
                    )}
                  </TableCell>
                )}
                {caps.hasReviews && (
                  <TableCell className="text-right">
                    {isPending ? (
                      <Skeleton className="h-4 w-12 ml-auto" />
                    ) : (
                      <span className={animate}>{comp.ratingCount != null ? formatNumber(comp.ratingCount) : "\u2014"}</span>
                    )}
                  </TableCell>
                )}
                {caps.hasPricing && (
                  <TableCell className="text-right text-sm">
                    {isPending ? (
                      <Skeleton className="h-4 w-14 ml-auto" />
                    ) : (
                      <span className={animate}>
                        {comp.minPaidPrice != null
                          ? `$${comp.minPaidPrice}/mo`
                          : comp.pricingHint || "\u2014"}
                      </span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  {isPending ? (
                    <Skeleton className="h-5 w-8 ml-auto rounded-full" />
                  ) : comp.powerScore != null ? (
                    <span className={animate}>
                      <Badge variant={comp.powerScore >= 70 ? "default" : "secondary"}>
                        {comp.powerScore}
                      </Badge>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>
                {keywords.length > 0 && (
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {isPending ? (
                      <Skeleton className="h-4 w-12 mx-auto" />
                    ) : (
                      <span className={animate}>{rankCount > 0 ? `${rankCount}/${keywords.length} kw` : "\u2014"}</span>
                    )}
                  </TableCell>
                )}
                {caps.hasFeaturedSections && (
                  <TableCell className="text-right text-sm">
                    {isPending ? (
                      <Skeleton className="h-4 w-6 ml-auto" />
                    ) : comp.featuredSections > 0 ? (
                      <Link href={`/${platform}/apps/${comp.slug}/featured`} className={`text-primary hover:underline ${animate}`}>{comp.featuredSections}</Link>
                    ) : (
                      <span className="text-muted-foreground">{"\u2014"}</span>
                    )}
                  </TableCell>
                )}
                {caps.hasSimilarApps && (
                  <TableCell className="text-right text-sm">
                    {isPending ? (
                      <Skeleton className="h-4 w-6 ml-auto" />
                    ) : comp.reverseSimilarCount > 0 ? (
                      <Link href={`/${platform}/apps/${comp.slug}/similar`} className={`text-primary hover:underline ${animate}`}>{comp.reverseSimilarCount}</Link>
                    ) : (
                      <span className="text-muted-foreground">{"\u2014"}</span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  {isPending ? (
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  ) : comp.categoryRankings?.length > 0 ? (
                    <div className={`space-y-1 ${animate}`}>
                      {comp.categoryRankings.slice(0, 3).map((cr) => {
                        const leafName = cr.breadcrumb.includes(" > ") ? cr.breadcrumb.split(" > ").pop() : cr.breadcrumb;
                        return (
                          <Link
                            key={cr.slug}
                            href={`/${platform}/categories/${cr.slug}`}
                            className="block text-[11px] leading-tight hover:underline"
                            title={cr.breadcrumb}
                          >
                            <span className="text-muted-foreground">{leafName}</span>
                            {cr.totalApps != null ? (
                              <span className="ml-1 font-medium text-primary">(#{cr.position}/{cr.totalApps})</span>
                            ) : (
                              <span className="ml-1 font-medium text-primary">(#{cr.position})</span>
                            )}
                          </Link>
                        );
                      })}
                      {comp.categoryRankings.length > 3 && (
                        <span className="text-[11px] text-muted-foreground">
                          +{comp.categoryRankings.length - 3} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>
                {caps.hasLaunchedDate && (
                  <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                    {isPending ? (
                      <Skeleton className="h-4 w-16 ml-auto" />
                    ) : (
                      <span className={animate}>
                        {comp.launchedAt
                          ? formatMonthYear(comp.launchedAt)
                          : "\u2014"}
                      </span>
                    )}
                  </TableCell>
                )}
                {canEdit && (
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <a
                        href={buildExternalAppUrl(platform as PlatformId, comp.slug, comp.externalId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title={`View on ${getPlatformName(platform as PlatformId)}`}
                        aria-label={`View ${comp.name} on ${getPlatformName(platform as PlatformId)}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={() => onRemove(comp.slug)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label={`Remove ${comp.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
