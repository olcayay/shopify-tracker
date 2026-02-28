"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Sparkles, Plus, Check, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Suggestion {
  keyword: string;
  score: number;
  count: number;
  tracked: boolean;
  sources?: Array<{ field: string; weight: number }>;
}

interface SuggestionsResponse {
  suggestions: Suggestion[];
  weights?: Record<string, number>;
  metadata?: { appName: string; totalCandidates: number; afterFiltering: number };
}

function ShimmerRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b last:border-0">
      <div className="h-4 w-48 bg-muted rounded animate-pulse" />
      <div className="flex-1" />
      <div className="h-4 w-12 bg-muted rounded animate-pulse shrink-0" />
      <div className="h-4 w-8 bg-muted rounded animate-pulse shrink-0" />
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  subtitle: "Subtitle",
  introduction: "Intro",
  categories: "Categories",
  features: "Features",
  description: "Description",
  categoryFeatures: "Cat. Features",
};

export function MetadataKeywordSuggestions({
  appSlug,
  trackedKeywords,
  onKeywordAdded,
  prominent = false,
}: {
  appSlug: string;
  trackedKeywords: Set<string>;
  onKeywordAdded: (keywordId?: number, scraperEnqueued?: boolean) => void;
  prominent?: boolean;
}) {
  const { fetchWithAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SuggestionsResponse | null>(null);
  const [error, setError] = useState("");
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());
  const [addingKeyword, setAddingKeyword] = useState<string | null>(null);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/keyword-suggestions?debug=true&limit=100`
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

  async function addKeyword(keyword: string) {
    setAddingKeyword(keyword);
    setError("");
    try {
      const res = await fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/keywords`,
        { method: "POST", body: JSON.stringify({ keyword }) }
      );
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddedKeywords((prev) => new Set([...prev, keyword.toLowerCase()]));
        onKeywordAdded(data.keywordId, data.scraperEnqueued);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Failed to add keyword (${res.status})`);
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    }
    setAddingKeyword(null);
  }

  const isTracked = (s: Suggestion) =>
    s.tracked ||
    trackedKeywords.has(s.keyword.toLowerCase()) ||
    addedKeywords.has(s.keyword.toLowerCase());

  return (
    <div>
      {prominent && !open && (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-sm text-muted-foreground">
            No keywords added yet.
          </p>
          <Button
            onClick={handleToggle}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Suggest keywords from app metadata
          </Button>
          <p className="text-xs text-muted-foreground">
            Or use the search above to add keywords manually.
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
          Suggest keywords
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
                Keyword Suggestions from App Metadata
              </span>
              {data && (
                <Badge variant="secondary" className="text-xs">
                  {data.suggestions.length}
                </Badge>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-auto">
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
                No suggestions available. The app may not have enough metadata.
              </div>
            ) : data ? (
              data.suggestions.map((s) => (
                <div
                  key={s.keyword}
                  className="flex items-center gap-3 px-3 py-2 border-b last:border-0 hover:bg-accent/50 transition-colors"
                >
                  <span className="flex-1 text-sm">{s.keyword}</span>

                  {/* Source badges */}
                  {s.sources && (
                    <div className="flex items-center gap-1 shrink-0">
                      {s.sources.map((src, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                          title={`${src.field}: ${src.weight}`}
                        >
                          {FIELD_LABELS[src.field] || src.field}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Count & Score */}
                  <span
                    className="text-xs text-muted-foreground tabular-nums shrink-0 text-right"
                    title={`Appears in ${s.count} field${s.count > 1 ? "s" : ""}, score: ${s.score}`}
                  >
                    {s.count}x | {s.score}
                  </span>

                  {/* Shopify search link */}
                  <a
                    href={`https://apps.shopify.com/search?q=${encodeURIComponent(s.keyword)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-accent shrink-0"
                    title="Search on Shopify"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>

                  {/* Add / Added */}
                  {isTracked(s) ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Check className="h-3.5 w-3.5" />
                      Added
                    </div>
                  ) : (
                    <button
                      onClick={() => addKeyword(s.keyword)}
                      disabled={addingKeyword === s.keyword}
                      className="p-1 rounded hover:bg-accent shrink-0"
                      title={`Track "${s.keyword}"`}
                    >
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))
            ) : null}
          </div>

          {/* Footer — weight legend */}
          {data?.weights && (
            <div className="px-3 py-1.5 border-t bg-muted/30 text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
              <span className="font-medium">Weights:</span>
              {Object.entries(data.weights).map(([field, weight]) => (
                <span key={field}>
                  {FIELD_LABELS[field] || field}({weight})
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
