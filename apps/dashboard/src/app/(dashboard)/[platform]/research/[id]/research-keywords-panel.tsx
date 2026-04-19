"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  X,
  Plus,
  Loader2,
  ExternalLink,
} from "lucide-react";
import Link from "@/components/ui/link";
import { LiveSearchTrigger } from "@/components/live-search-trigger";
import { buildExternalSearchUrl, getPlatformName } from "@/lib/platform-urls";
import { type PlatformId } from "@appranks/shared";
import { type ResearchData, toSlug } from "./research-types";

export function KeywordsSection({
  projectId, data, canEdit, pendingKeywords, resolvedKeywords, onAdd, onRemove,
}: {
  projectId: string; data: ResearchData; canEdit: boolean; pendingKeywords: Set<number>; resolvedKeywords: Set<number>;
  onAdd: (keyword: string) => Promise<void>; onRemove: (kwId: number) => Promise<void>;
}) {
  const { platform } = useParams();
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
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

  async function handleAdd() {
    if (!input.trim() || adding) return;
    setAdding(true);
    try {
      await onAdd(input.trim());
      setInput("");
    } finally {
      setAdding(false);
    }
  }

  const isEmpty = data.keywords.length === 0;

  return (
    <Card id="section-keywords" className="scroll-mt-6">
      {isEmpty ? (
        <CardContent className="py-12">
          <div className="flex flex-col items-center text-center">
            <Search className="h-10 w-10 text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold mb-1">What market are you exploring?</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Start with keywords your potential customers would search for in the Shopify App Store.
            </p>
            {canEdit && (
              <div className="flex gap-2 w-full max-w-md">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                  placeholder='e.g. "live chat", "email marketing"'
                  disabled={adding}
                />
                <Button onClick={handleAdd} disabled={!input.trim() || adding} aria-label="Add keyword">
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      ) : (
        <>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4" />
                <Link href={`/${platform}/research/${projectId}/keywords`} className="hover:underline">Keywords</Link>
                <Badge variant="secondary" className="text-xs font-normal">{data.keywords.length}</Badge>
              </CardTitle>
              {canEdit && (
                <div ref={containerRef}>
                  {!open ? (
                    <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="h-8">
                      <Search className="h-3.5 w-3.5 mr-1.5" />
                      Add keyword
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAdd();
                          if (e.key === "Escape") { setOpen(false); setInput(""); }
                        }}
                        placeholder="Type keyword and press Enter..."
                        className="h-8 w-56 text-sm"
                        disabled={adding}
                        autoFocus
                      />
                      {adding && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.keywords.map((kw) => {
                const isPending = pendingKeywords.has(kw.id);
                const isResolved = resolvedKeywords.has(kw.id);
                return (
                  <Badge
                    key={kw.id}
                    variant="secondary"
                    className={`text-sm px-3 py-1 ${isPending ? "animate-in fade-in slide-in-from-top duration-300" : ""}`}
                  >
                    <Link href={`/${platform}/keywords/${kw.slug}`} className="hover:underline">
                      {kw.keyword}
                    </Link>
                    {isPending ? (
                      <Loader2 className="ml-1.5 h-3 w-3 animate-spin text-muted-foreground" />
                    ) : kw.totalResults != null ? (
                      <span className={`ml-1.5 text-xs text-muted-foreground ${isResolved ? "animate-in fade-in duration-700" : ""}`}>
                        ({kw.totalResults})
                      </span>
                    ) : null}
                    {canEdit && (
                      <button
                        onClick={() => onRemove(kw.id)}
                        className="ml-1.5 hover:text-destructive transition-colors"
                        aria-label={`Remove keyword "${kw.keyword}"`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}

export function KeywordSuggestions({
  suggestions, canEdit, fetchWithAuth, onAdd,
}: {
  suggestions: ResearchData["keywordSuggestions"]; canEdit: boolean;
  fetchWithAuth: (path: string, options?: any) => Promise<Response>;
  onAdd: (keyword: string) => Promise<void>;
}) {
  const { platform } = useParams();
  const router = useRouter();
  const [addingKw, setAddingKw] = useState<string | null>(null);
  const [ensuringKw, setEnsuringKw] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const INITIAL_COUNT = 15;

  async function handleAdd(keyword: string) {
    setAddingKw(keyword);
    try {
      await onAdd(keyword);
    } finally {
      setAddingKw(null);
    }
  }

  async function handleKeywordClick(e: React.MouseEvent, s: ResearchData["keywordSuggestions"][0]) {
    if (s.slug) return; // tracked keyword — let the Link handle it
    e.preventDefault();
    setEnsuringKw(s.keyword);
    try {
      const res = await fetchWithAuth("/api/keywords/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: s.keyword }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/${platform}/keywords/${data.slug}`);
      }
    } finally {
      setEnsuringKw(null);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return suggestions;
    const q = search.toLowerCase();
    return suggestions.filter((s) => s.keyword.toLowerCase().includes(q));
  }, [suggestions, search]);

  const visible = search ? filtered : (expanded ? filtered : filtered.slice(0, INITIAL_COUNT));
  const hasMore = !search && filtered.length > INITIAL_COUNT;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter suggestions..."
          className="h-8 w-56 text-sm"
        />
        {search && (
          <span className="text-xs text-muted-foreground">{filtered.length} results</span>
        )}
      </div>
      <div className="space-y-1">
        {visible.map((s) => (
          <div key={s.keyword} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <Link
                href={`/${platform}/keywords/${s.slug || toSlug(s.keyword)}`}
                className="text-sm font-medium hover:underline"
                onClick={(e) => handleKeywordClick(e, s)}
              >
                {ensuringKw === s.keyword ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    &ldquo;{s.keyword}&rdquo;
                  </span>
                ) : (
                  <>&ldquo;{s.keyword}&rdquo;</>
                )}
              </Link>
              <span className="text-xs text-muted-foreground">
                {s.competitorCount} competitor{s.competitorCount !== 1 ? "s" : ""} rank
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {s.source}
              </Badge>
            </div>
            <div className="flex items-center gap-0.5">
              <LiveSearchTrigger keyword={s.keyword} variant="icon" />
              <a
                href={buildExternalSearchUrl(platform as PlatformId, s.keyword)}
                target="_blank"
                rel="noopener noreferrer"
                title={`Search "${s.keyword}" on ${getPlatformName(platform as PlatformId)}`}
                aria-label={`Search "${s.keyword}" on ${getPlatformName(platform as PlatformId)}`}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAdd(s.keyword)}
                  disabled={addingKw === s.keyword}
                  aria-label={`Add keyword "${s.keyword}"`}
                >
                  {addingKw === s.keyword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          </div>
        ))}
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Show less" : `Show ${filtered.length - INITIAL_COUNT} more`}
          </Button>
        )}
      </div>
    </div>
  );
}
