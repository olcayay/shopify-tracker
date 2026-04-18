"use client";

import { Fragment, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFormatDate } from "@/lib/format-date";
import { TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
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
  Bookmark,
  Search,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Target,
  Eye,
  Layers,
} from "lucide-react";
import { AppIcon } from "@/components/app-icon";
import { ConfirmModal } from "@/components/confirm-modal";
import {
  buildFeatureCategoryPath,
  buildFeatureSubcategoryPath,
} from "@/lib/feature-category-links";

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
  const { platform } = useParams();
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
  const [myFeatures, setMyFeatures] = useState<any[]>([]);
  const [myFeaturesOpen, setMyFeaturesOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(`my-features-open-${platform}`);
      return saved === "true";
    } catch { return false; }
  });
  const [expandedMyFeature, setExpandedMyFeature] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const canEdit = user?.role === "owner" || user?.role === "admin" || user?.role === "editor";

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
    const [starredRes, treeRes, myFeatRes] = await Promise.all([
      fetchWithAuth("/api/account/starred-features"),
      fetchWithAuth("/api/features/tree"),
      fetchWithAuth(`/api/account/my-features?platform=${platform}`),
    ]);
    if (starredRes.ok) setFeatures(await starredRes.json());
    if (treeRes.ok) setTree(await treeRes.json());
    if (myFeatRes.ok) setMyFeatures(await myFeatRes.json());
    setLoading(false);
  }

  function toggleMyFeaturesOpen() {
    setMyFeaturesOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(`my-features-open-${platform}`, String(next)); } catch {}
      return next;
    });
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

  // Filter My Features by search query
  const filteredMyFeatures = useMemo(() => {
    if (!filterQuery.trim()) return myFeatures;
    const q = filterQuery.toLowerCase();
    return myFeatures.filter((f) => f.title.toLowerCase().includes(q));
  }, [myFeatures, filterQuery]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">
          Features {loading ? (
            <Skeleton className="inline-block h-6 w-12 align-middle" />
          ) : (
            <>({totalFeatures})</>
          )}
        </h1>
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
                    <Bookmark className="h-4 w-4 fill-amber-500 text-amber-500" />
                  ) : (
                    <Bookmark className="h-4 w-4 text-muted-foreground" />
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

      {/* Bookmarked Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 fill-amber-500 text-amber-500" />
            Bookmarked Features ({features.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} cols={5} />
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
                        href={`/${platform}/features/${encodeURIComponent(f.featureHandle)}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {f.featureTitle}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {f.categoryTitle ? (
                        <>
                          <Link
                            href={buildFeatureCategoryPath(platform as string, f.categoryTitle)}
                            className="hover:underline hover:text-foreground"
                          >
                            {f.categoryTitle}
                          </Link>
                          {f.subcategoryTitle && (
                            <>
                              {" > "}
                              <Link
                                href={buildFeatureSubcategoryPath(platform as string, f.categoryTitle, f.subcategoryTitle)}
                                className="hover:underline hover:text-foreground"
                              >
                                {f.subcategoryTitle}
                              </Link>
                            </>
                          )}
                        </>
                      ) : "\u2014"}
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
              No bookmarked features yet. Use the search above to find and bookmark features.
            </p>
          )}
        </CardContent>
      </Card>

      {/* My Features */}
      {myFeatures.length > 0 && (
        <Card>
          <CardHeader className="pb-3 cursor-pointer" onClick={toggleMyFeaturesOpen}>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              My Features ({myFeatures.length})
              {myFeaturesOpen ? (
                <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
              )}
            </CardTitle>
          </CardHeader>
          {myFeaturesOpen && (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-full">Feature</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Tracked</TableHead>
                    <TableHead className="text-right">Competitor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filterQuery ? filteredMyFeatures : myFeatures).map((f: any) => {
                    const hasApps = f.trackedApps.length > 0 || f.competitorApps.length > 0;
                    const isExpanded = expandedMyFeature === f.handle;
                    return (
                      <Fragment key={f.handle}>
                        <TableRow
                          className={hasApps ? "cursor-pointer hover:bg-muted/50" : ""}
                          onClick={() => hasApps && setExpandedMyFeature(isExpanded ? null : f.handle)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              {hasApps ? (
                                isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <span className="w-4 shrink-0" />
                              )}
                              <Link
                                href={`/${platform}/features/${encodeURIComponent(f.handle)}`}
                                className="text-primary hover:underline font-medium"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {f.title}
                              </Link>
                              {starredHandles.has(f.handle) && (
                                <Bookmark className="h-3 w-3 fill-amber-500 text-amber-500 shrink-0" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {f.categoryTitle ? (
                              <>
                                <Link
                                  href={buildFeatureCategoryPath(platform as string, f.categoryTitle)}
                                  className="hover:underline hover:text-foreground"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {f.categoryTitle}
                                </Link>
                                {f.subcategoryTitle && (
                                  <>
                                    {" > "}
                                    <Link
                                      href={buildFeatureSubcategoryPath(platform as string, f.categoryTitle, f.subcategoryTitle)}
                                      className="hover:underline hover:text-foreground"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {f.subcategoryTitle}
                                    </Link>
                                  </>
                                )}
                              </>
                            ) : "\u2014"}
                          </TableCell>
                          <TableCell className="text-right">
                            {f.trackedApps.length > 0 ? (
                              <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50">
                                <Target className="h-3 w-3 mr-1" />
                                {f.trackedApps.length}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">{"\u2014"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {f.competitorApps.length > 0 ? (
                              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50">
                                <Eye className="h-3 w-3 mr-1" />
                                {f.competitorApps.length}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">{"\u2014"}</span>
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={4} className="bg-muted/30 p-4">
                              <div className="space-y-1">
                                {[
                                  ...f.trackedApps.map((app: any) => ({ ...app, _type: "tracked" as const })),
                                  ...f.competitorApps.map((app: any) => ({ ...app, _type: "competitor" as const })),
                                ].map((app: any) => {
                                  const isTracked = app._type === "tracked";
                                  return (
                                    <div
                                      key={app.slug}
                                      className={`flex items-center text-sm py-1 px-2 rounded border-l-2 ${
                                        isTracked
                                          ? "bg-emerald-500/10 border-l-emerald-500"
                                          : "bg-amber-500/10 border-l-amber-500"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        {isTracked
                                          ? <Target className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                          : <Eye className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                        }
                                        <AppIcon src={app.iconUrl} className="h-5 w-5 rounded" />
                                        <Link
                                          href={`/${platform}/apps/${app.slug}`}
                                          className="text-primary hover:underline font-medium"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {app.name}
                                        </Link>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                  {filterQuery && filteredMyFeatures.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                        No features matching &ldquo;{filterQuery}&rdquo;
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      )}

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
            <TableSkeleton rows={8} cols={4} />
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
                        href={buildFeatureCategoryPath(platform as string, cat.title)}
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
                                href={buildFeatureSubcategoryPath(platform as string, cat.title, sub.title)}
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
                                      href={`/${platform}/features/${encodeURIComponent(feat.handle)}`}
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
                                        <Bookmark className={`h-3.5 w-3.5 ${isStarred ? "fill-amber-500 text-amber-500" : "text-muted-foreground hover:text-amber-500"}`} />
                                      </button>
                                    ) : isStarred ? (
                                      <Bookmark className="h-3.5 w-3.5 fill-amber-500 text-amber-500 shrink-0 ml-1" />
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
        title="Remove Bookmark"
        description={`Remove bookmark for "${confirmRemove?.title}"?`}
        confirmLabel="Remove"
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
