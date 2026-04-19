"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "@/components/ui/link";
import { AppIcon } from "@/components/app-icon";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";
import { ExternalLink } from "@/components/ui/external-link";
import { formatNumber } from "@/lib/format-utils";
import { CompetitorButton } from "@/components/competitor-button";
import { buildExternalSearchUrl, getPlatformName } from "@/lib/platform-urls";
import { PLATFORMS, type PlatformId } from "@appranks/shared";

interface SearchApp {
  position: number;
  app_slug: string;
  app_name: string;
  short_description: string;
  average_rating: number;
  rating_count: number;
  logo_url?: string;
  is_sponsored: boolean;
  is_built_in?: boolean;
  is_built_for_shopify?: boolean;
}

interface LiveSearchResult {
  keyword: string;
  totalResults: number | null;
  apps: SearchApp[];
  source?: "api" | "database";
}

function ShimmerRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
      <div className="h-5 w-5 bg-muted rounded animate-pulse shrink-0" />
      <div className="space-y-1.5 flex-1">
        <div className="h-4 w-40 bg-muted rounded animate-pulse" />
        <div className="h-3 w-64 bg-muted rounded animate-pulse" />
      </div>
      <div className="h-4 w-12 bg-muted rounded animate-pulse shrink-0" />
      <div className="h-4 w-12 bg-muted rounded animate-pulse shrink-0" />
    </div>
  );
}

