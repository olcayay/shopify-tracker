"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Command } from "cmdk";
import { Search, BarChart3, Key, Globe, Settings, Home, Star, Plus, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getPlatformColor, PLATFORM_DISPLAY } from "@/lib/platform-display";
import { PlatformBadgeCell } from "@/components/platform-badge-cell";
import { toast } from "sonner";
import type { PlatformId } from "@appranks/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageResult {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  group: "Pages";
}

interface AppResult {
  slug: string;
  name: string;
  iconUrl: string | null;
  platform: string;
  averageRating: number | null;
  ratingCount: number | null;
  pricingHint: string | null;
}

interface DeveloperResult {
  id: number;
  slug: string;
  name: string;
  platforms: string[];
}

// ---------------------------------------------------------------------------
// Static pages
// ---------------------------------------------------------------------------

const PAGES: PageResult[] = [
  { id: "overview", label: "Overview", href: "/overview", icon: <Home className="h-4 w-4" />, group: "Pages" },
  { id: "apps", label: "Tracked Apps", href: "/apps", icon: <BarChart3 className="h-4 w-4" />, group: "Pages" },
  { id: "competitors", label: "Competitors", href: "/competitors", icon: <Globe className="h-4 w-4" />, group: "Pages" },
  { id: "developers", label: "Developers", href: "/developers", icon: <Users className="h-4 w-4" />, group: "Pages" },
  { id: "settings", label: "Settings", href: "/settings", icon: <Settings className="h-4 w-4" />, group: "Pages" },
  { id: "pricing", label: "Pricing", href: "/pricing", icon: <BarChart3 className="h-4 w-4" />, group: "Pages" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [appResults, setAppResults] = useState<AppResult[]>([]);
  const [developerResults, setDeveloperResults] = useState<DeveloperResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { fetchWithAuth, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const platform = (params.platform as string) || "shopify";
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fetchRef = useRef(fetchWithAuth);
  useEffect(() => { fetchRef.current = fetchWithAuth; }, [fetchWithAuth]);

  const canEdit = user?.role === "owner" || user?.role === "admin" || user?.role === "editor";

  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K opens the palette — set body attribute BEFORE React state update
  // so PlatformSwitcher's handler (same event cycle) sees it immediately.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        const hasOpenModal = document.querySelector("[data-keyword-search-open]");
        if (hasOpenModal) return;
        e.preventDefault();
        // Set attribute synchronously before setOpen — guarantees PlatformSwitcher
        // sees it in its own keydown handler within the same event dispatch cycle.
        const isCurrentlyOpen = document.body.hasAttribute("data-command-palette-open");
        if (isCurrentlyOpen) {
          document.body.removeAttribute("data-command-palette-open");
          setOpen(false);
        } else {
          document.body.setAttribute("data-command-palette-open", "");
          setOpen(true);
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Keep body attribute in sync when palette is closed via backdrop click;
  // auto-focus the search input when opening.
  useEffect(() => {
    if (open) {
      document.body.setAttribute("data-command-palette-open", "");
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      document.body.removeAttribute("data-command-palette-open");
    }
    return () => document.body.removeAttribute("data-command-palette-open");
  }, [open]);

  // Search apps + developers when query changes
  const searchAll = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setAppResults([]);
      setDeveloperResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      // Run searches independently so one failure doesn't block the other
      const appsPromise = fetchRef.current(`/api/public/apps/search?q=${encodeURIComponent(q)}&limit=10`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setAppResults(Array.isArray(data) ? data : []);
          }
        })
        .catch(() => { /* app search failed silently */ });

      const devsPromise = fetchRef.current(`/api/developers?search=${encodeURIComponent(q)}&limit=5`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setDeveloperResults(Array.isArray(data?.developers) ? data.developers : []);
          }
        })
        .catch(() => { /* developer search failed silently */ });

      await Promise.all([appsPromise, devsPromise]);
      setLoading(false);
    }, 300);
  }, []);

  useEffect(() => {
    searchAll(query);
  }, [query, searchAll]);

  async function handleTrack(app: AppResult, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetchRef.current(`/api/account/tracked-apps?platform=${app.platform}`, {
        method: "POST",
        body: JSON.stringify({ slug: app.slug }),
      });
      if (res.ok) {
        toast.success(`Now tracking ${app.name}`);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to track app");
      }
    } catch {
      toast.error("Failed to track app");
    }
  }

  async function handleAddCompetitor(app: AppResult, e: React.MouseEvent) {
    e.stopPropagation();
    toast.info(`Navigate to a tracked app to add "${app.name}" as competitor`);
  }

  if (!open) return null;

  const hasSearchResults = appResults.length > 0 || developerResults.length > 0;
  const isSearching = query.length >= 2;

  return (
    <div className="fixed inset-0 z-50" data-command-palette-open>
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <Command
          className="rounded-lg border bg-background shadow-lg overflow-hidden"
          shouldFilter={!isSearching}
        >
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder="Search apps and developers..."
              className="flex h-10 w-full bg-transparent py-3 px-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-1">
            {!loading && isSearching && !hasSearchResults && (
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                No results found.
              </Command.Empty>
            )}

            {loading && !hasSearchResults && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            )}

            {/* Pages — hidden when search results are displayed */}
            {!isSearching && (
              <Command.Group heading="Pages" className="px-1 py-1.5 text-xs font-medium text-muted-foreground">
                {PAGES.map((result) => (
                  <Command.Item
                    key={result.id}
                    value={result.label}
                    onSelect={() => {
                      setOpen(false);
                      setQuery("");
                      router.push(result.href);
                    }}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent"
                  >
                    {result.icon}
                    {result.label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* App Results */}
            {appResults.length > 0 && (
              <Command.Group heading="Apps" className="px-1 py-1.5 text-xs font-medium text-muted-foreground">
                {appResults.map((app) => {
                  const color = getPlatformColor(app.platform);
                  const platformLabel = PLATFORM_DISPLAY[app.platform as keyof typeof PLATFORM_DISPLAY]?.label ?? app.platform;
                  return (
                    <Command.Item
                      key={`${app.platform}-${app.slug}`}
                      value={`${app.name} ${app.platform}`}
                      onSelect={() => {
                        setOpen(false);
                        setQuery("");
                        router.push(`/${app.platform}/apps/${app.slug}`);
                      }}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent group"
                    >
                      {/* App icon */}
                      {app.iconUrl ? (
                        <img
                          src={app.iconUrl}
                          alt=""
                          className="h-6 w-6 rounded shrink-0"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded bg-muted shrink-0" />
                      )}

                      {/* App name + badge + rating */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium flex-1">{app.name}</span>
                          {/* Platform badge — right-aligned, same row as name */}
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            {platformLabel}
                          </span>
                        </div>
                        {app.averageRating != null && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                            {app.averageRating.toFixed(1)}
                            {app.ratingCount != null && (
                              <span>({app.ratingCount.toLocaleString()})</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      {canEdit && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-aria-selected:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={(e) => handleTrack(app, e)}
                            className="p-1 rounded hover:bg-primary/10 text-primary"
                            title="Track app"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {/* Developer Results */}
            {developerResults.length > 0 && (
              <Command.Group heading="Developers" className="px-1 py-1.5 text-xs font-medium text-muted-foreground">
                {developerResults.map((dev) => (
                  <Command.Item
                    key={`dev-${dev.id}`}
                    value={`developer ${dev.name}`}
                    onSelect={() => {
                      setOpen(false);
                      setQuery("");
                      router.push(`/developers/${dev.slug}`);
                    }}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent"
                  >
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate font-medium flex-1 min-w-0">{dev.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {dev.platforms.slice(0, 3).map((p) => (
                        <PlatformBadgeCell key={p} platform={p} size="sm" />
                      ))}
                      {dev.platforms.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{dev.platforms.length - 3}
                        </span>
                      )}
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
