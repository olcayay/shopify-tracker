"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Sparkles, Plus, Check, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface CategoryRank {
  categorySlug: string;
  position: number;
}

interface SimilarityScores {
  overall: number;
  category: number;
  feature: number;
  keyword: number;
  text: number;
}

interface CompetitorSuggestion {
  appSlug: string;
  appName: string;
  iconUrl: string | null;
  averageRating: string | null;
  ratingCount: number | null;
  pricingHint: string | null;
  isBuiltForShopify: boolean;
  isAlreadyCompetitor: boolean;
  similarity: SimilarityScores;
  categoryRanks: CategoryRank[];
  isShopifySimilar: boolean;
}

interface SuggestionsResponse {
  suggestions: CompetitorSuggestion[];
}

function ShimmerRow() {
  return (
    <div className="px-3 py-2.5 border-b last:border-0 space-y-1.5">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 bg-muted rounded animate-pulse shrink-0" />
        <div className="h-4 w-44 bg-muted rounded animate-pulse" />
        <div className="flex-1" />
        <div className="h-4 w-20 bg-muted rounded animate-pulse shrink-0" />
        <div className="h-6 w-6 bg-muted rounded animate-pulse shrink-0" />
      </div>
      <div className="flex items-center gap-2 pl-[42px]">
        <div className="h-3 w-16 bg-muted rounded animate-pulse" />
        <div className="h-3 w-12 bg-muted rounded animate-pulse" />
        <div className="h-3 w-24 bg-muted rounded animate-pulse" />
      </div>
    </div>
  );
}

function similarityColor(score: number): string {
  if (score >= 0.7) return "bg-red-500";
  if (score >= 0.4) return "bg-amber-500";
  return "bg-emerald-500";
}

