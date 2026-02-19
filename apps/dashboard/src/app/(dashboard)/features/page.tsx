"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFormatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Star,
  Search,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Target,
  Eye,
} from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";

interface FeatureNode {
  handle: string;
  title: string;
}

interface SubcategoryNode {
  title: string;
  features: FeatureNode[];
}

interface CategoryNode {
  title: string;
  subcategories: SubcategoryNode[];
}

export default function FeaturesPage() {
  const { fetchWithAuth, user, refreshUser } = useAuth();
  const { formatDateOnly } = useFormatDate();
  const [features, setFeatures] = useState<any[]>([]);
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<{
    handle: string;
    title: string;
  } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filterQuery, setFilterQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const canEdit = user?.role === "owner" || user?.role === "editor";

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadData() {
    setLoading(true);
    const [starredRes, treeRes] = await Promise.all([
      fetchWithAuth("/api/account/starred-features"),
      fetchWithAuth("/api/features/tree"),
    ]);
    if (starredRes.ok) setFeatures(await starredRes.json());
    if (treeRes.ok) setTree(await treeRes.json());
    setLoading(false);
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
        `/api/features/search?q=${encodeURIComponent(value)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(true);
      }
      setSearchLoading(false);
    }, 300);
  }

  async function starFeature(handle: string, title: string) {
    setMessage("");
    const res = await fetchWithAuth("/api/account/starred-features", {
      method: "POST",
      body: JSON.stringify({ handle, title }),
    });
    if (res.ok) {
      setMessage(`"${title}" starred.`);
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
      const starredRes = await fetchWithAuth("/api/account/starred-features");
      if (starredRes.ok) setFeatures(await starredRes.json());
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to star feature");
    }
  }

  async function unstarFeature(handle: string, title: string) {
    setMessage("");
    const res = await fetchWithAuth(
      `/api/account/starred-features/${encodeURIComponent(handle)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setMessage(`"${title}" unstarred.`);
      const starredRes = await fetchWithAuth("/api/account/starred-features");
      if (starredRes.ok) setFeatures(await starredRes.json());
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to unstar feature");
    }
  }

  const starredHandles = new Set(features.map((f) => f.featureHandle));

  // Count total features in tree
  const totalFeatures = useMemo(() => {
    let count = 0;
    for (const cat of tree) {
      for (const sub of cat.subcategories) {
        count += sub.features.length;
      }
    }
    return count;
  }, [tree]);

  // Filter tree by search
  const filteredTree = useMemo(() => {
    if (!filterQuery.trim()) return tree;
    const q = filterQuery.toLowerCase();

    return tree
      .map((cat) => {
        const matchesCat = cat.title.toLowerCase().includes(q);
        const filteredSubs = cat.subcategories
          .map((sub) => {
            const matchesSub = sub.title.toLowerCase().includes(q);
            const filteredFeatures = sub.features.filter((f) =>
              f.title.toLowerCase().includes(q)
            );
            if (matchesCat || matchesSub) return sub;
            if (filteredFeatures.length > 0)
              return { ...sub, features: filteredFeatures };
            return null;
          })
          .filter(Boolean) as SubcategoryNode[];

        if (filteredSubs.length > 0) return { ...cat, subcategories: filteredSubs };
        return null;
      })
      .filter(Boolean) as CategoryNode[];
  }, [tree, filterQuery]);

  // Auto-expand when filtering
  useEffect(() => {
    if (filterQuery.trim()) {
      const slugsToExpand = new Set<string>();
      for (const cat of filteredTree) {
        slugsToExpand.add(`cat:${cat.title}`);
        for (const sub of cat.subcategories) {
          slugsToExpand.add(`sub:${cat.title}:${sub.title}`);
        }
      }
      setExpanded(slugsToExpand);
    }
  }, [filteredTree, filterQuery]);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set<string>();
    for (const cat of tree) {
      all.add(`cat:${cat.title}`);
      for (const sub of cat.subcategories) {
        all.add(`sub:${cat.title}:${sub.title}`);
      }
    }
    setExpanded(all);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Features ({totalFeatures})</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Expand All
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            onClick={collapseAll}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Collapse All
          </button>
        </div>
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      {/* Search to star */}
      {canEdit && (
        <div ref={searchRef} className="relative max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search features to star..."
              value={query}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() =>
                suggestions.length > 0 && setShowSuggestions(true)
              }
              className="pl-9"
            />
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
              {suggestions.map((s: any) => (
                <button
                  key={s.handle}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                  onClick={() => {
                    if (starredHandles.has(s.handle)) return;
                    starFeature(s.handle, s.title);
                  }}
                >
                  <span>{s.title}</span>
                  {starredHandles.has(s.handle) ? (
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ) : (
                    <Star className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}
          {showSuggestions &&
            query.length >= 1 &&
            suggestions.length === 0 &&
            !searchLoading && (
              <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md p-3 text-sm text-muted-foreground">
                No features found for &ldquo;{query}&rdquo;
              </div>
            )}
        </div>
      )}

      {/* Starred Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            Starred Features ({features.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">
              Loading...
            </p>
          ) : features.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Apps</TableHead>
                  <TableHead>Tracked</TableHead>
                  <TableHead>Competitor</TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((f) => (
                  <TableRow key={f.featureHandle}>
                    <TableCell>
                      <Link
                        href={`/features/${encodeURIComponent(f.featureHandle)}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {f.featureTitle}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[f.categoryTitle, f.subcategoryTitle]
                        .filter(Boolean)
                        .join(" > ") || "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {f.appCount ?? "\u2014"}
                    </TableCell>
                    <TableCell>
                      {f.trackedInFeature > 0 ? (
                        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50">
                          <Target className="h-3 w-3 mr-1" />
                          {f.trackedInFeature}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">{"\u2014"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {f.competitorInFeature > 0 ? (
                        <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50">
                          <Eye className="h-3 w-3 mr-1" />
                          {f.competitorInFeature}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">{"\u2014"}</span>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setConfirmRemove({
                              handle: f.featureHandle,
                              title: f.featureTitle,
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No starred features yet. Use the search above to find and star features.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filter tree */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter features..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* All Features Tree */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : filteredTree.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {filterQuery
                ? `No features matching "${filterQuery}"`
                : "No features found."}
            </p>
          ) : (
            <div className="space-y-0.5">
              {filteredTree.map((cat) => {
                const catKey = `cat:${cat.title}`;
                const isCatOpen = expanded.has(catKey);
                const catFeatureCount = cat.subcategories.reduce(
                  (sum, sub) => sum + sub.features.length,
                  0
                );

                return (
                  <div key={cat.title}>
                    {/* Category row */}
                    <div
                      className="flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-muted/50 cursor-pointer group"
                      onClick={() => toggle(catKey)}
                    >
                      <button className="flex items-center justify-center w-5 h-5 shrink-0 text-muted-foreground">
                        {isCatOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      {isCatOpen ? (
                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <Link
                        href={`/features/category?category=${encodeURIComponent(cat.title)}`}
                        className="text-sm text-primary hover:underline font-medium truncate ml-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {cat.title}
                      </Link>
                      <span className="text-xs text-muted-foreground ml-1 shrink-0">
                        ({catFeatureCount})
                      </span>
                    </div>

                    {/* Subcategories */}
                    {isCatOpen &&
                      cat.subcategories.map((sub) => {
                        const subKey = `sub:${cat.title}:${sub.title}`;
                        const isSubOpen = expanded.has(subKey);

                        return (
                          <div key={sub.title}>
                            {/* Subcategory row */}
                            <div
                              className="flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-muted/50 cursor-pointer group"
                              style={{ paddingLeft: "32px" }}
                              onClick={() => toggle(subKey)}
                            >
                              <button className="flex items-center justify-center w-5 h-5 shrink-0 text-muted-foreground">
                                {isSubOpen ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                              {isSubOpen ? (
                                <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <Link
                                href={`/features/category?${new URLSearchParams({ category: cat.title, subcategory: sub.title }).toString()}`}
                                className="text-sm text-primary hover:underline font-medium truncate ml-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {sub.title}
                              </Link>
                              <span className="text-xs text-muted-foreground ml-1 shrink-0">
                                ({sub.features.length})
                              </span>
                            </div>

                            {/* Features */}
                            {isSubOpen &&
                              sub.features.map((feat) => {
                                const isStarred = starredHandles.has(feat.handle);
                                return (
                                  <div
                                    key={feat.handle}
                                    className="flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-muted/50 group"
                                    style={{ paddingLeft: "64px" }}
                                  >
                                    <span className="w-5 shrink-0" />
                                    <span className="w-4 shrink-0" />
                                    <Link
                                      href={`/features/${encodeURIComponent(feat.handle)}`}
                                      className="text-sm text-primary hover:underline truncate ml-1"
                                    >
                                      {feat.title}
                                    </Link>
                                    {canEdit ? (
                                      <button
                                        onClick={() =>
                                          isStarred
                                            ? setConfirmRemove({ handle: feat.handle, title: feat.title })
                                            : starFeature(feat.handle, feat.title)
                                        }
                                        className={isStarred ? "ml-1 shrink-0" : "opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0"}
                                      >
                                        <Star className={`h-3.5 w-3.5 ${isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`} />
                                      </button>
                                    ) : isStarred ? (
                                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0 ml-1" />
                                    ) : null}
                                  </div>
                                );
                              })}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={!!confirmRemove}
        title="Unstar Feature"
        description={`Are you sure you want to unstar "${confirmRemove?.title}"?`}
        confirmLabel="Unstar"
        onConfirm={() => {
          if (confirmRemove) {
            unstarFeature(confirmRemove.handle, confirmRemove.title);
            setConfirmRemove(null);
          }
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
