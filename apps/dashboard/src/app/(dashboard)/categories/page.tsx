"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";

interface CategoryNode {
  slug: string;
  title: string;
  categoryLevel: number;
  parentSlug: string | null;
  appCount: number | null;
  isTracked: boolean;
  children: CategoryNode[];
}

export default function CategoriesPage() {
  const { fetchWithAuth } = useAuth();
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    const res = await fetchWithAuth("/api/categories?format=tree");
    if (res.ok) {
      setTree(await res.json());
    }
    setLoading(false);
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

  const totalCount = countAll(tree);

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

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : tree.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No categories found.
            </p>
          ) : (
            <div className="space-y-0.5">
              {tree.map((node) => (
                <CategoryRow
                  key={node.slug}
                  node={node}
                  expanded={expanded}
                  toggle={toggle}
                  depth={0}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryRow({
  node,
  expanded,
  toggle,
  depth,
}: {
  node: CategoryNode;
  expanded: Set<string>;
  toggle: (slug: string) => void;
  depth: number;
}) {
  const isOpen = expanded.has(node.slug);
  const hasChildren = node.children.length > 0;

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
            depth={depth + 1}
          />
        ))}
    </>
  );
}