export function CompetitorSuggestions({
  appSlug,
  competitorSlugs,
  onCompetitorAdded,
  prominent = false,
}: {
  appSlug: string;
  competitorSlugs: Set<string>;
  onCompetitorAdded: (slug: string, name: string) => void;
  prominent?: boolean;
}) {
  const { fetchWithAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SuggestionsResponse | null>(null);
  const [error, setError] = useState("");
  const [addedSlugs, setAddedSlugs] = useState<Set<string>>(new Set());
  const [addingSlug, setAddingSlug] = useState<string | null>(null);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitor-suggestions?limit=30`
      );
      if (res.ok) {
        setData(await res.json());
      } else {
        setError("Failed to load suggestions");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load");
    }
    setLoading(false);
  }, [appSlug, fetchWithAuth]);

  // Auto-open and fetch when prominent (empty state)
  useEffect(() => {
    if (prominent && !open) {
      setOpen(true);
      if (!data && !loading) {
        loadSuggestions();
      }
    }
  }, [prominent]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleToggle() {
    if (!open && !data && !loading) {
      loadSuggestions();
    }
    setOpen(!open);
  }

  async function addCompetitor(suggestion: CompetitorSuggestion) {
    setAddingSlug(suggestion.appSlug);
    setError("");
    try {
      const res = await fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors`,
        { method: "POST", body: JSON.stringify({ slug: suggestion.appSlug }) }
      );
      if (res.ok) {
        setAddedSlugs((prev) => new Set([...prev, suggestion.appSlug]));
        onCompetitorAdded(suggestion.appSlug, suggestion.appName);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Failed to add competitor (${res.status})`);
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    }
    setAddingSlug(null);
  }

  const isAdded = (s: CompetitorSuggestion) =>
    s.isAlreadyCompetitor ||
    competitorSlugs.has(s.appSlug) ||
    addedSlugs.has(s.appSlug);

  return (
    <div>
      {prominent && !open && (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-sm text-muted-foreground">
            No competitors added yet.
          </p>
          <Button onClick={handleToggle} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Suggest competitors
          </Button>
          <p className="text-xs text-muted-foreground">
            Or use the search above to add competitors manually.
          </p>
        </div>
      )}
      {!prominent && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggle}
          className="gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-950"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Suggest competitors
          {open ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </Button>
      )}

      {open && (
        <div className="mt-2 border rounded-lg overflow-hidden bg-background">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                Competitor Suggestions
              </span>
              {data && (
                <Badge variant="secondary" className="text-xs">
                  {data.suggestions.length}
                </Badge>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[500px] overflow-auto">
            {loading ? (
              <>
                <ShimmerRow />
                <ShimmerRow />
                <ShimmerRow />
                <ShimmerRow />
                <ShimmerRow />
              </>
            ) : error ? (
              <div className="px-4 py-8 text-center text-sm text-destructive">
                {error}
              </div>
            ) : data && data.suggestions.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No suggestions available. The app may not have category data yet.
              </div>
            ) : data ? (
              data.suggestions.map((s) => (
                <div
                  key={s.appSlug}
                  className="px-3 py-2.5 border-b last:border-0 hover:bg-accent/50 transition-colors"
                >
                  {/* Row 1: Icon + Name + Rating + Actions */}
                  <div className="flex items-center gap-2.5">
                    {s.iconUrl ? (
                      <img
                        src={s.iconUrl}
                        alt=""
                        className="h-8 w-8 rounded shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted shrink-0" />
                    )}

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/apps/${s.appSlug}`}
                        className="text-sm font-medium text-primary hover:underline truncate block"
                      >
                        {s.appName}
                      </Link>
                    </div>

                    {/* Rating — close to name */}
                    {s.averageRating && (
                      <span className="text-sm tabular-nums shrink-0 flex items-center gap-1">
                        <span className="text-amber-500">&#9733;</span>
                        <span className="font-medium">{parseFloat(s.averageRating).toFixed(1)}</span>
                        {s.ratingCount != null && (
                          <span className="text-xs text-muted-foreground">({s.ratingCount.toLocaleString()})</span>
                        )}
                      </span>
                    )}

                    {/* Shopify link */}
                    <a
                      href={`https://apps.shopify.com/${s.appSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-accent shrink-0"
                      title="View on Shopify"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>

                    {/* Add / Added */}
                    {isAdded(s) ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Check className="h-3.5 w-3.5" />
                        Added
                      </div>
                    ) : (
                      <button
                        onClick={() => addCompetitor(s)}
                        disabled={addingSlug === s.appSlug}
                        className="p-1 rounded hover:bg-accent shrink-0"
                        title={`Add "${s.appName}" as competitor`}
                      >
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>

                  {/* Row 2: Badges + Similarity + Category ranks + Pricing */}
                  <div className="flex items-center gap-2 mt-1 pl-[42px] flex-wrap">
                    {/* Badges */}
                    {s.isBuiltForShopify && (
                      <span title="Built for Shopify" className="text-[11px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
                        Built for Shopify
                      </span>
                    )}
                    {s.isShopifySimilar && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                            Similar
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Listed as similar app by Shopify</TooltipContent>
                      </Tooltip>
                    )}

                    {/* Similarity score */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${similarityColor(s.similarity.overall)}`}
                              style={{ width: `${(s.similarity.overall * 100).toFixed(0)}%` }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {(s.similarity.overall * 100).toFixed(0)}%
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs space-y-1">
                          <div>Category: {(s.similarity.category * 100).toFixed(0)}%</div>
                          <div>Features: {(s.similarity.feature * 100).toFixed(0)}%</div>
                          <div>Keywords: {(s.similarity.keyword * 100).toFixed(0)}%</div>
                          <div>Text: {(s.similarity.text * 100).toFixed(0)}%</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>

                    {/* Category rank badges */}
                    {s.categoryRanks.slice(0, 2).map((cr) => (
                      <Tooltip key={cr.categorySlug}>
                        <TooltipTrigger asChild>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground tabular-nums">
                            #{cr.position}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          #{cr.position} in {cr.categorySlug}
                        </TooltipContent>
                      </Tooltip>
                    ))}

                    {/* Pricing */}
                    {s.pricingHint && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        {s.pricingHint}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : null}
          </div>

          {/* Footer — similarity weights legend */}
          {data && data.suggestions.length > 0 && (
            <div className="px-3 py-1.5 border-t bg-muted/30 text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
              <span className="font-medium">Similarity weights:</span>
              <span>Category(25%)</span>
              <span>Features(25%)</span>
              <span>Keywords(25%)</span>
              <span>Text(25%)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
