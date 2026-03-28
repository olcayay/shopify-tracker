import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

let mockPathname = "/shopify";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { useNavigationLoading } from "@/hooks/use-navigation-loading";

describe("useNavigationLoading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPathname = "/shopify";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts as navigating (initial load)", () => {
    const { result } = renderHook(() => useNavigationLoading());
    expect(result.current).toBe(true);
  });

  it("stops navigating after duration", () => {
    const { result } = renderHook(() => useNavigationLoading(500));
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe(false);
  });

  it("starts navigating again on pathname change", () => {
    const { result, rerender } = renderHook(() => useNavigationLoading(500));

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(false);

    // Simulate navigation
    mockPathname = "/shopify/keywords";
    rerender();

    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(false);
  });
});
