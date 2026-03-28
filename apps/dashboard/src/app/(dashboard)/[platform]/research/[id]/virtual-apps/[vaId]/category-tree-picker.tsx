"use client";

import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Folder,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CompetitorCountBadge } from "@/components/virtual-app/competitor-count-badge";
import type { CategoryTreeNode } from "./types";

// ─── Category Tree Picker ────────────────────────────────────

export function CategoryTreePicker({
  tree,
  selectedSlugs,
  onToggle,
  disabled,
  maxSelected,
  competitorCategoryCounts,
  totalCompetitors,
}: {
  tree: CategoryTreeNode[];
  selectedSlugs: string[];
  onToggle: (slug: string) => void;
  disabled?: boolean;
  maxSelected: number;
  competitorCategoryCounts: Map<string, { count: number; names: string[] }>;
  totalCompetitors: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const selectedSet = new Set(selectedSlugs);

  // Filter tree by search query
  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;
    const q = search.toLowerCase();

    function filterNodes(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
      const result: CategoryTreeNode[] = [];
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
  }, [tree, search]);

  // Auto-expand when searching
  useEffect(() => {
    if (search.trim()) {
      const slugsToExpand = new Set<string>();
      function collectParents(nodes: CategoryTreeNode[]) {
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
  }, [filteredTree, search]);

  function toggle(slug: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function renderNode(node: CategoryTreeNode, depth: number) {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.slug);
    const isLeaf = !hasChildren;
    const isSelected = selectedSet.has(node.slug);
    const isMaxReached = selectedSlugs.length >= maxSelected && !isSelected;

    return (
      <div key={node.slug}>
        <div
          className="flex items-center gap-1 py-1 px-2 rounded-md hover:bg-muted/50 group"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggle(node.slug)}
              className="flex items-center justify-center w-5 h-5 shrink-0 text-muted-foreground hover:text-foreground"
            >
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}

          {hasChildren ? (
            isOpen ? <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : null}

          {isLeaf ? (
            <>
              <button
                onClick={() => {
                  if (disabled || (isMaxReached && !isSelected)) return;
                  onToggle(node.slug);
                }}
                disabled={disabled || (isMaxReached && !isSelected)}
                className={cn(
                  "flex items-center gap-2 text-sm ml-0.5 py-0.5 px-1 rounded transition-colors flex-1 min-w-0 text-left",
                  isSelected ? "text-blue-700 dark:text-blue-300" : "",
                  isMaxReached && !isSelected ? "opacity-40 cursor-not-allowed" : ""
                )}
              >
                <div className={cn(
                  "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                  isSelected ? "bg-blue-600 border-blue-600" : "border-muted-foreground/30"
                )}>
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className="truncate">{node.title}</span>
              </button>
              {(() => {
                const catData = competitorCategoryCounts.get(node.slug);
                if (!catData || catData.count === 0) return null;
                return (
                  <CompetitorCountBadge
                    count={catData.count}
                    total={totalCompetitors}
                    names={catData.names}
                  />
                );
              })()}
            </>
          ) : (
            <span className="text-sm ml-1 text-muted-foreground truncate">{node.title}</span>
          )}

          {hasChildren && (
            <span className="text-[10px] text-muted-foreground shrink-0">({node.children.length})</span>
          )}

          {!node.isListingPage && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">Hub</Badge>
          )}
        </div>

        {isOpen && hasChildren && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search categories..."
        className="h-8 text-sm"
      />
      <div className="max-h-[400px] overflow-y-auto space-y-0">
        {filteredTree.map((node) => renderNode(node, 0))}
        {filteredTree.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-2 py-4 text-center">
            {search ? `No categories matching "${search}"` : "No categories available"}
          </p>
        )}
      </div>
    </div>
  );
}
