"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, X, Plus, Check, ExternalLink } from "lucide-react";

function ShimmerRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
      <div className="h-4 w-48 bg-muted rounded animate-pulse" />
      <div className="flex-1" />
      <div className="h-4 w-8 bg-muted rounded animate-pulse shrink-0" />
    </div>
  );
}

export function KeywordSuggestionsModal({
  keywordSlug,
  keyword,
  appSlug,
  open,
  onClose,
  onKeywordAdded,
}: {
  keywordSlug: string;
  keyword: string;
  appSlug: string;
  open: boolean;
  onClose: () => void;
  onKeywordAdded?: (keywordId?: number, scraperEnqueued?: boolean) => void;
}) {
  const { fetchWithAuth } = useAuth();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());
  const [addingKeyword, setAddingKeyword] = useState<string | null>(null);
  const [trackedKeywords, setTrackedKeywords] = useState<Set<string>>(new Set());

  const loadSuggestions = useCallback(async () => {
    if (!keywordSlug) return;
    setLoading(true);
    setError("");
    try {
      const [sugRes, kwRes] = await Promise.all([
        fetchWithAuth(
          `/api/keywords/${encodeURIComponent(keywordSlug)}/suggestions`
        ),
        fetchWithAuth(
          `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/keywords`
        ),
      ]);

      if (sugRes.ok) {
        const data = await sugRes.json();
        setSuggestions(data.suggestions || []);
      } else {
        setError("Failed to load suggestions");
      }

      if (kwRes.ok) {
        const kwData = await kwRes.json();
        setTrackedKeywords(
          new Set(kwData.map((k: { keyword: string }) => k.keyword.toLowerCase()))
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to load");
    }
    setLoading(false);
  }, [keywordSlug, appSlug, fetchWithAuth]);

  useEffect(() => {
    if (open && keywordSlug) {
      loadSuggestions();
      setAddedKeywords(new Set());
    }
    if (!open) {
      setSuggestions([]);
      setError("");
    }
  }, [open, keywordSlug]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  async function addKeyword(suggestion: string) {
    setAddingKeyword(suggestion);
    try {
      const res = await fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/keywords`,
        {
          method: "POST",
          body: JSON.stringify({ keyword: suggestion }),
        }
      );
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddedKeywords((prev) => new Set([...prev, suggestion.toLowerCase()]));
        onKeywordAdded?.(data.keywordId, data.scraperEnqueued);
      }
    } catch {}
    setAddingKeyword(null);
  }

  if (!open) return null;

  const isTracked = (s: string) =>
    trackedKeywords.has(s.toLowerCase()) || addedKeywords.has(s.toLowerCase());

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            <span className="font-medium text-sm">
              Suggestions for &ldquo;{keyword}&rdquo;
            </span>
            {suggestions.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {suggestions.length}
              </Badge>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[50vh] overflow-auto">
          {loading ? (
            <>
              <ShimmerRow />
              <ShimmerRow />
              <ShimmerRow />
              <ShimmerRow />
            </>
          ) : error ? (
            <div className="px-4 py-8 text-center text-sm text-destructive">
              {error}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No suggestions available yet.
            </div>
          ) : (
            suggestions.map((s) => (
              <div
                key={s}
                className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-accent/50 transition-colors"
              >
                <span className="flex-1 text-sm">{s}</span>
                <a
                  href={`https://apps.shopify.com/search?q=${encodeURIComponent(s)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-accent shrink-0"
                  title="Search on Shopify"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
                {isTracked(s) ? (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Check className="h-3.5 w-3.5" />
                    Added
                  </div>
                ) : (
                  <button
                    onClick={() => addKeyword(s)}
                    disabled={addingKeyword === s}
                    className="p-1 rounded hover:bg-accent shrink-0"
                    title={`Track "${s}"`}
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t bg-muted/50 text-xs text-muted-foreground flex items-center justify-between">
          <span>Based on Shopify autocomplete</span>
          <span>
            <kbd className="rounded border bg-background px-1">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
