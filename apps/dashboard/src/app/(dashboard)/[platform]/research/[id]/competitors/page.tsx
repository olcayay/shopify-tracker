"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  ArrowLeft,
  Plus,
  X,
  Loader2,
  Star,
  Search,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { buildExternalAppUrl, getPlatformName } from "@/lib/platform-urls";
import type { PlatformId } from "@appranks/shared";

interface Competitor {
  slug: string; name: string; iconUrl: string | null;
  averageRating: number | null; ratingCount: number | null;
  pricingHint: string | null; minPaidPrice: number | null;
  powerScore: number | null; features: string[];
  categoryRankings: { slug: string; breadcrumb: string; position: number; totalApps: number | null }[];
  launchedAt: string | null;
  featuredSections: number;
  reverseSimilarCount: number;
}

interface ResearchData {
  project: { id: string; name: string };
  keywords: { id: number; keyword: string; slug: string; totalResults: number | null; scrapedAt: string | null }[];
  competitors: Competitor[];
  keywordRankings: Record<string, Record<string, number>>;
}

export default function ResearchCompetitorsPage() {
  const params = useParams();
  const { fetchWithAuth, user } = useAuth();
  const id = params.id as string;
  const platform = params.platform as PlatformId;
  const canEdit = user?.role === "owner" || user?.role === "editor";

  const [data, setData] = useState<ResearchData | null>(null);
  const [loading, setLoading] = useState(true);

  // Inline search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingSlug, setAddingSlug] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Polling
  const [pendingCompetitors, setPendingCompetitors] = useState<Set<string>>(new Set());
  const [resolvedCompetitors, setResolvedCompetitors] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/research-projects/${id}/data`);
      if (!res.ok) return;
      const newData = await res.json();
      setData(newData);

      setPendingCompetitors((prev) => {
        const next = new Set(prev);
        const justResolved: string[] = [];
        for (const slug of prev) {
          const comp = newData.competitors.find((c: any) => c.slug === slug);
          if (comp?.averageRating != null) {
            next.delete(slug);
            justResolved.push(slug);
          }
        }
        if (justResolved.length > 0) {
          setResolvedCompetitors((r) => {
            const n = new Set(r);
            justResolved.forEach((s) => n.add(s));
            return n;
          });
          setTimeout(() => {
            setResolvedCompetitors((r) => {
              const n = new Set(r);
              justResolved.forEach((s) => n.delete(s));
              return n;
            });
          }, 2000);
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [id, fetchWithAuth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (pendingCompetitors.size > 0) {
      pollRef.current = setInterval(fetchData, 5000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pendingCompetitors.size, fetchData]);

  // Close search on outside click
  useEffect(() => {
    if (!searchOpen) return;
    function handleClick(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [searchOpen]);

  function handleSearch(value: string) {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await fetchWithAuth(`/api/apps/search?q=${encodeURIComponent(value)}`);
      if (res.ok) {
        const apps = await res.json();
        const existingSlugs = new Set(data?.competitors.map((c) => c.slug) || []);
        setSearchResults(
          apps
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
      const res = await fetchWithAuth(`/api/research-projects/${id}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.scraperEnqueued) {
          setPendingCompetitors((prev) => new Set(prev).add(slug));
        }
        setSearchResults((prev) => prev.filter((r) => r.slug !== slug));
        await fetchData();
      }
    } finally {
      setAddingSlug(null);
    }
  }

  async function handleRemove(slug: string) {
    const res = await fetchWithAuth(`/api/research-projects/${id}/competitors/${slug}`, {
      method: "DELETE",
    });
    if (res.ok) await fetchData();
  }

  // Sorting
  type CompSortKey = "name" | "rating" | "reviews" | "pricing" | "power" | "rankings" | "featured" | "similar" | "launched";
  const [sortKey, setSortKey] = useState<CompSortKey>("reviews");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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
    if (!data) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const comp of data.competitors) {
      let count = 0;
      for (const kwSlug of Object.keys(data.keywordRankings)) {
        if (data.keywordRankings[kwSlug]?.[comp.slug] != null) count++;
      }
      map.set(comp.slug, count);
    }
    return map;
  }, [data]);

  const sortedCompetitors = useMemo(() => {
    if (!data) return [];
    return [...data.competitors].sort((a, b) => {
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
  }, [data, sortKey, sortDir, rankCountMap]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground">Project not found.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/research/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{data.project.name}</h1>
          <p className="text-sm text-muted-foreground">Competitors</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Competitors
              <Badge variant="secondary" className="text-xs font-normal">{data.competitors.length}</Badge>
            </CardTitle>
            {canEdit && (
              <div ref={searchContainerRef} className="relative">
                {!searchOpen ? (
                  <Button size="sm" variant="outline" onClick={() => setSearchOpen(true)} className="h-8">
                    <Search className="h-3.5 w-3.5 mr-1.5" />
                    Add app
                  </Button>
                ) : (
                  <>
                    <Input
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Search apps..."
                      className="h-8 w-56 text-sm"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); setSearchResults([]); } }}
                    />
                    {(searchResults.length > 0 || searching) && (
                      <div className="absolute right-0 top-full mt-1 w-80 bg-popover border rounded-md shadow-lg z-50 max-h-72 overflow-y-auto">
                        {searchResults.slice(0, 8).map((app) => (
                          <div key={app.slug} className="flex items-center justify-between py-1.5 px-3 hover:bg-muted/50">
                            <div className="flex items-center gap-2 min-w-0">
                              {app.iconUrl ? (
                                <img src={app.iconUrl} alt="" className="h-6 w-6 rounded" />
                              ) : (
                                <div className="h-6 w-6 rounded bg-muted" />
                              )}
                              <span className="text-sm truncate">{app.name}</span>
                              {app.averageRating != null && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  <Star className="h-3 w-3 inline fill-yellow-500 text-yellow-500" /> {parseFloat(app.averageRating).toFixed(1)}
                                  {app.ratingCount != null && <span className="ml-1">({Number(app.ratingCount).toLocaleString()})</span>}
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAdd(app.slug)}
                              disabled={addingSlug === app.slug}
                              className="shrink-0 ml-1"
                            >
                              {addingSlug === app.slug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        ))}
                        {searching && <p className="text-xs text-muted-foreground px-3 py-2">Searching...</p>}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {data.competitors.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No competitors added yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>App <SortIcon col="name" /></TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("rating")}>Rating <SortIcon col="rating" /></TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("reviews")}>Reviews <SortIcon col="reviews" /></TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("pricing")}>Pricing <SortIcon col="pricing" /></TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("power")}>Power <SortIcon col="power" /></TableHead>
                    <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("rankings")}>Keywords Ranked <SortIcon col="rankings" /></TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("featured")}>Featured <SortIcon col="featured" /></TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("similar")}>Similar <SortIcon col="similar" /></TableHead>
                    <TableHead>Categories</TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("launched")}>Launched <SortIcon col="launched" /></TableHead>
                    {canEdit && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCompetitors.map((comp) => {
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
                            <Link href={`/apps/${comp.slug}`} className="font-medium text-sm hover:underline truncate">
                              {comp.name}
                            </Link>
                            {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                          </div>
                        </TableCell>
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
                        <TableCell className="text-right">
                          {isPending ? (
                            <Skeleton className="h-4 w-12 ml-auto" />
                          ) : (
                            <span className={animate}>
                              {comp.ratingCount != null ? (
                                <Link href={`/apps/${comp.slug}/reviews`} className="hover:underline">
                                  {comp.ratingCount.toLocaleString()}
                                </Link>
                              ) : "\u2014"}
                            </span>
                          )}
                        </TableCell>
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
                        <TableCell className="text-center text-sm">
                          {isPending ? (
                            <Skeleton className="h-4 w-12 mx-auto" />
                          ) : (
                            <span className={`text-muted-foreground ${animate}`}>
                              {rankCount > 0 ? `${rankCount}/${data.keywords.length}` : "\u2014"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {isPending ? (
                            <Skeleton className="h-4 w-6 ml-auto" />
                          ) : comp.featuredSections > 0 ? (
                            <Link href={`/apps/${comp.slug}/featured`} className={`text-primary hover:underline ${animate}`}>
                              {comp.featuredSections}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {isPending ? (
                            <Skeleton className="h-4 w-6 ml-auto" />
                          ) : comp.reverseSimilarCount > 0 ? (
                            <Link href={`/apps/${comp.slug}/similar`} className={`text-primary hover:underline ${animate}`}>
                              {comp.reverseSimilarCount}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isPending ? (
                            <div className="space-y-1">
                              <Skeleton className="h-3 w-32" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          ) : comp.categoryRankings?.length > 0 ? (
                            <div className={`space-y-1 ${animate}`}>
                              {comp.categoryRankings.map((cr) => {
                                const leafName = cr.breadcrumb.includes(" > ") ? cr.breadcrumb.split(" > ").pop() : cr.breadcrumb;
                                return (
                                  <Link
                                    key={cr.slug}
                                    href={`/categories/${cr.slug}`}
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
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                          {isPending ? (
                            <Skeleton className="h-4 w-16 ml-auto" />
                          ) : (
                            <span className={animate}>
                              {comp.launchedAt
                                ? new Date(comp.launchedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                                : "\u2014"}
                            </span>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex items-center gap-0.5">
                              <a
                                href={buildExternalAppUrl(platform, comp.slug)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                title={`View on ${getPlatformName(platform)}`}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                              <button
                                onClick={() => handleRemove(comp.slug)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
