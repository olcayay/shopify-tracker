"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Loader2 } from "lucide-react";

interface SearchResult {
  slug: string;
  name: string;
  iconUrl?: string;
  isBuiltForShopify?: boolean;
  averageRating: number | null;
  ratingCount: number | null;
}

type AppSearchMode = "follow" | "competitor" | "browse-only";

interface AppSearchBarProps {
  mode: AppSearchMode;
  trackedSlugs?: Set<string>;
  competitorSlugs?: Set<string>;
  currentAppSlug?: string;
  onFollow?: (slug: string, name: string) => Promise<void>;
  onAddCompetitor?: (slug: string, name: string) => Promise<void>;
  placeholder?: string;
  className?: string;
}

export function AppSearchBar({
  mode,
  trackedSlugs,
  competitorSlugs,
  currentAppSlug,
  onFollow,
  onAddCompetitor,
  placeholder = "Search apps...",
  className,
}: AppSearchBarProps) {
  const { fetchWithAuth, user } = useAuth();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionLoadingSlug, setActionLoadingSlug] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const canEdit = user?.role === "owner" || user?.role === "editor";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearchInput(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await fetchWithAuth(
        `/api/apps/search?q=${encodeURIComponent(value)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(true);
      }
      setSearchLoading(false);
    }, 300);
  }

  async function handleFollow(slug: string, name: string) {
    if (!onFollow) return;
    setActionLoadingSlug(slug);
    try {
      await onFollow(slug, name);
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setActionLoadingSlug(null);
    }
  }

  async function handleAddCompetitor(slug: string, name: string) {
    if (!onAddCompetitor) return;
    setActionLoadingSlug(slug);
    try {
      await onAddCompetitor(slug, name);
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setActionLoadingSlug(null);
    }
  }

  function getStatus(slug: string): "following" | "competitor" | "self" | null {
    if (slug === currentAppSlug) return "self";
    if (trackedSlugs?.has(slug)) return "following";
    if (competitorSlugs?.has(slug)) return "competitor";
    return null;
  }

  return (
    <div ref={searchRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleSearchInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          className="pl-9"
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-72 overflow-auto min-w-[320px]">
          {suggestions.map((s) => {
            const status = getStatus(s.slug);
            const isActionDisabled =
              actionLoadingSlug === s.slug ||
              status === "self" ||
              (mode === "follow" && status === "following") ||
              (mode === "competitor" && status === "competitor");

            return (
              <div
                key={s.slug}
                className="flex items-center justify-between px-3 py-2 hover:bg-accent text-sm gap-2"
              >
                <Link
                  href={`/apps/${s.slug}`}
                  className="flex items-center gap-2 min-w-0 flex-1 hover:underline"
                  onClick={() => setShowSuggestions(false)}
                >
                  {s.iconUrl && (
                    <img
                      src={s.iconUrl}
                      alt=""
                      className="h-5 w-5 rounded shrink-0"
                    />
                  )}
                  <span className="truncate font-medium">{s.name}</span>
                  {s.averageRating != null && (
                    <span className="text-muted-foreground shrink-0">
                      ({Number(s.averageRating).toFixed(1)} /{" "}
                      {s.ratingCount?.toLocaleString() ?? 0})
                    </span>
                  )}
                </Link>

                <div className="shrink-0 ml-2">
                  {status === "self" && (
                    <span className="text-xs text-muted-foreground">This app</span>
                  )}
                  {status === "following" && (
                    <span className="text-xs text-muted-foreground">Following</span>
                  )}
                  {status === "competitor" && (
                    <span className="text-xs text-muted-foreground">Competitor</span>
                  )}
                  {!status && canEdit && mode === "follow" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Follow this app"
                      disabled={!!actionLoadingSlug}
                      onClick={(e) => {
                        e.preventDefault();
                        handleFollow(s.slug, s.name);
                      }}
                    >
                      {actionLoadingSlug === s.slug ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  {!status && canEdit && mode === "competitor" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Add as competitor"
                      disabled={!!actionLoadingSlug}
                      onClick={(e) => {
                        e.preventDefault();
                        handleAddCompetitor(s.slug, s.name);
                      }}
                    >
                      {actionLoadingSlug === s.slug ? (
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
      {showSuggestions &&
        query.length >= 1 &&
        suggestions.length === 0 &&
        !searchLoading && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md p-3 text-sm text-muted-foreground min-w-[320px]">
            No apps found for &ldquo;{query}&rdquo;
          </div>
        )}
    </div>
  );
}