export function LiveSearchModal({
  keyword,
  open,
  onClose,
}: {
  keyword: string;
  open: boolean;
  onClose: () => void;
}) {
  const { platform } = useParams();
  const { fetchWithAuth } = useAuth();
  const [result, setResult] = useState<LiveSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [competitors, setCompetitors] = useState<Set<string>>(new Set());
  const [trackedApps, setTrackedApps] = useState<Set<string>>(new Set());

  const doSearch = useCallback(async () => {
    if (!keyword) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const [searchRes, compRes, trackedRes] = await Promise.all([
        fetchWithAuth(`/api/live-search?q=${encodeURIComponent(keyword)}&platform=${platform}`),
        fetchWithAuth(`/api/account/competitors?platform=${platform}`).catch(() => null),
        fetchWithAuth(`/api/account/tracked-apps?platform=${platform}`).catch(() => null),
      ]);

      if (searchRes.ok) {
        setResult(await searchRes.json());
      } else {
        const data = await searchRes.json().catch(() => ({}));
        setError(data.error || "Failed to fetch search results");
      }

      if (compRes?.ok) {
        const compData = await compRes.json();
        setCompetitors(new Set(compData.map((c: any) => c.appSlug)));
      }
      if (trackedRes?.ok) {
        const trackedData = await trackedRes.json();
        setTrackedApps(new Set(trackedData.map((a: any) => a.appSlug)));
      }
    } catch (err: any) {
      setError(err.message || "Search failed");
    }
    setLoading(false);
  }, [keyword, fetchWithAuth]);

  useEffect(() => {
    if (open && keyword) {
      doSearch();
    }
    if (!open) {
      setResult(null);
      setError("");
    }
  }, [open, keyword]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const builtInApps = result?.apps.filter((a) => a.is_built_in) || [];
  const organicApps = result?.apps.filter((a) => !a.is_sponsored && !a.is_built_in) || [];
  const sponsoredApps = result?.apps.filter((a) => a.is_sponsored) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border rounded-lg shadow-lg w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              Live Search: &ldquo;{keyword}&rdquo;
            </span>
            {result?.totalResults != null && (
              <Badge variant="secondary" className="text-xs">
                {formatNumber(result.totalResults)} results
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={doSearch}
              disabled={loading}
              className="text-xs"
            >
              Refresh
            </Button>
            <ExternalLink
              href={buildExternalSearchUrl(platform as PlatformId, keyword)}
              className="p-1 rounded hover:bg-accent text-muted-foreground"
              iconSize="default"
              title={`Open on ${getPlatformName(platform as PlatformId)}`}
            />
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-accent"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[65vh] overflow-auto">
          {loading ? (
            <>
              <ShimmerRow />
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
          ) : result ? (
            <>
              {/* Built-in Features */}
              {builtInApps.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-blue-50 text-xs font-medium text-blue-700 sticky top-0">
                    Shopify Built-in ({builtInApps.length})
                  </div>
                  {builtInApps.map((app) => (
                    <div
                      key={app.app_slug}
                      className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 bg-blue-50/30 border-l-2 border-l-blue-400"
                    >
                      <Badge className="text-[10px] shrink-0 bg-blue-100 text-blue-700 border-blue-300" variant="outline">
                        Built-in
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <ExternalLink
                          href={`${PLATFORMS[platform as PlatformId].baseUrl}/built-in-features/${app.app_slug.replace("bif:", "")}`}
                          showIcon={false}
                          className="font-medium text-sm text-primary truncate block"
                        >
                          {app.app_name}
                        </ExternalLink>
                        {app.short_description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {app.short_description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Organic Results */}
              {organicApps.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground sticky top-0">
                    Organic Results ({organicApps.length})
                  </div>
                  {organicApps.map((app) => {
                    const isTracked = trackedApps.has(app.app_slug);
                    const isCompetitor = competitors.has(app.app_slug);
                    return (
                      <div
                        key={app.app_slug}
                        className={`flex items-center gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-accent/50 transition-colors ${
                          isTracked
                            ? "border-l-2 border-l-primary bg-primary/5"
                            : isCompetitor
                              ? "border-l-2 border-l-yellow-500 bg-yellow-500/5"
                              : ""
                        }`}
                      >
                        <span className="text-xs font-mono text-muted-foreground w-5 text-right shrink-0">
                          {app.position}
                        </span>
                        <AppIcon src={app.logo_url} className="h-6 w-6 rounded" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/${platform}/apps/${app.app_slug}`}
                              onClick={onClose}
                              className="font-medium text-sm text-primary hover:underline truncate"
                            >
                              {app.app_name}
                            </Link>
                            {app.is_built_for_shopify && <span title="Built for Shopify" className="shrink-0">💎</span>}
                            {isTracked && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 h-4 border-primary text-primary shrink-0"
                              >
                                Tracked
                              </Badge>
                            )}
                            {isCompetitor && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 h-4 border-yellow-500 text-yellow-600 shrink-0"
                              >
                                Competitor
                              </Badge>
                            )}
                          </div>
                          {app.short_description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {app.short_description}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {app.average_rating > 0
                            ? `${app.average_rating.toFixed(1)}★`
                            : "—"}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0 w-14 text-right">
                          {app.rating_count > 0
                            ? `${formatNumber(app.rating_count)}`
                            : "—"}
                        </span>
                        <CompetitorButton
                          appSlug={app.app_slug}
                          appName={app.app_name}
                          initialStarred={isCompetitor}
                          size="sm"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sponsored Results */}
              {sponsoredApps.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground sticky top-0">
                    Sponsored ({sponsoredApps.length})
                  </div>
                  {sponsoredApps.map((app) => {
                    const isTracked = trackedApps.has(app.app_slug);
                    const isCompetitor = competitors.has(app.app_slug);
                    return (
                      <div
                        key={app.app_slug}
                        className={`flex items-center gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-accent/50 transition-colors ${
                          isTracked
                            ? "border-l-2 border-l-primary bg-primary/5"
                            : isCompetitor
                              ? "border-l-2 border-l-yellow-500 bg-yellow-500/5"
                              : ""
                        }`}
                      >
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          Ad
                        </Badge>
                        <AppIcon src={app.logo_url} className="h-6 w-6 rounded" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/${platform}/apps/${app.app_slug}`}
                              onClick={onClose}
                              className="font-medium text-sm text-primary hover:underline truncate"
                            >
                              {app.app_name}
                            </Link>
                            {app.is_built_for_shopify && <span title="Built for Shopify" className="shrink-0">💎</span>}
                            {isTracked && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 h-4 border-primary text-primary shrink-0"
                              >
                                Tracked
                              </Badge>
                            )}
                            {isCompetitor && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 h-4 border-yellow-500 text-yellow-600 shrink-0"
                              >
                                Competitor
                              </Badge>
                            )}
                          </div>
                          {app.short_description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {app.short_description}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {app.average_rating > 0
                            ? `${app.average_rating.toFixed(1)}★`
                            : "—"}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0 w-14 text-right">
                          {app.rating_count > 0
                            ? `${formatNumber(app.rating_count)}`
                            : "—"}
                        </span>
                        <CompetitorButton
                          appSlug={app.app_slug}
                          appName={app.app_name}
                          initialStarred={isCompetitor}
                          size="sm"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {result.apps.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No results found for &ldquo;{keyword}&rdquo;
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t bg-muted/50 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            {result?.source === "database"
              ? "Results from database (search server unavailable)"
              : `Real-time results from ${getPlatformName(platform as PlatformId)}`}
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
