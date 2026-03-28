import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: null,
    account: null,
    isLoading: false,
    fetchWithAuth: mockFetchWithAuth,
    refreshUser: vi.fn(),
  }),
}));

import { useApiQuery, useApiMutation } from "@/lib/use-api-query";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useApiQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches data successfully", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 1, name: "Test App" }]),
    });

    const { result } = renderHook(
      () => useApiQuery<{ id: number; name: string }[]>(["apps"], "/api/apps"),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([{ id: 1, name: "Test App" }]);
    expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/apps");
  });

  it("handles API error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });

    const { result } = renderHook(
      () => useApiQuery<any>(["fail"], "/api/fail"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("Unauthorized");
  });

  it("handles API error with no body", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("parse error")),
    });

    const { result } = renderHook(
      () => useApiQuery<any>(["fail2"], "/api/fail2"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("API error: 500");
  });

  it("respects enabled option", async () => {
    const { result } = renderHook(
      () =>
        useApiQuery<any>(["disabled"], "/api/disabled", { enabled: false }),
      { wrapper: createWrapper() },
    );

    // Should not have called fetch
    expect(mockFetchWithAuth).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("passes different query keys for different URLs", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: "test" }),
    });

    const wrapper = createWrapper();

    const { result: result1 } = renderHook(
      () => useApiQuery<any>(["key1"], "/api/endpoint1"),
      { wrapper },
    );

    const { result: result2 } = renderHook(
      () => useApiQuery<any>(["key2"], "/api/endpoint2"),
      { wrapper },
    );

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
      expect(result2.current.isLoading).toBe(false);
    });

    expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/endpoint1");
    expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/endpoint2");
  });
});

describe("useApiMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends mutation request", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { result } = renderHook(
      () =>
        useApiMutation<{ success: boolean }, { slug: string }>(
          "/api/account/tracked-apps",
          { method: "POST" },
        ),
      { wrapper: createWrapper() },
    );

    result.current.mutate({ slug: "test-app" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/account/tracked-apps", {
      method: "POST",
      body: JSON.stringify({ slug: "test-app" }),
    });
    expect(result.current.data).toEqual({ success: true });
  });

  it("handles mutation error", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "App already tracked" }),
    });

    const { result } = renderHook(
      () =>
        useApiMutation<any, { slug: string }>(
          "/api/account/tracked-apps",
          { method: "POST" },
        ),
      { wrapper: createWrapper() },
    );

    result.current.mutate({ slug: "test-app" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("App already tracked");
  });

  it("calls onSuccess callback", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    });

    const onSuccess = vi.fn();

    const { result } = renderHook(
      () =>
        useApiMutation<{ id: number }, { name: string }>(
          "/api/items",
          { method: "POST" },
          { onSuccess },
        ),
      { wrapper: createWrapper() },
    );

    result.current.mutate({ name: "test" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccess).toHaveBeenCalled();
    const callArgs = onSuccess.mock.calls[0];
    expect(callArgs[0]).toEqual({ id: 1 });
    expect(callArgs[1]).toEqual({ name: "test" });
  });
});
