"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/skeletons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, Plus, Search, Check, ArrowDown, ExternalLink, Lightbulb, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmModal } from "@/components/confirm-modal";
import { LiveSearchTrigger } from "@/components/live-search-trigger";
import { KeywordSuggestionsModal } from "@/components/keyword-suggestions-modal";
import { KeywordTagBadge } from "@/components/keyword-tag-badge";
import { KeywordTagManager } from "@/components/keyword-tag-manager";
import { KeywordTagFilter } from "@/components/keyword-tag-filter";
import { KeywordWordGroupFilter } from "@/components/keyword-word-group-filter";
import { extractWordGroups, filterKeywordsByWord } from "@/lib/keyword-word-groups";
import { MetadataKeywordSuggestions } from "@/components/metadata-keyword-suggestions";

// --- App icon with selection state (same as compare page) ---
function AppIcon({
  app,
  selected,
  onClick,
  isMain,
}: {
  app: { slug: string; name: string; iconUrl: string | null };
  selected: boolean;
  onClick?: () => void;
  isMain?: boolean;
}) {
  return (
    <div className="group relative flex flex-col items-center">
      <button
        onClick={onClick}
        disabled={isMain}
        className={cn(
          "relative rounded-lg transition-all shrink-0 h-10 w-10",
          selected
            ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background"
            : "opacity-35 hover:opacity-60 grayscale hover:grayscale-0",
          isMain && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background cursor-default"
        )}
      >
        {app.iconUrl ? (
          <img src={app.iconUrl} alt={app.name} className="rounded-lg h-10 w-10" />
        ) : (
          <div className="rounded-lg bg-muted flex items-center justify-center text-xs font-bold h-10 w-10">
            {app.name.charAt(0)}
          </div>
        )}
        {selected && !isMain && (
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </button>
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {app.name}
      </span>
    </div>
  );
}

interface SimpleApp {
  slug: string;
  name: string;
  iconUrl: string | null;
}

export function KeywordsSection({ appSlug }: { appSlug: string }) {
  const { fetchWithAuth, user, account, refreshUser } = useAuth();
  const [keywords, setKeywords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<{
    keywordId: number;
    keyword: string;
  } | null>(null);
  const [tags, setTags] = useState<any[]>([]);
  const [activeTagFilter, setActiveTagFilter] = useState<Set<string>>(
    new Set()
  );
  const [activeWordFilter, setActiveWordFilter] = useState<string | null>(null);
  const [pendingKeywordIds, setPendingKeywordIds] = useState<Set<number>>(new Set());
  const [resolvedKeywordIds, setResolvedKeywordIds] = useState<Set<number>>(new Set());
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // App selector state
  const [mainApp, setMainApp] = useState<SimpleApp | null>(null);
  const [competitors, setCompetitors] = useState<SimpleApp[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const selectionInitialized = useRef(false);

  // Drag-and-drop state for competitor reordering
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Sort state: which app slug to sort by ranking
  const [sortBySlug, setSortBySlug] = useState<string>(appSlug);

  // Suggestions modal state
  const [suggestionsKeyword, setSuggestionsKeyword] = useState<{
    slug: string;
    keyword: string;
  } | null>(null);

  const canEdit = user?.role === "owner" || user?.role === "editor";

  // Ordered list of selected apps for table columns
  const selectedApps = useMemo(() => {
    const apps: SimpleApp[] = [];
    if (mainApp) apps.push(mainApp);
    for (const c of competitors) {
      if (selectedSlugs.has(c.slug)) apps.push(c);
    }
    return apps;
  }, [mainApp, competitors, selectedSlugs]);

  // Build appSlugs query param
  const appSlugsParam = useMemo(() => {
    return selectedApps.map((a) => a.slug).join(",");
  }, [selectedApps]);

  // Extract word groups from all keywords (stable regardless of filters)
  const wordGroups = useMemo(() => {
    return extractWordGroups(keywords.map((kw) => kw.keyword));
  }, [keywords]);

  // Filter keywords by active tags and word group
  const filteredKeywords = useMemo(() => {
    let result = keywords;
    if (activeTagFilter.size > 0) {
      result = result.filter((kw) =>
        kw.tags?.some((t: any) => activeTagFilter.has(t.id))
      );
    }
    if (activeWordFilter) {
      result = filterKeywordsByWord(result, activeWordFilter);
    }
    return result;
  }, [keywords, activeTagFilter, activeWordFilter]);

  // Sorted keywords by selected app ranking or alphabetically
  const sortedKeywords = useMemo(() => {
    if (!sortBySlug || filteredKeywords.length === 0) return filteredKeywords;
    if (sortBySlug === "_alpha") {
      return [...filteredKeywords].sort((a, b) =>
        a.keyword.localeCompare(b.keyword)
      );
    }
    return [...filteredKeywords].sort((a, b) => {
      const posA = a.rankings?.[sortBySlug];
      const posB = b.rankings?.[sortBySlug];
      // ranked items first (lower position = better), unranked at bottom
      if (posA != null && posB != null) return posA - posB;
      if (posA != null) return -1;
      if (posB != null) return 1;
      return 0;
    });
  }, [filteredKeywords, sortBySlug]);

  // Clear word filter if the active word no longer exists in word groups
  useEffect(() => {
    if (activeWordFilter && !wordGroups.some((g) => g.word === activeWordFilter)) {
      setActiveWordFilter(null);
    }
  }, [wordGroups, activeWordFilter]);

  // Load main app + competitors on mount
  useEffect(() => {
    loadAppsAndKeywords();
  }, []);

  // Re-fetch keywords when selection changes (after initial load)
  useEffect(() => {
    if (selectionInitialized.current) {
      loadKeywords(appSlugsParam);
    }
  }, [appSlugsParam]);

  // Persist selection to localStorage
  useEffect(() => {
    if (selectionInitialized.current && competitors.length > 0) {
      localStorage.setItem(
        `keywords-selected-${appSlug}`,
        JSON.stringify([...selectedSlugs])
      );
    }
  }, [selectedSlugs, appSlug, competitors.length]);

  // Poll for pending keywords that are being scraped
  useEffect(() => {
    if (pendingKeywordIds.size === 0) return;

    const interval = setInterval(async () => {
      let url = `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/keywords`;
      if (appSlugsParam) {
        url += `?appSlugs=${encodeURIComponent(appSlugsParam)}`;
      }
      const res = await fetchWithAuth(url);
      if (!res.ok) return;
      const freshKeywords = await res.json();
      setKeywords(freshKeywords);

      // Check which pending keywords now have results
      const newlyResolved = new Set<number>();
      const stillPending = new Set<number>();
      for (const id of pendingKeywordIds) {
        const kw = freshKeywords.find((k: any) => k.keywordId === id);
        if (kw && kw.latestSnapshot !== null) {
          newlyResolved.add(id);
        } else {
          stillPending.add(id);
        }
      }

      if (newlyResolved.size > 0) {
        setPendingKeywordIds(stillPending);
        setResolvedKeywordIds((prev) => {
          const next = new Set(prev);
          for (const id of newlyResolved) next.add(id);
          return next;
        });
        // Clear resolved animation after 2 seconds
        setTimeout(() => {
          setResolvedKeywordIds((prev) => {
            const next = new Set(prev);
            for (const id of newlyResolved) next.delete(id);
            return next;
          });
        }, 2000);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pendingKeywordIds, appSlug, appSlugsParam]);

  // Click outside handler for suggestions
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadAppsAndKeywords() {
    setLoading(true);

    // Fetch main app + competitors + tags in parallel
    const [appRes, compRes, tagsRes] = await Promise.all([
      fetchWithAuth(`/api/apps/${encodeURIComponent(appSlug)}`),
      fetchWithAuth(`/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors`),
      fetchWithAuth("/api/account/keyword-tags"),
    ]);

    if (tagsRes.ok) setTags(await tagsRes.json());

    let main: SimpleApp | null = null;
    let comps: SimpleApp[] = [];

    if (appRes.ok) {
      const data = await appRes.json();
      main = { slug: data.slug, name: data.name, iconUrl: data.iconUrl };
      setMainApp(main);
    }

    if (compRes.ok) {
      const data = await compRes.json();
      comps = data.map((c: any) => ({
        slug: c.appSlug,
        name: c.appName,
        iconUrl: c.iconUrl,
      }));
      setCompetitors(comps);
    }

    // Restore selection from localStorage
    let selected = new Set<string>();
    try {
      const saved = localStorage.getItem(`keywords-selected-${appSlug}`);
      if (saved) {
        const arr = JSON.parse(saved) as string[];
        const validSlugs = new Set(comps.map((c) => c.slug));
        selected = new Set(arr.filter((s) => validSlugs.has(s)));
      }
    } catch {}

    // Default: select all competitors
    if (selected.size === 0 && comps.length > 0) {
      selected = new Set(comps.map((c) => c.slug));
    }

    setSelectedSlugs(selected);
    selectionInitialized.current = true;

    // Build slugs for initial fetch
    const allSlugs = [appSlug, ...Array.from(selected)].join(",");
    await loadKeywords(allSlugs);
  }

  async function loadKeywords(slugsParam?: string, silent = false) {
    if (!silent) setLoading(true);
    let url = `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/keywords`;
    if (slugsParam) {
      url += `?appSlugs=${encodeURIComponent(slugsParam)}`;
    }
    const res = await fetchWithAuth(url);
    if (res.ok) {
      setKeywords(await res.json());
    }
    setLoading(false);
  }

  function toggleCompetitor(compSlug: string) {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(compSlug)) {
        next.delete(compSlug);
      } else {
        next.add(compSlug);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedSlugs.size === competitors.length) {
      setSelectedSlugs(new Set());
    } else {
      setSelectedSlugs(new Set(competitors.map((c) => c.slug)));
    }
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newList = [...competitors];
    const [moved] = newList.splice(dragIndex, 1);
    newList.splice(targetIndex, 0, moved);
    setCompetitors(newList);
    setDragIndex(null);
    setDragOverIndex(null);

    // Persist to API
    const slugs = newList.map((c) => c.slug);
    fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors/reorder`,
      {
        method: "PATCH",
        body: JSON.stringify({ slugs }),
      }
    );
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

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
        `/api/keywords/search?q=${encodeURIComponent(value)}`
      );
      if (res.ok) {
        setSuggestions(await res.json());
        setShowSuggestions(true);
      }
      setSearchLoading(false);
    }, 300);
  }

  async function addKeyword(keyword: string) {
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
      const scrapeMsg = data.scraperEnqueued
        ? " Search results will appear shortly."
        : "";
      setMessage(`"${keyword}" added.${scrapeMsg}`);
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
      // Track pending keyword if scraper was enqueued
      if (data.scraperEnqueued && data.keywordId) {
        setPendingKeywordIds((prev) => new Set(prev).add(data.keywordId));
      }
      loadKeywords(appSlugsParam, true);
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to add keyword");
    }
  }

  async function removeKeyword(keywordId: number, keyword: string) {
    setMessage("");
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/keywords/${keywordId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setMessage(`"${keyword}" removed`);
      loadKeywords(appSlugsParam, true);
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to remove keyword");
    }
  }

  // Tag operations
  async function reloadKeywordsAndTags() {
    const [kwRes, tagsRes] = await Promise.all([
      fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/keywords${appSlugsParam ? `?appSlugs=${encodeURIComponent(appSlugsParam)}` : ""}`
      ),
      fetchWithAuth("/api/account/keyword-tags"),
    ]);
    if (kwRes.ok) setKeywords(await kwRes.json());
    if (tagsRes.ok) setTags(await tagsRes.json());
  }

  async function assignTag(tagId: string, keywordId: number) {
    await fetchWithAuth(
      `/api/account/keyword-tags/${tagId}/keywords/${keywordId}`,
      { method: "POST" }
    );
    await reloadKeywordsAndTags();
  }

  async function unassignTag(tagId: string, keywordId: number) {
    await fetchWithAuth(
      `/api/account/keyword-tags/${tagId}/keywords/${keywordId}`,
      { method: "DELETE" }
    );
    await reloadKeywordsAndTags();
  }

  async function createTag(name: string, color: string) {
    await fetchWithAuth("/api/account/keyword-tags", {
      method: "POST",
      body: JSON.stringify({ name, color }),
    });
    await reloadKeywordsAndTags();
  }

  async function deleteTag(tagId: string) {
    await fetchWithAuth(`/api/account/keyword-tags/${tagId}`, {
      method: "DELETE",
    });
    setActiveTagFilter((prev) => {
      const next = new Set(prev);
      next.delete(tagId);
      return next;
    });
    await reloadKeywordsAndTags();
  }

  async function updateTag(tagId: string, color: string, name?: string) {
    await fetchWithAuth(`/api/account/keyword-tags/${tagId}`, {
      method: "PATCH",
      body: JSON.stringify({ color, ...(name ? { name } : {}) }),
    });
    await reloadKeywordsAndTags();
  }

  function toggleTagFilter(tagId: string) {
    setActiveTagFilter((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }

  const trackedKeywordIds = new Set(keywords.map((k) => k.keywordId));

  return (
    <div className="space-y-4">
      {/* App selector bar */}
      {competitors.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 flex-wrap pb-4">
              {mainApp && (
                <AppIcon app={mainApp} selected isMain />
              )}
              <div className="w-px h-8 bg-border" />
              {competitors.map((c, idx) => (
                <div
                  key={c.slug}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "relative cursor-grab active:cursor-grabbing transition-all",
                    dragIndex === idx && "opacity-30",
                    dragOverIndex === idx && dragIndex !== idx && "scale-110"
                  )}
                >
                  {dragOverIndex === idx && dragIndex !== null && dragIndex !== idx && (
                    <div className={cn(
                      "absolute top-0 bottom-0 w-0.5 bg-emerald-500 z-10",
                      dragIndex > idx ? "-left-1.5" : "-right-1.5"
                    )} />
                  )}
                  <AppIcon
                    app={c}
                    selected={selectedSlugs.has(c.slug)}
                    onClick={() => toggleCompetitor(c.slug)}
                  />
                </div>
              ))}
              <button
                onClick={toggleAll}
                className="text-xs text-muted-foreground hover:text-foreground ml-2 transition-colors"
              >
                {selectedSlugs.size === competitors.length ? "Deselect all" : "Select all"}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Keywords for this app
          {account
            ? ` (${account.usage.trackedKeywords}/${account.limits.maxTrackedKeywords} unique across all apps)`
            : ""}
        </p>
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      {canEdit && (
        <div ref={searchRef} className="relative max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search or type a new keyword..."
              value={query}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() =>
                suggestions.length > 0 && setShowSuggestions(true)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  addKeyword(query.trim());
                }
              }}
              className="pl-9"
            />
          </div>
          {showSuggestions && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                  onClick={() => {
                    if (trackedKeywordIds.has(s.id)) return;
                    addKeyword(s.keyword);
                  }}
                >
                  <span>{s.keyword}</span>
                  {trackedKeywordIds.has(s.id) ? (
                    <span className="text-xs text-muted-foreground">
                      Added
                    </span>
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              ))}
              {query.trim() &&
                !suggestions.some(
                  (s) =>
                    s.keyword.toLowerCase() === query.trim().toLowerCase()
                ) && (
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between border-t"
                    onClick={() => addKeyword(query.trim())}
                  >
                    <span>
                      Track &ldquo;{query.trim()}&rdquo; as new keyword
                    </span>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
            </div>
          )}
          {!showSuggestions &&
            query.length >= 1 &&
            suggestions.length === 0 &&
            !searchLoading && (
              <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                  onClick={() => addKeyword(query.trim())}
                >
                  <span>
                    Track &ldquo;{query.trim()}&rdquo; as new keyword
                  </span>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            )}
        </div>
      )}

      {canEdit && !loading && (
        <MetadataKeywordSuggestions
          appSlug={appSlug}
          trackedKeywords={new Set(keywords.map((k: any) => k.keyword.toLowerCase()))}
          onKeywordAdded={(keywordId, scraperEnqueued) => {
            if (scraperEnqueued && keywordId) {
              setPendingKeywordIds((prev) => new Set(prev).add(keywordId));
            }
            loadKeywords(appSlugsParam, true);
            refreshUser();
          }}
          prominent={keywords.length === 0}
        />
      )}

      {tags.length > 0 && (
        <KeywordTagFilter
          tags={tags}
          activeTags={activeTagFilter}
          onToggle={toggleTagFilter}
          onClearAll={() => setActiveTagFilter(new Set())}
        />
      )}

      {wordGroups.length > 0 && (
        <KeywordWordGroupFilter
          wordGroups={wordGroups}
          activeWord={activeWordFilter}
          onSelect={setActiveWordFilter}
        />
      )}

      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : keywords.length === 0 ? (
        !canEdit ? (
          <p className="text-muted-foreground text-center py-8">
            No keywords added yet.
          </p>
        ) : null
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  onClick={() => setSortBySlug("_alpha")}
                  className="flex items-center gap-0.5"
                  title="Sort alphabetically"
                >
                  Keyword
                  {sortBySlug === "_alpha" && (
                    <ArrowDown className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
              </TableHead>
              {selectedApps.map((app) => (
                <TableHead key={app.slug} className="text-center w-16">
                  <button
                    onClick={() => setSortBySlug(app.slug)}
                    className="flex items-center justify-center gap-0.5 mx-auto"
                    title={`Sort by ${app.name} ranking`}
                  >
                    {app.iconUrl ? (
                      <img src={app.iconUrl} alt={app.name} className="h-6 w-6 rounded" />
                    ) : (
                      <span className="text-xs font-bold">{app.name.charAt(0)}</span>
                    )}
                    {sortBySlug === app.slug && (
                      <ArrowDown className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                </TableHead>
              ))}
              <TableHead>Total Results</TableHead>
              <TableHead className="w-10" />
              {canEdit && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedKeywords.map((kw) => {
              const isPending = pendingKeywordIds.has(kw.keywordId);
              const isResolved = resolvedKeywordIds.has(kw.keywordId);
              return (
              <TableRow
                key={kw.keywordId}
                className={cn(
                  isPending && "animate-in fade-in slide-in-from-top duration-300",
                )}
              >
                <TableCell className="group/kw">
                  <div>
                    <Link
                      href={`/keywords/${kw.keywordSlug}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {kw.keyword}
                    </Link>
                    {(kw.tags?.length > 0 || canEdit) && (
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {kw.tags?.map((tag: any) => (
                          <KeywordTagBadge
                            key={tag.id}
                            tag={tag}
                            onRemove={
                              canEdit
                                ? () => unassignTag(tag.id, kw.keywordId)
                                : undefined
                            }
                          />
                        ))}
                        {canEdit && (
                          <KeywordTagManager
                            keywordId={kw.keywordId}
                            currentTags={kw.tags || []}
                            allTags={tags}
                            className="opacity-0 group-hover/kw:opacity-100 transition-opacity"
                            onAssign={(tagId) =>
                              assignTag(tagId, kw.keywordId)
                            }
                            onUnassign={(tagId) =>
                              unassignTag(tagId, kw.keywordId)
                            }
                            onCreateTag={createTag}
                            onDeleteTag={deleteTag}
                            onUpdateTag={updateTag}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>
                {selectedApps.map((app) => {
                  const position = kw.rankings?.[app.slug];
                  return (
                    <TableCell key={app.slug} className="text-center">
                      {isPending ? (
                        <Skeleton className="h-4 w-8 mx-auto" />
                      ) : isResolved ? (
                        <span className="animate-in fade-in duration-700 font-semibold text-sm">
                          {position != null ? `#${position}` : "\u2014"}
                        </span>
                      ) : position != null ? (
                        <span className="font-semibold text-sm">#{position}</span>
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell>
                  {isPending ? (
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-16" />
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    </div>
                  ) : isResolved ? (
                    <span className="animate-in fade-in duration-700">
                      {kw.latestSnapshot?.totalResults ?? "\u2014"}
                    </span>
                  ) : (
                    kw.latestSnapshot?.totalResults ?? "\u2014"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    {kw.hasSuggestions ? (
                      <button
                        onClick={() =>
                          setSuggestionsKeyword({
                            slug: kw.keywordSlug,
                            keyword: kw.keyword,
                          })
                        }
                        title={`Suggestions for "${kw.keyword}"`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
                      >
                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                      </button>
                    ) : (
                      <span className="inline-flex h-8 w-8" />
                    )}
                    <LiveSearchTrigger keyword={kw.keyword} variant="icon" />
                    <a
                      href={`https://apps.shopify.com/search?q=${encodeURIComponent(kw.keyword)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Search "${kw.keyword}" on Shopify`}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  </div>
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setConfirmRemove({
                          keywordId: kw.keywordId,
                          keyword: kw.keyword,
                        })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <ConfirmModal
        open={!!confirmRemove}
        title="Remove Keyword"
        description={`Are you sure you want to remove "${confirmRemove?.keyword}" from this app's keywords?`}
        onConfirm={() => {
          if (confirmRemove) {
            removeKeyword(confirmRemove.keywordId, confirmRemove.keyword);
            setConfirmRemove(null);
          }
        }}
        onCancel={() => setConfirmRemove(null)}
      />

      {suggestionsKeyword && (
        <KeywordSuggestionsModal
          keywordSlug={suggestionsKeyword.slug}
          keyword={suggestionsKeyword.keyword}
          appSlug={appSlug}
          open={!!suggestionsKeyword}
          onClose={() => setSuggestionsKeyword(null)}
          onKeywordAdded={(keywordId, scraperEnqueued) => {
            if (scraperEnqueued && keywordId) {
              setPendingKeywordIds((prev) => new Set(prev).add(keywordId));
            }
            loadKeywords(appSlugsParam, true);
            refreshUser();
          }}
        />
      )}
    </div>
  );
}
