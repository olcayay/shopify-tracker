import { useState, useCallback, useMemo } from "react";

interface UsePaginationOptions {
  initialPage?: number;
  pageSize?: number;
  totalItems: number;
}

interface UsePaginationReturn {
  page: number;
  pageSize: number;
  totalPages: number;
  offset: number;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  resetPage: () => void;
}

export function usePagination({
  initialPage = 1,
  pageSize = 25,
  totalItems,
}: UsePaginationOptions): UsePaginationReturn {
  const [page, setPageRaw] = useState(initialPage);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / pageSize)),
    [totalItems, pageSize],
  );

  const setPage = useCallback(
    (p: number) => setPageRaw(Math.max(1, Math.min(p, totalPages))),
    [totalPages],
  );

  const nextPage = useCallback(() => setPage(page + 1), [page, setPage]);
  const prevPage = useCallback(() => setPage(page - 1), [page, setPage]);
  const resetPage = useCallback(() => setPageRaw(initialPage), [initialPage]);

  return {
    page,
    pageSize,
    totalPages,
    offset: (page - 1) * pageSize,
    setPage,
    nextPage,
    prevPage,
    canGoNext: page < totalPages,
    canGoPrev: page > 1,
    resetPage,
  };
}
