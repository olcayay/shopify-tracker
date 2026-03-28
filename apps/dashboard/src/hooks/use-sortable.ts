import { useState, useCallback } from "react";

export type SortDir = "asc" | "desc";

/**
 * Generic hook for managing sort state in tables.
 *
 * @param defaultKey   Initial sort column
 * @param defaultDir   Initial sort direction (default: "asc")
 * @param ascKeys      Keys that default to "asc" when first clicked (e.g., "name")
 */
export function useSortable<K extends string>(
  defaultKey: K,
  defaultDir: SortDir = "asc",
  ascKeys: K[] = [],
) {
  const [sortKey, setSortKey] = useState<K>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const ascSet = new Set(ascKeys);

  const toggleSort = useCallback(
    (key: K) => {
      setSortKey((prev) => {
        if (prev === key) {
          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          return prev;
        }
        setSortDir(ascSet.has(key) ? "asc" : "desc");
        return key;
      });
    },
    // ascSet is stable since ascKeys typically doesn't change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Returns the appropriate `aria-sort` value for a given column. */
  const ariaSort = useCallback(
    (key: K): "ascending" | "descending" | "none" => {
      if (sortKey !== key) return "none";
      return sortDir === "asc" ? "ascending" : "descending";
    },
    [sortKey, sortDir],
  );

  return { sortKey, sortDir, toggleSort, setSortKey, setSortDir, ariaSort } as const;
}
