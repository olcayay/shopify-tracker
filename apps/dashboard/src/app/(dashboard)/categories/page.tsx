"use client";

import { Fragment, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFormatDate } from "@/lib/format-date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Star,
  X,
  Search,
  Target,
  Eye,
} from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";

interface CategoryNode {
  slug: string;
  title: string;
  categoryLevel: number;
  parentSlug: string | null;
  appCount: number | null;
  isTracked: boolean;
  children: CategoryNode[];
}

interface StarredCategory {
  categorySlug: string;
  categoryTitle: string;
  parentSlug: string | null;
  createdAt: string;
  appCount: number | null;
  trackedInResults: number;
  competitorInResults: number;
  trackedAppsInResults: any[];
  competitorAppsInResults: any[];
}

export default function CategoriesPage() {
  const { fetchWithAuth, user } = useAuth();
  const { formatDateOnly } = useFormatDate();
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [starred, setStarred] = useState<StarredCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedStarred, setExpandedStarred] = useState<string | null>(null);
  const [confirmUnstar, setConfirmUnstar] = useState<{
    slug: string;
    title: string;
  } | null>(null);

  const canEdit = user?.role === "owner" || user?.role === "editor";

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [treeRes, starredRes] = await Promise.all([
      fetchWithAuth("/api/categories?format=tree"),
      fetchWithAuth("/api/account/starred-categories"),
    ]);
    if (treeRes.ok) setTree(await treeRes.json());
    if (starredRes.ok) setStarred(await starredRes.json());
    setLoading(false);
  }

  async function doUnstar(slug: string) {
    const res = await fetchWithAuth(
      `/api/account/starred-categories/${slug}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setStarred((prev) => prev.filter((s) => s.categorySlug !== slug));
    }
  }

  async function toggleStar(slug: string) {
    const isStarred = starredSlugs.has(slug);
    if (isStarred) {
      const cat = findCategoryBySlug(tree, slug);
      setConfirmUnstar({
        slug,
        title: cat?.title || slug,
      });
    } else {
      const res = await fetchWithAuth("/api/account/starred-categories", {
        method: "POST",
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        const starredRes = await fetchWithAuth(
          "/api/account/starred-categories"
        );
        if (starredRes.ok) setStarred(await starredRes.json());
      }
    }
  }

  function handleUnstarFromTable(slug: string, title: string) {
    setConfirmUnstar({ slug, title });
  }

  const toggle = useCallback((slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allSlugs = new Set<string>();
    function collect(nodes: CategoryNode[]) {
      for (const n of nodes) {
        if (n.children.length > 0) allSlugs.add(n.slug);
        collect(n.children);
      }
    }
    collect(tree);
    setExpanded(allSlugs);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  function countAll(nodes: CategoryNode[]): number {
    let count = 0;
    for (const n of nodes) {
      count += 1 + countAll(n.children);
    }
    return count;
  }

  function findCategoryBySlug(
    nodes: CategoryNode[],
    slug: string
  ): CategoryNode | null {
    for (const n of nodes) {
      if (n.slug === slug) return n;
      const found = findCategoryBySlug(n.children, slug);
      if (found) return found;
    }
    return null;
  }

  // Filter tree by search query
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree;
    const q = searchQuery.toLowerCase();

    function filterNodes(nodes: CategoryNode[]): CategoryNode[] {
      const result: CategoryNode[] = [];
      for (const node of nodes) {
        const matchesSelf = node.title.toLowerCase().includes(q);
        const filteredChildren = filterNodes(node.children);
        if (matchesSelf || filteredChildren.length > 0) {
          result.push({
            ...node,
            children: matchesSelf ? node.children : filteredChildren,
          });
        }
      }
      return result;
    }

    return filterNodes(tree);
  }, [tree, searchQuery]);

  // Auto-expand when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      const slugsToExpand = new Set<string>();
      function collectParents(nodes: CategoryNode[]) {
        for (const n of nodes) {
          if (n.children.length > 0) {
            slugsToExpand.add(n.slug);
            collectParents(n.children);
          }
        }
      }
      collectParents(filteredTree);
      setExpanded(slugsToExpand);
    }
  }, [filteredTree, searchQuery]);

  const totalCount = countAll(tree);
  const starredSlugs = new Set(starred.map((s) => s.categorySlug));

  // Build flat slug→node map for ancestor lookups
  const slugMap = useMemo(() => {
    const map = new Map<string, CategoryNode>();
    function collect(nodes: CategoryNode[]) {
      for (const n of nodes) {
        map.set(n.slug, n);
        collect(n.children);
      }
    }
    collect(tree);
    return map;
  }, [tree]);

  function getAncestors(slug: string): CategoryNode[] {
    const ancestors: CategoryNode[] = [];
    let node = slugMap.get(slug);
    while (node?.parentSlug) {
      const parent = slugMap.get(node.parentSlug);
      if (!parent) break;
      ancestors.unshift(parent);
      node = parent;
    }
    return ancestors;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories ({totalCount})</h1>
        <div className="flex items-center gap-2">
          <AdminScraperTrigger
            scraperType="category"
            label="Scrape All Categories"
          />
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Starred Categories */}
      {!searchQuery && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              Starred Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {starred.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Folder className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  No starred categories yet
                </p>
                <p className="text-xs text-muted-foreground/70 max-w-xs">
                  Star categories from the tree below or from category detail pages to track them here.
                </p>
              </div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Total Apps</TableHead>
                  <TableHead>Tracked</TableHead>
                  <TableHead>Competitor</TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {starred.map((s) => {
                  const ancestors = getAncestors(s.categorySlug);
                  const hasApps = s.trackedInResults > 0 || s.competitorInResults > 0;
                  const isExpanded = expandedStarred === s.categorySlug;
                  return (
                  <Fragment key={s.categorySlug}>
                  <TableRow
                    className={hasApps ? "cursor-pointer hover:bg-muted/50" : ""}
                    onClick={() => hasApps && setExpandedStarred(isExpanded ? null : s.categorySlug)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        {hasApps ? (
                          isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <span className="w-4 shrink-0" />
                        )}
                        {ancestors.map((a) => (
                          <span key={a.slug} className="flex items-center gap-1">
                            <Link
                              href={`/categories/${a.slug}`}
                              className="text-muted-foreground hover:underline hover:text-foreground"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {a.title}
                            </Link>
                            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          </span>
                        ))}
                        <Link
                          href={`/categories/${s.categorySlug}`}
                          className="text-primary hover:underline font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {s.categoryTitle}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.appCount != null ? s.appCount.toLocaleString() : "\u2014"}
                    </TableCell>
                    <TableCell>
                      {s.trackedInResults > 0 ? (
                        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50">
                          <Target className="h-3 w-3 mr-1" />
                          {s.trackedInResults}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">{"\u2014"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.competitorInResults > 0 ? (
                        <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50">
                          <Eye className="h-3 w-3 mr-1" />
                          {s.competitorInResults}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">{"\u2014"}</span>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            handleUnstarFromTable(
                              s.categorySlug,
                              s.categoryTitle
                            )
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 5 : 4} className="bg-muted/30 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {s.trackedAppsInResults?.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                                <Target className="h-3.5 w-3.5 text-primary" />
                                My Apps
                              </h4>
                              <div className="space-y-1">
                                {s.trackedAppsInResults.map((app: any) => (
                                  <div key={app.app_slug} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-emerald-500/10 border-l-2 border-l-emerald-500">
                                    <div className="flex items-center gap-2">
                                      {app.logo_url && (
                                        <img src={app.logo_url} alt="" className="h-5 w-5 rounded shrink-0" />
                                      )}
                                      <Link
                                        href={`/apps/${app.app_slug}`}
                                        className="text-primary hover:underline font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {app.name}
                                      </Link>
                                    </div>
                                    {app.position != null && (
                                      <span className="font-mono text-muted-foreground text-xs">
                                        #{app.position}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {s.competitorAppsInResults?.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                                <Eye className="h-3.5 w-3.5 text-yellow-500" />
                                Competitor Apps
                              </h4>
                              <div className="space-y-1">
                                {s.competitorAppsInResults.map((app: any) => (
                                  <div key={app.app_slug} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-amber-500/10 border-l-2 border-l-amber-500">
                                    <div className="flex items-center gap-2">
                                      {app.logo_url && (
                                        <img src={app.logo_url} alt="" className="h-5 w-5 rounded shrink-0" />
                                      )}
                                      <Link
                                        href={`/apps/${app.app_slug}`}
                                        className="text-primary hover:underline font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {app.name}
                                      </Link>
                                    </div>
                                    {app.position != null && (
                                      <span className="font-mono text-muted-foreground text-xs">
                                        #{app.position}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Categories Tree */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : filteredTree.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {searchQuery
                ? `No categories matching "${searchQuery}"`
                : "No categories found."}
            </p>
          ) : (
            <div className="space-y-0.5">
              {filteredTree.map((node) => (
                <CategoryRow
                  key={node.slug}
                  node={node}
                  expanded={expanded}
                  toggle={toggle}
                  toggleStar={canEdit ? toggleStar : undefined}
                  starredSlugs={starredSlugs}
                  depth={0}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={!!confirmUnstar}
        title="Remove Starred Category"
        description={`Are you sure you want to remove "${confirmUnstar?.title}" from starred categories?`}
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmUnstar) {
            doUnstar(confirmUnstar.slug);
            setConfirmUnstar(null);
          }
        }}
        onCancel={() => setConfirmUnstar(null)}
      />
    </div>
  );
}

function CategoryRow({
  node,
  expanded,
  toggle,
  toggleStar,
  starredSlugs,
  depth,
}: {
  node: CategoryNode;
  expanded: Set<string>;
  toggle: (slug: string) => void;
  toggleStar?: (slug: string) => void;
  starredSlugs: Set<string>;
  depth: number;
}) {
  const isOpen = expanded.has(node.slug);
  const hasChildren = node.children.length > 0;
  const isStarred = starredSlugs.has(node.slug);

  return (
    <>
      <div
        className="flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-muted/50 group"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => toggle(node.slug)}
            className="flex items-center justify-center w-5 h-5 shrink-0 text-muted-foreground hover:text-foreground"
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {hasChildren ? (
          isOpen ? (
            <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <Link
          href={`/categories/${node.slug}`}
          className="text-sm text-primary hover:underline font-medium truncate ml-1"
        >
          {node.title}
        </Link>

        {hasChildren && (
          <span className="text-xs text-muted-foreground ml-1 shrink-0">
            ({node.children.length})
          </span>
        )}

        {toggleStar && (
          <button
            onClick={() => toggleStar(node.slug)}
            className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0"
          >
            <Star
              className={`h-3.5 w-3.5 ${isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}
            />
          </button>
        )}

        <span className="flex-1" />

        {node.appCount != null && (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {node.appCount.toLocaleString()} apps
          </span>
        )}
      </div>

      {isOpen &&
        hasChildren &&
        node.children.map((child) => (
          <CategoryRow
            key={child.slug}
            node={child}
            expanded={expanded}
            toggle={toggle}
            toggleStar={toggleStar}
            starredSlugs={starredSlugs}
            depth={depth + 1}
          />
        ))}
    </>
  );
}
