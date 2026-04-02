import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export type SortDir = "asc" | "desc";

/**
 * Generic hook for managing sort state in tables.
 * Reads initial state from URL search params (`sort` and `order`) and
 * updates the URL when sort changes, enabling shareable/bookmarkable sorts.
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize from URL params or defaults
  const urlSort = searchParams.get("sort") as K | null;
  const urlOrder = searchParams.get("order") as SortDir | null;

  const [sortKey, setSortKey] = useState<K>(urlSort || defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(urlOrder || defaultDir);

  const ascSet = new Set(ascKeys);

  // Sync URL when sort changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (sortKey !== defaultKey || sortDir !== defaultDir) {
      params.set("sort", sortKey);
      params.set("order", sortDir);
    } else {
      params.delete("sort");
      params.delete("order");
    }
    const newUrl = params.toString() ? `${pathname}?${params}` : pathname;
    router.replace(newUrl, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, sortDir]);

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
