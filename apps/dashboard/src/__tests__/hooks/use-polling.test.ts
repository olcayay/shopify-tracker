import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePolling } from "../../hooks/use-polling";

describe("usePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not start polling when hasPending is false", () => {
    const fetchFn = vi.fn();
    renderHook(() => usePolling({ hasPending: false, fetchFn }));

    vi.advanceTimersByTime(10000);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("starts polling when hasPending is true", () => {
    const fetchFn = vi.fn();
    renderHook(() => usePolling({ hasPending: true, fetchFn, interval: 1000 }));

    expect(fetchFn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("stops polling when hasPending becomes false", () => {
    const fetchFn = vi.fn();
    const { rerender } = renderHook(
      ({ hasPending }) => usePolling({ hasPending, fetchFn, interval: 1000 }),
      { initialProps: { hasPending: true } }
    );

    vi.advanceTimersByTime(2000);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    rerender({ hasPending: false });
    vi.advanceTimersByTime(3000);
    expect(fetchFn).toHaveBeenCalledTimes(2); // no more calls
  });

  it("cleans up interval on unmount", () => {
    const fetchFn = vi.fn();
    const { unmount } = renderHook(() =>
      usePolling({ hasPending: true, fetchFn, interval: 1000 })
    );

    vi.advanceTimersByTime(1000);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    unmount();
    vi.advanceTimersByTime(5000);
    expect(fetchFn).toHaveBeenCalledTimes(1); // no more calls
  });

  it("respects enabled=false", () => {
    const fetchFn = vi.fn();
    renderHook(() =>
      usePolling({ hasPending: true, fetchFn, interval: 1000, enabled: false })
    );

    vi.advanceTimersByTime(5000);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("uses default 5000ms interval", () => {
    const fetchFn = vi.fn();
    renderHook(() => usePolling({ hasPending: true, fetchFn }));

    vi.advanceTimersByTime(4999);
    expect(fetchFn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
