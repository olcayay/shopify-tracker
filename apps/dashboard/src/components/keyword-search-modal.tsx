"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, X, ExternalLink, Plus } from "lucide-react";

interface KeywordResult {
  id: number;
  keyword: string;
  slug: string;
}

function ShimmerRow() {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b last:border-0">
      <div className="space-y-2 flex-1">
        <div className="h-4 w-48 bg-muted rounded animate-pulse" />
        <div className="h-3 w-24 bg-muted rounded animate-pulse" />
      </div>
      <div className="h-8 w-16 bg-muted rounded animate-pulse" />
    </div>
  );
}

export function KeywordSearchModal({
  trackedAppSlug,
}: {
  trackedAppSlug?: string;
} = {}) {
  const { fetchWithAuth, refreshUser, user, account } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [trackedIds, setTrackedIds] = useState<Set<number>>(new Set());
  const [trackingSlug, setTrackingSlug] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [myApps, setMyApps] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>(trackedAppSlug || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const canEdit = user?.role === "owner" || user?.role === "editor";

  // Load tracked keyword IDs and my-apps when modal opens
  useEffect(() => {
    if (open) {
      fetchWithAuth("/api/keywords").then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setTrackedIds(new Set(data.map((k: any) => k.id)));
        }
      });
      if (!trackedAppSlug) {
        fetchWithAuth("/api/account/tracked-apps").then(async (res) => {
          if (res.ok) {
            const apps = await res.json();
            setMyApps(apps);
            if (apps.length === 1 && !selectedApp) {
              setSelectedApp(apps[0].appSlug);
            }
          }
        });
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
      setMessage("");
    }
  }, [open]);

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const doSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.length < 1) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        const res = await fetchWithAuth(
          `/api/keywords/search?q=${encodeURIComponent(q)}`
        );
        if (res.ok) {
          setResults(await res.json());
        }
        setLoading(false);
      }, 250);
    },
    [fetchWithAuth]
  );

  function handleInput(value: string) {
    setQuery(value);
    setMessage("");
    doSearch(value);
  }

  function getEffectiveApp(): string | null {
    if (trackedAppSlug) return trackedAppSlug;
    if (selectedApp) return selectedApp;
    if (myApps.length === 1) return myApps[0].appSlug;
    return null;
  }

  async function trackKeyword(keyword: string) {
    const appSlug = getEffectiveApp();
    if (!appSlug) {
      setMessage("Select an app first to track keywords");
      return;
    }
    setTrackingSlug(keyword);
    setMessage("");
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/keywords`,
      {
        method: "POST",
        body: JSON.stringify({ keyword }),
      }
    );
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const scrapeMsg = data.scraperEnqueued ? " Scraping started." : "";
      setMessage(`"${keyword}" tracked.${scrapeMsg}`);
      refreshUser();
      // Refresh tracked IDs
      const kwRes = await fetchWithAuth("/api/keywords");
      if (kwRes.ok) {
        const kwData = await kwRes.json();
        setTrackedIds(new Set(kwData.map((k: any) => k.id)));
      }
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to track keyword");
    }
    setTrackingSlug(null);
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Search className="h-4 w-4" />
        Search Keywords
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground ml-2">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />
      <div className="relative bg-background border rounded-lg shadow-lg w-full max-w-lg mx-4 overflow-hidden">
        {/* App selector (when no trackedAppSlug prop and multiple apps) */}
        {!trackedAppSlug && myApps.length > 1 && (
          <div className="px-4 py-2 border-b bg-muted/30">
            <select
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
            >
              <option value="">Select app to track for...</option>
              {myApps.map((a) => (
                <option key={a.appSlug} value={a.appSlug}>
                  {a.appName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search Input */}
        <div className="flex items-center border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={
              getEffectiveApp()
                ? "Search keywords..."
                : "Select an app first..."
            }
            disabled={!getEffectiveApp()}
            className="border-0 focus-visible:ring-0 shadow-none"
          />
          <button
            onClick={() => setOpen(false)}
            className="shrink-0 p-1 rounded hover:bg-accent"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className="px-4 py-2 text-sm bg-muted border-b">
            {message}
          </div>
        )}

        {/* Results */}
        <div className="max-h-[50vh] overflow-auto">
          {loading ? (
            <>
              <ShimmerRow />
              <ShimmerRow />
              <ShimmerRow />
              <ShimmerRow />
              <ShimmerRow />
            </>
          ) : results.length > 0 ? (
            <>
              {results.map((kw) => {
                const isTracked = trackedIds.has(kw.id);
                return (
                  <div
                    key={kw.id}
                    className="flex items-center justify-between px-4 py-3 border-b last:border-0 hover:bg-accent/50 transition-colors"
                  >
                    <Link
                      href={`/keywords/${kw.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex-1 min-w-0"
                    >
                      <span className="font-medium text-primary hover:underline">
                        {kw.keyword}
                      </span>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {isTracked ? (
                        <Badge variant="outline" className="text-xs">
                          Tracked
                        </Badge>
                      ) : canEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={
                            trackingSlug === kw.keyword || !getEffectiveApp()
                          }
                          onClick={() => trackKeyword(kw.keyword)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Track
                        </Button>
                      ) : null}
                      <a
                        href={`https://apps.shopify.com/search?q=${encodeURIComponent(kw.keyword)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-accent"
                        title="Search on Shopify"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </a>
                    </div>
                  </div>
                );
              })}
              {/* Option to track as new keyword */}
              {query.trim().length >= 1 &&
                !results.some(
                  (r) =>
                    r.keyword.toLowerCase() === query.trim().toLowerCase()
                ) &&
                canEdit && (
                  <div className="flex items-center justify-between px-4 py-3 border-t hover:bg-accent/50 transition-colors">
                    <span className="text-sm">
                      Track &ldquo;{query.trim()}&rdquo; as new keyword
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={
                        trackingSlug === query.trim() || !getEffectiveApp()
                      }
                      onClick={() => trackKeyword(query.trim())}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Track
                    </Button>
                  </div>
                )}
            </>
          ) : query.length >= 1 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No matching keywords found.
              </p>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    trackingSlug === query.trim() || !getEffectiveApp()
                  }
                  onClick={() => trackKeyword(query.trim())}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Track &ldquo;{query.trim()}&rdquo;
                </Button>
              )}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {getEffectiveApp()
                ? "Start typing to search keywords..."
                : "Select an app above first, then search keywords."}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/50 text-xs text-muted-foreground">
          <span>
            {account
              ? `${account.usage.trackedKeywords}/${account.limits.maxTrackedKeywords} keywords tracked`
              : ""}
          </span>
          <span>
            <kbd className="rounded border bg-background px-1">Esc</kbd> to
            close
          </span>
        </div>
      </div>
    </div>
  );
}
