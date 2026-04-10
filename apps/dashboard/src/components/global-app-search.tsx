"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Star, Loader2 } from "lucide-react";
import { getPlatformColor, PLATFORM_DISPLAY } from "@/lib/platform-display";
import { toast } from "sonner";

interface SearchResult {
  slug: string;
  name: string;
  iconUrl: string | null;
  platform: string;
  averageRating: number | null;
  ratingCount: number | null;
  pricingHint: string | null;
}

type SearchMode = "track" | "competitor";

interface GlobalAppSearchProps {
  mode: SearchMode;
  trackedSlugs?: Set<string>;
  competitorSlugs?: Set<string>;
  /** For competitor mode: the tracked app slug to add competitor to */
  defaultTrackedAppSlug?: string;
  onAction?: () => void;
  placeholder?: string;
  className?: string;
}

export function GlobalAppSearch({
  mode,
  trackedSlugs,
  competitorSlugs,
  defaultTrackedAppSlug,
  onAction,
  placeholder = "Search all apps...",
  className,
}: GlobalAppSearchProps) {
  const { fetchWithAuth, user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionSlug, setActionSlug] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fetchRef = useRef(fetchWithAuth);
  useEffect(() => { fetchRef.current = fetchWithAuth; }, [fetchWithAuth]);

  const canEdit = user?.role === "owner" || user?.role === "admin" || user?.role === "editor";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInput(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setLoading(true);
    setShowResults(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchRef.current(`/api/public/apps/search?q=${encodeURIComponent(q)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 300);
  }

  function getStatus(slug: string, platform: string): string | null {
    const key = `${platform}:${slug}`;
    if (trackedSlugs?.has(slug)) return "tracked";
    if (competitorSlugs?.has(slug)) return "competitor";
    return null;
  }

  async function handleTrack(app: SearchResult) {
    setActionSlug(app.slug);
    try {
      const res = await fetchRef.current(`/api/account/tracked-apps?platform=${app.platform}`, {
        method: "POST",
        body: JSON.stringify({ slug: app.slug }),
      });
      if (res.ok) {
        toast.success(`Now tracking ${app.name}`);
        onAction?.();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to track app");
      }
    } catch {
      toast.error("Failed to track app");
    } finally {
      setActionSlug(null);
    }
  }

  async function handleAddCompetitor(app: SearchResult) {
    if (!defaultTrackedAppSlug) {
      toast.info("Navigate to a tracked app to add competitors");
      return;
    }
    setActionSlug(app.slug);
    try {
      const res = await fetchRef.current(
        `/api/account/tracked-apps/${encodeURIComponent(defaultTrackedAppSlug)}/competitors?platform=${app.platform}`,
        { method: "POST", body: JSON.stringify({ slug: app.slug }) }
      );
      if (res.ok) {
        toast.success(`Added ${app.name} as competitor`);
        onAction?.();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to add competitor");
      }
    } catch {
      toast.error("Failed to add competitor");
    } finally {
      setActionSlug(null);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          className="pl-9"
        />
      </div>
      {showResults && (results.length > 0 || loading) && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-72 overflow-auto min-w-[320px]">
          {loading && results.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">Searching...</div>
          )}
          {results.map((app) => {
            const status = getStatus(app.slug, app.platform);
            const color = getPlatformColor(app.platform);
            const platformLabel = PLATFORM_DISPLAY[app.platform as keyof typeof PLATFORM_DISPLAY]?.label ?? app.platform;

            return (
              <div
                key={`${app.platform}-${app.slug}`}
                className="flex items-center justify-between px-3 py-2 hover:bg-accent text-sm gap-2"
              >
                <Link
                  href={`/${app.platform}/apps/${app.slug}`}
                  className="flex items-center gap-2 min-w-0 flex-1 hover:underline"
                  onClick={() => setShowResults(false)}
                >
                  {app.iconUrl ? (
                    <img src={app.iconUrl} alt="" className="h-5 w-5 rounded shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded bg-muted shrink-0" />
                  )}
                  <span className="truncate font-medium">{app.name}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    {platformLabel}
                  </span>
                  {app.averageRating != null && (
                    <span className="text-muted-foreground shrink-0 flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {app.averageRating.toFixed(1)}
                    </span>
                  )}
                </Link>
                <div className="shrink-0 ml-1">
                  {status === "tracked" && (
                    <span className="text-xs text-emerald-600 font-medium">Tracked</span>
                  )}
                  {status === "competitor" && (
                    <span className="text-xs text-muted-foreground">Competitor</span>
                  )}
                  {!status && canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title={mode === "track" ? "Track app" : "Add as competitor"}
                      disabled={!!actionSlug}
                      onClick={(e) => {
                        e.preventDefault();
                        mode === "track" ? handleTrack(app) : handleAddCompetitor(app);
                      }}
                    >
                      {actionSlug === app.slug ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
