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
  Search,
  ArrowLeft,
  Plus,
  X,
  Loader2,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface ResearchData {
  project: { id: string; name: string };
  keywords: { id: number; keyword: string; slug: string; totalResults: number | null; scrapedAt: string | null }[];
  competitors: {
    slug: string; name: string; iconUrl: string | null;
  }[];
  keywordRankings: Record<string, Record<string, number>>;
  opportunities: {
    keyword: string; slug: string; opportunityScore: number;
    room: number; demand: number; competitorCount: number; totalResults: number | null;
  }[];
}

export default function ResearchKeywordsPage() {
  const params = useParams();
  const { fetchWithAuth, user } = useAuth();
  const id = params.id as string;
  const canEdit = user?.role === "owner" || user?.role === "editor";

  const [data, setData] = useState<ResearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [adding, setAdding] = useState(false);

  // Polling
  const [pendingKeywords, setPendingKeywords] = useState<Set<number>>(new Set());
  const [resolvedKeywords, setResolvedKeywords] = useState<Set<number>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/research-projects/${id}/data`);
      if (!res.ok) return;
      const newData = await res.json();
      setData(newData);

      // Clear resolved pending keywords
      setPendingKeywords((prev) => {
        const next = new Set(prev);
        const justResolved: number[] = [];
        for (const kwId of prev) {
          const kw = newData.keywords.find((k: any) => k.id === kwId);
          if (kw?.scrapedAt) {
            next.delete(kwId);
            justResolved.push(kwId);
          }
        }
        if (justResolved.length > 0) {
          setResolvedKeywords((r) => {
            const n = new Set(r);
            justResolved.forEach((kid) => n.add(kid));
            return n;
          });
          setTimeout(() => {
            setResolvedKeywords((r) => {
              const n = new Set(r);
              justResolved.forEach((kid) => n.delete(kid));
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
    if (pendingKeywords.size > 0) {
      pollRef.current = setInterval(fetchData, 5000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pendingKeywords.size, fetchData]);

  async function handleAdd() {
    if (!input.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetchWithAuth(`/api/research-projects/${id}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: input.trim() }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.scraperEnqueued) {
          setPendingKeywords((prev) => new Set(prev).add(result.keywordId));
        }
        setInput("");
        await fetchData();
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(kwId: number) {
    const res = await fetchWithAuth(`/api/research-projects/${id}/keywords/${kwId}`, {
      method: "DELETE",
    });
    if (res.ok) await fetchData();
  }

  // Sorting
  type KwSortKey = "keyword" | "results" | "opportunity";
  const [sortKey, setSortKey] = useState<KwSortKey>("keyword");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: KwSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "keyword" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: KwSortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="inline h-3 w-3 ml-0.5 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="inline h-3 w-3 ml-0.5" /> : <ArrowDown className="inline h-3 w-3 ml-0.5" />;
  }

  const oppMap = useMemo(() => data ? new Map(data.opportunities.map((o) => [o.slug, o])) : new Map(), [data]);

  const sortedKeywords = useMemo(() => {
    if (!data) return [];
    let list = data.keywords;
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      list = list.filter((kw) => kw.keyword.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "keyword": cmp = a.keyword.localeCompare(b.keyword); break;
        case "results": cmp = (a.totalResults ?? -1) - (b.totalResults ?? -1); break;
        case "opportunity": {
          const oa = oppMap.get(a.slug)?.opportunityScore ?? -1;
          const ob = oppMap.get(b.slug)?.opportunityScore ?? -1;
          cmp = oa - ob;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, oppMap, filterQuery]);

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
          <p className="text-sm text-muted-foreground">Keywords</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" />
              Keywords
              <Badge variant="secondary" className="text-xs font-normal">{data.keywords.length}</Badge>
            </CardTitle>
            {canEdit && (
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                  placeholder="Add keyword..."
                  className="h-8 w-48 text-sm"
                  disabled={adding}
                />
                <Button size="sm" variant="outline" onClick={handleAdd} disabled={!input.trim() || adding}>
                  {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {data.keywords.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Search className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No keywords added yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter keywords..."
                  className="h-8 w-56 text-sm"
                />
                {filterQuery && (
                  <span className="text-xs text-muted-foreground">{sortedKeywords.length} results</span>
                )}
              </div>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("keyword")}>Keyword <SortIcon col="keyword" /></TableHead>
                    {data.competitors.map((comp) => (
                      <TableHead key={comp.slug} className="text-center min-w-[60px]">
                        <Link href={`/apps/${comp.slug}`} className="flex flex-col items-center gap-1 hover:opacity-80" title={comp.name}>
                          {comp.iconUrl ? (
                            <img src={comp.iconUrl} alt="" className="h-5 w-5 rounded" />
                          ) : (
                            <div className="h-5 w-5 rounded bg-muted" />
                          )}
                          <span className="text-[10px] truncate max-w-[60px]">{comp.name.split(/\s/)[0]}</span>
                        </Link>
                      </TableHead>
                    ))}
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("results")}>Results <SortIcon col="results" /></TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("opportunity")}>Opportunity <SortIcon col="opportunity" /></TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedKeywords.map((kw) => {
                    const isPending = pendingKeywords.has(kw.id);
                    const isResolved = resolvedKeywords.has(kw.id);
                    const animate = isResolved ? "animate-in fade-in duration-700" : "";
                    const opp = oppMap.get(kw.slug);
                    const rankings = data.keywordRankings[kw.slug] || {};

                    return (
                      <TableRow key={kw.id} className={isPending ? "animate-in fade-in slide-in-from-top duration-300" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Link href={`/keywords/${kw.slug}`} className="font-medium text-sm hover:underline">
                              {kw.keyword}
                            </Link>
                            {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                          </div>
                        </TableCell>
                        {data.competitors.map((comp) => (
                          <TableCell key={comp.slug} className="text-center text-sm">
                            {isPending ? (
                              <Skeleton className="h-4 w-6 mx-auto" />
                            ) : rankings[comp.slug] != null ? (
                              <span className={`font-semibold ${rankings[comp.slug] <= 3 ? "text-green-600" : rankings[comp.slug] <= 10 ? "text-foreground" : "text-muted-foreground"} ${animate}`}>
                                #{rankings[comp.slug]}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{"\u2014"}</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-right text-sm">
                          {isPending ? (
                            <Skeleton className="h-4 w-12 ml-auto" />
                          ) : (
                            <span className={animate}>{kw.totalResults?.toLocaleString() ?? "\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isPending ? (
                            <Skeleton className="h-5 w-8 ml-auto rounded-full" />
                          ) : opp ? (
                            <Badge
                              variant={opp.opportunityScore >= 60 ? "default" : "secondary"}
                              className={`${animate} ${opp.opportunityScore >= 60 ? "bg-green-600" : opp.opportunityScore >= 30 ? "bg-amber-500" : ""}`}
                            >
                              {opp.opportunityScore}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <a
                              href={`https://apps.shopify.com/search?q=${encodeURIComponent(kw.keyword)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            {canEdit && (
                              <button
                                onClick={() => handleRemove(kw.id)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
