import type { CategoryTreeNode } from "./types";

// ─── Helpers ─────────────────────────────────────────────────

/** Build slug→node map from category tree */
export function buildSlugMap(nodes: CategoryTreeNode[]): Map<string, CategoryTreeNode> {
  const map = new Map<string, CategoryTreeNode>();
  function walk(list: CategoryTreeNode[]) {
    for (const n of list) {
      map.set(n.slug, n);
      walk(n.children);
    }
  }
  walk(nodes);
  return map;
}

/** Get breadcrumb path for a category slug */
export function getBreadcrumb(slug: string, slugMap: Map<string, CategoryTreeNode>): string {
  const parts: string[] = [];
  let node = slugMap.get(slug);
  while (node) {
    parts.unshift(node.title);
    node = node.parentSlug ? slugMap.get(node.parentSlug) : undefined;
  }
  return parts.join(" > ");
}
