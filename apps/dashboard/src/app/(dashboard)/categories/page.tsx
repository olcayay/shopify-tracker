"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
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
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Star,
  X,
  Search,
} from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";

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
}

export default function CategoriesPage() {
  const { fetchWithAuth, user } = useAuth();
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [starred, setStarred] = useState<StarredCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories ({totalCount})</h1>
        <div className="flex gap-2">
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
      {starred.length > 0 && !searchQuery && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              Starred Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Added</TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {starred.map((s) => (
                  <TableRow key={s.categorySlug}>
                    <TableCell>
                      <Link
                        href={`/categories/${s.categorySlug}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {s.categoryTitle}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
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
                ))}
              </TableBody>
            </Table>
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
