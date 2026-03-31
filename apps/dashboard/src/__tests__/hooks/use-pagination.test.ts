import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagination } from "@/hooks/use-pagination";

describe("usePagination", () => {
  it("initializes with defaults", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 100 }));
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(25);
    expect(result.current.totalPages).toBe(4);
    expect(result.current.offset).toBe(0);
    expect(result.current.canGoPrev).toBe(false);
    expect(result.current.canGoNext).toBe(true);
  });

  it("respects initialPage and pageSize", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 50, initialPage: 2, pageSize: 10 }),
    );
    expect(result.current.page).toBe(2);
    expect(result.current.pageSize).toBe(10);
    expect(result.current.totalPages).toBe(5);
    expect(result.current.offset).toBe(10);
  });

  it("navigates forward and backward", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 50, pageSize: 10 }),
    );
    expect(result.current.page).toBe(1);

    act(() => result.current.nextPage());
    expect(result.current.page).toBe(2);
    expect(result.current.offset).toBe(10);

    act(() => result.current.prevPage());
    expect(result.current.page).toBe(1);
    expect(result.current.offset).toBe(0);
  });

  it("cannot go before page 1", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 50, pageSize: 10 }),
    );
    expect(result.current.canGoPrev).toBe(false);

    act(() => result.current.prevPage());
    expect(result.current.page).toBe(1);
  });

  it("cannot go past last page", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 30, pageSize: 10, initialPage: 3 }),
    );
    expect(result.current.canGoNext).toBe(false);

    act(() => result.current.nextPage());
    expect(result.current.page).toBe(3);
  });

  it("sets page directly with bounds clamping", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 50, pageSize: 10 }),
    );
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setPage(99));
    expect(result.current.page).toBe(5); // clamped to totalPages

    act(() => result.current.setPage(-1));
    expect(result.current.page).toBe(1); // clamped to 1
  });

  it("resets page to initial", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 50, pageSize: 10, initialPage: 1 }),
    );
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.resetPage());
    expect(result.current.page).toBe(1);
  });

  it("handles zero total items", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 0 }));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.canGoNext).toBe(false);
    expect(result.current.canGoPrev).toBe(false);
  });

  it("calculates offset correctly", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 100, pageSize: 20 }),
    );
    expect(result.current.offset).toBe(0);
    act(() => result.current.setPage(3));
    expect(result.current.offset).toBe(40);
    act(() => result.current.setPage(5));
    expect(result.current.offset).toBe(80);
  });
});
