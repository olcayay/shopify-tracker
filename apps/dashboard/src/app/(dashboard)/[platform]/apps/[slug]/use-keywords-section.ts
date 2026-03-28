"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isPlatformId, PLATFORMS } from "@appranks/shared";
import type { PlatformId } from "@appranks/shared";
import type { KeywordOpportunityMetrics } from "@appranks/shared";
import { extractWordGroups, filterKeywordsByWord } from "@/lib/keyword-word-groups";
import type { SimpleApp } from "./keywords-section-types";
import { getDetailValue } from "./keywords-section-types";

export function useKeywordsSection(appSlug: string) {
  const { platform } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
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
  const [activeTagFilter, setActiveTagFilter] = useState<Set<string>>(new Set());
  const [activeWordFilter, setActiveWordFilter] = useState<string | null>(null);
  const [pendingKeywordIds, setPendingKeywordIds] = useState<Set<number>>(new Set());
  const [resolvedKeywordIds, setResolvedKeywordIds] = useState<Set<number>>(new Set());
  const [opportunityData, setOpportunityData] = useState<Record<string, KeywordOpportunityMetrics>>({});
  const [opportunityLoading, setOpportunityLoading] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
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
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Suggestions modal state
  const [suggestionsKeyword, setSuggestionsKeyword] = useState<{
    slug: string;
    keyword: string;
  } | null>(null);

  const canEdit = user?.role === "owner" || user?.role === "editor";

  function handleSort(key: string) {
    if (sortBySlug === key) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBySlug(key);
      setSortDirection(key === "_alpha" || !key.startsWith("_") ? "asc" : "desc");
    }
  }

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

  // Sorted keywords by selected app ranking, alphabetically, or by score
  const sortedKeywords = useMemo(() => {
    if (!sortBySlug || filteredKeywords.length === 0) return filteredKeywords;
    const dir = sortDirection === "asc" ? 1 : -1;
    if (sortBySlug === "_alpha") {
      return [...filteredKeywords].sort((a, b) =>
        dir * a.keyword.localeCompare(b.keyword)
      );
    }
    if (sortBySlug === "_score") {
      return [...filteredKeywords].sort((a, b) => {
        const scoreA = opportunityData[a.keywordSlug]?.opportunityScore ?? -1;
        const scoreB = opportunityData[b.keywordSlug]?.opportunityScore ?? -1;
        return dir * (scoreA - scoreB);
      });
    }
    if (sortBySlug.startsWith("_s_") || sortBySlug.startsWith("_fp_") || sortBySlug.startsWith("_c_")) {
      return [...filteredKeywords].sort((a, b) => {
        const dataA = opportunityData[a.keywordSlug];
        const dataB = opportunityData[b.keywordSlug];
        const valA = dataA ? getDetailValue(sortBySlug, dataA) : null;
        const valB = dataB ? getDetailValue(sortBySlug, dataB) : null;
        if (valA != null && valB != null) return dir * (valA - valB);
        if (valA != null) return -1;
        if (valB != null) return 1;
        return 0;
      });
    }
    return [...filteredKeywords].sort((a, b) => {
      const posA = a.rankings?.[sortBySlug];
      const posB = b.rankings?.[sortBySlug];
      if (posA != null && posB != null) return dir * (posA - posB);
      if (posA != null) return -1;
      if (posB != null) return 1;
      return 0;
    });
  }, [filteredKeywords, sortBySlug, sortDirection, opportunityData]);

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

  // Fetch opportunity scores when keywords change
  useEffect(() => {
    if (keywords.length === 0) return;
    const slugs = keywords.map((kw: any) => kw.keywordSlug).filter(Boolean);
    if (slugs.length === 0) return;
    setOpportunityLoading(true);
    fetchWithAuth("/api/keywords/opportunity", {
      method: "POST",
      body: JSON.stringify({ slugs }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setOpportunityData(data);
        }
      })
      .catch(() => {})
      .finally(() => setOpportunityLoading(false));
  }, [keywords]);

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

  return {
    // Platform
    platform: platform as string,
    caps,

    // Auth
    account,
    canEdit,

    // Keywords data
    keywords,
    loading,
    sortedKeywords,
    wordGroups,
    trackedKeywordIds,

    // Search
    query,
    suggestions,
    showSuggestions,
    searchLoading,
    searchRef,
    handleSearchInput,
    setShowSuggestions,
    addKeyword,

    // Messages
    message,

    // Remove confirmation
    confirmRemove,
    setConfirmRemove,
    removeKeyword,

    // Tags
    tags,
    activeTagFilter,
    toggleTagFilter,
    setActiveTagFilter,
    assignTag,
    unassignTag,
    createTag,
    deleteTag,
    updateTag,

    // Word filter
    activeWordFilter,
    setActiveWordFilter,

    // App selector
    mainApp,
    competitors,
    selectedSlugs,
    dragIndex,
    dragOverIndex,
    toggleCompetitor,
    toggleAll,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,

    // Table / sorting
    selectedApps,
    appSlugsParam,
    pendingKeywordIds,
    setPendingKeywordIds,
    resolvedKeywordIds,
    opportunityData,
    opportunityLoading,
    showScoreDetails,
    setShowScoreDetails,
    sortBySlug,
    sortDirection,
    handleSort,

    // Suggestions modal
    suggestionsKeyword,
    setSuggestionsKeyword,

    // Reload
    loadKeywords,
    refreshUser,
  };
}
