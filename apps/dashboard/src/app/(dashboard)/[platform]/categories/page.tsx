"use client";

import { Fragment, useState, useCallback, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "@/components/ui/link";
import { AppIcon } from "@/components/app-icon";
import { useAuth } from "@/lib/auth-context";
import { useApiQuery, useQueryClient } from "@/lib/use-api-query";
import { useFormatDate } from "@/lib/format-date";
import { formatNumber } from "@/lib/format-utils";
import { TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
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
  Bookmark,
  X,
  Search,
  Target,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";
import { PLATFORMS, type PlatformId } from "@appranks/shared";

interface CategoryNode {
  slug: string;
  title: string;
  categoryLevel: number;
  parentSlug: string | null;
  appCount: number | null;
  isTracked: boolean;
  isListingPage: boolean;
  children: CategoryNode[];
}

interface FlatCategory {
  id: number;
  slug: string;
  title: string;
  appCount: number | null;
  isTracked: boolean;
  isListingPage: boolean;
}

interface StarredCategory {
  categorySlug: string;
  categoryTitle: string;
  parentSlug: string | null;
  parents: { slug: string; title: string }[];
  createdAt: string | null;
  appCount: number | null;
  trackedInResults: number;
  competitorInResults: number;
  trackedAppsInResults: any[];
  competitorAppsInResults: any[];
  source: "starred" | "auto" | "both";
}

type FlatSortKey = "title" | "appCount";
type SortDir = "asc" | "desc";

export default function CategoriesPage() {
  const { platform } = useParams();
  const { fetchWithAuth, user } = useAuth();
  const { formatDateOnly } = useFormatDate();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedStarred, setExpandedStarred] = useState<string | null>(null);
  const [confirmUnstar, setConfirmUnstar] = useState<{
    slug: string;
    title: string;
  } | null>(null);
  const [sortKey, setSortKey] = useState<FlatSortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const isFlat = PLATFORMS[platform as PlatformId]?.hasFlatCategories ?? false;
  const canEdit = user?.role === "owner" || user?.role === "admin" || user?.role === "editor";

  const format = isFlat ? "flat" : "tree";

  // Fetch categories via TanStack Query
  const { data: rawCategories = [], isLoading: categoriesLoading } = useApiQuery<any[]>(
    ["categories", platform, format],
    `/api/categories?format=${format}`,
  );

  // Fetch starred categories via TanStack Query
  const { data: starred = [], isLoading: starredLoading } = useApiQuery<StarredCategory[]>(
    ["starred-categories", platform],
    "/api/account/starred-categories",
  );

  const loading = categoriesLoading || starredLoading;

  // Split raw categories into tree vs flat based on platform
  const tree: CategoryNode[] = isFlat ? [] : rawCategories;
  const flatCategories: FlatCategory[] = isFlat ? rawCategories : [];

  const invalidateStarred = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["starred-categories", platform] });
  }, [queryClient, platform]);

  async function doUnstar(slug: string) {
    const res = await fetchWithAuth(
      `/api/account/starred-categories/${slug}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      invalidateStarred();
    }
  }

  const starredSlugs = new Set(starred.filter((s) => s.source === "starred" || s.source === "both").map((s) => s.categorySlug));

  async function toggleStar(slug: string) {
    const isStarred = starredSlugs.has(slug);
    if (isStarred) {
      let title = slug;
      if (isFlat) {
        const cat = flatCategories.find((c) => c.slug === slug);
        if (cat) title = cat.title;
      } else {
        const cat = findCategoryBySlug(tree, slug);
        if (cat) title = cat.title;
      }
      setConfirmUnstar({ slug, title });
    } else {
      const res = await fetchWithAuth("/api/account/starred-categories", {
        method: "POST",
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        invalidateStarred();
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

  // Flat: filter & sort
  const filteredFlatTags = useMemo(() => {
    let items = flatCategories;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((c) => c.title.toLowerCase().includes(q));
    }
    items = [...items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") {
        cmp = a.title.localeCompare(b.title);
      } else {
        cmp = (a.appCount ?? 0) - (b.appCount ?? 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [flatCategories, searchQuery, sortKey, sortDir]);

  // Split browse tags from regular tags
  const { browseTags, regularTags } = useMemo(() => {
    const browse: FlatCategory[] = [];
    const regular: FlatCategory[] = [];
    for (const tag of filteredFlatTags) {
      if (tag.slug.startsWith("_browse_")) {
        browse.push(tag);
      } else {
        regular.push(tag);
      }
    }
    return { browseTags: browse, regularTags: regular };
  }, [filteredFlatTags]);

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

  const totalCount = isFlat ? flatCategories.length : countAll(tree);

  function toggleFlatSort(key: FlatSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "title" ? "asc" : "desc");
    }
  }

  function FlatSortIcon({ col }: { col: FlatSortKey }) {
    if (sortKey !== col)
      return <ArrowUpDown className="inline h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="inline h-3.5 w-3.5 ml-1" />
    ) : (
      <ArrowDown className="inline h-3.5 w-3.5 ml-1" />
    );
  }

  const isTagPlatform = platform === "wordpress";
  const entityLabel = isTagPlatform ? "Tags" : "Categories";
  const entityLabelLower = isTagPlatform ? "tags" : "categories";
  const entitySingular = isTagPlatform ? "Tag" : "Category";
  const appNoun = isTagPlatform ? "Plugins" : "Apps";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {entityLabel} {loading ? (
            <Skeleton className="inline-block h-6 w-12 align-middle" />
          ) : (
            <>({totalCount})</>
          )}
        </h1>
        <AdminScraperTrigger
          scraperType="category"
          label={`Scrape All ${entityLabel}`}
        />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Filter ${entityLabelLower}...`}
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
              <Folder className="h-4 w-4 text-muted-foreground" />
              My {entityLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton rows={3} cols={4} />
            ) : starred.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Folder className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  No {entityLabelLower} to show
                </p>
                <p className="text-xs text-muted-foreground/70 max-w-xs">
                  Star {entityLabelLower} or start tracking apps to auto-detect their {entityLabelLower}.
                </p>
              </div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-full">{entitySingular}</TableHead>
                  {!isFlat && <TableHead>Parents</TableHead>}
                  <TableHead className="text-right">Total {appNoun}</TableHead>
                  <TableHead className="text-right">Tracked</TableHead>
                  <TableHead className="text-right">Competitor</TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {starred.map((s) => {
                  const hasApps = s.trackedInResults > 0 || s.competitorInResults > 0;
                  const isExpanded = expandedStarred === s.categorySlug;
                  const parents = s.parents ?? [];
                  const colSpan = isFlat ? (canEdit ? 5 : 4) : (canEdit ? 6 : 5);
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
                        <Link
                          href={`/${platform}/categories/${s.categorySlug}`}
                          className="text-primary hover:underline font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {s.categoryTitle}
                        </Link>
                        {(s.source === "starred" || s.source === "both") && (
                          <Bookmark className="h-3 w-3 fill-amber-500 text-amber-500 shrink-0" />
                        )}
                        {(s.source === "auto" || s.source === "both") && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">Auto</Badge>
                        )}
                      </div>
                    </TableCell>
                    {!isFlat && (
                    <TableCell>
                      {parents.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {parents.map((p, i) => (
                            <span key={p.slug} className="flex items-center text-sm">
                              <Link
                                href={`/${platform}/categories/${p.slug}`}
                                className="text-muted-foreground hover:underline hover:text-foreground"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {p.title}
                              </Link>
                              {i < parents.length - 1 && <span className="text-muted-foreground mx-1">,</span>}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{"\u2014"}</span>
                      )}
                    </TableCell>
                    )}
                    <TableCell className="text-right">
                      {s.appCount != null ? formatNumber(s.appCount) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.trackedInResults > 0 ? (
                        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50">
                          <Target className="h-3 w-3 mr-1" />
                          {s.trackedInResults}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">{"\u2014"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
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
                        {s.source !== "auto" && (
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
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="bg-muted/30 p-4">
                        <div className="space-y-1">
                          {[
                            ...(s.trackedAppsInResults ?? []).map((app: any) => ({ ...app, _type: "tracked" as const })),
                            ...(s.competitorAppsInResults ?? []).map((app: any) => ({ ...app, _type: "competitor" as const })),
                          ]
                            .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
                            .map((app: any) => {
                              const isTracked = app._type === "tracked";
                              return (
                                <div
                                  key={app.app_slug}
                                  className={`flex items-center justify-between text-sm py-1 px-2 rounded border-l-2 ${
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
                                    <AppIcon src={app.logo_url} className="h-5 w-5 rounded" />
                                    <Link
                                      href={`/${platform}/apps/${app.app_slug}`}
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
                              );
                            })}
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

      {/* Flat view for WordPress / Zoom / Atlassian */}
      {isFlat ? (
        <>
          {/* Browse sections (WordPress only) */}
          {isTagPlatform && !searchQuery && browseTags.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Browse Sections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {browseTags.map((tag) => {
                    const label = tag.title.replace(/^Browse:\s*/i, "");
                    return (
                      <Link
                        key={tag.slug}
                        href={`/${platform}/categories/${tag.slug}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        {label}
                        {tag.appCount != null && (
                          <span className="text-xs opacity-70">
                            ({formatNumber(tag.appCount)})
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Regular flat categories/tags table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">All {entityLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={8} cols={4} />
              ) : regularTags.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {searchQuery
                    ? `No ${entityLabelLower} matching "${searchQuery}"`
                    : `No ${entityLabelLower} found.`}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          onClick={() => toggleFlatSort("title")}
                          className="flex items-center font-medium hover:text-foreground transition-colors"
                        >
                          {entitySingular}
                          <FlatSortIcon col="title" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => toggleFlatSort("appCount")}
                          className="flex items-center font-medium hover:text-foreground transition-colors"
                        >
                          {appNoun}
                          <FlatSortIcon col="appCount" />
                        </button>
                      </TableHead>
                      {canEdit && <TableHead className="w-12" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regularTags.map((tag) => {
                      const isStarred = starredSlugs.has(tag.slug);
                      return (
                        <TableRow key={tag.slug} className="group">
                          <TableCell>
                            <Link
                              href={`/${platform}/categories/${tag.slug}`}
                              className="text-sm text-primary hover:underline font-medium"
                            >
                              {tag.title}
                            </Link>
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {tag.appCount != null
                              ? formatNumber(tag.appCount)
                              : "\u2014"}
                          </TableCell>
                          {canEdit && (
                            <TableCell>
                              <button
                                onClick={() => toggleStar(tag.slug)}
                                className={`${
                                  isStarred
                                    ? "opacity-100"
                                    : "opacity-0 group-hover:opacity-100"
                                } transition-opacity`}
                              >
                                <Bookmark
                                  className={`h-3.5 w-3.5 ${
                                    isStarred
                                      ? "fill-amber-500 text-amber-500"
                                      : "text-muted-foreground hover:text-amber-500"
                                  }`}
                                />
                              </button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        /* All Categories Tree */
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">All Categories</CardTitle>
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
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton rows={8} cols={5} />
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
      )}

      <ConfirmModal
        open={!!confirmUnstar}
        title={`Remove Bookmark`}
        description={`Are you sure you want to remove the bookmark from "${confirmUnstar?.title}"? If the ${entitySingular.toLowerCase()} is auto-detected from your tracked apps, it will remain visible.`}
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
  const { platform } = useParams();
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
          href={`/${platform}/categories/${node.slug}`}
          className="text-sm text-primary hover:underline font-medium truncate ml-1"
        >
          {node.title}
        </Link>

        {hasChildren && (
          <span className="text-xs text-muted-foreground ml-1 shrink-0">
            ({node.children.length})
          </span>
        )}

        {!node.isListingPage && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1 shrink-0">
            Hub
          </Badge>
        )}

        {toggleStar && (
          <button
            onClick={() => toggleStar(node.slug)}
            className={`${isStarred ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity ml-1 shrink-0`}
          >
            <Bookmark
              className={`h-3.5 w-3.5 ${isStarred ? "fill-amber-500 text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}
            />
          </button>
        )}

        <span className="flex-1" />

        {node.isListingPage && node.appCount != null && (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {formatNumber(node.appCount)} apps
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
