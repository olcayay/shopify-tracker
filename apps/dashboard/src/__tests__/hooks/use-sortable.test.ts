import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSortable } from "../../hooks/use-sortable";

type TestKey = "name" | "rating" | "reviews";

describe("useSortable", () => {
  it("returns default sort key and direction", () => {
    const { result } = renderHook(() => useSortable<TestKey>("name"));
    expect(result.current.sortKey).toBe("name");
    expect(result.current.sortDir).toBe("asc");
  });

  it("toggles direction when clicking same key", () => {
    const { result } = renderHook(() => useSortable<TestKey>("name"));

    act(() => result.current.toggleSort("name"));
    expect(result.current.sortDir).toBe("desc");

    act(() => result.current.toggleSort("name"));
    expect(result.current.sortDir).toBe("asc");
  });

  it("switches to desc when clicking a non-asc key", () => {
    const { result } = renderHook(() =>
      useSortable<TestKey>("name", "asc", ["name"])
    );

    act(() => result.current.toggleSort("rating"));
    expect(result.current.sortKey).toBe("rating");
    expect(result.current.sortDir).toBe("desc");
  });

  it("switches to asc when clicking an ascKey", () => {
    const { result } = renderHook(() =>
      useSortable<TestKey>("rating", "desc", ["name"])
    );

    act(() => result.current.toggleSort("name"));
    expect(result.current.sortKey).toBe("name");
    expect(result.current.sortDir).toBe("asc");
  });

  it("uses custom default direction", () => {
    const { result } = renderHook(() =>
      useSortable<TestKey>("rating", "desc")
    );
    expect(result.current.sortDir).toBe("desc");
  });
});
