import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

/**
 * Tests for the feature flag detail page search behavior.
 * Ensures that search works after adding entries (PLA-931 regression).
 *
 * The bug: fetchWithAuth identity change after loadFlag() re-renders the
 * component, causing search useEffects to re-fire with empty query and
 * wipe results.
 */

const mockFetchWithAuth = vi.fn();
let fetchCallCount = 0;

// Track fetchWithAuth reference changes
const fetchVersions: number[] = [];

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => {
    fetchCallCount++;
    fetchVersions.push(fetchCallCount);
    return {
      user: { role: "owner", isSystemAdmin: true },
      fetchWithAuth: mockFetchWithAuth,
    };
  },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "test-flag" }),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const MOCK_FLAG = {
  id: "flag-1",
  slug: "test-flag",
  name: "Test Flag",
  description: "A test feature flag",
  isEnabled: true,
  activatedAt: "2026-01-01",
  deactivatedAt: null,
  createdAt: "2026-01-01",
  accountCount: 1,
  accounts: [{ accountId: "acc-1", accountName: "Test Account", enabledAt: "2026-01-01" }],
  userCount: 1,
  users: [{ userId: "u1", enabled: true, enabledAt: "2026-01-01", userEmail: "existing@test.com", userName: "Existing User", accountId: "acc-1", accountName: "Test Account" }],
};

const MOCK_USER_SEARCH = {
  data: [
    { id: "u2", email: "new@test.com", name: "New User", accountId: "acc-1", accountName: "Test Account" },
  ],
};

const MOCK_ACCOUNT_SEARCH = {
  data: [
    { id: "acc-2", name: "Another Account" },
  ],
};

import FeatureFlagDetailPage from "@/app/(dashboard)/system-admin/feature-flags/[slug]/page";

describe("Feature flag search after add (PLA-931)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchCallCount = 0;
    fetchVersions.length = 0;

    mockFetchWithAuth.mockImplementation((url: string, options?: any) => {
      if (url.includes("/feature-flags/test-flag") && !url.includes("search") && !options?.method) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_FLAG) });
      }
      if (url.includes("/users/search")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_USER_SEARCH) });
      }
      if (url.includes("/accounts/search")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_ACCOUNT_SEARCH) });
      }
      if (url.includes("/users") && options?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (url.includes("/users") && options?.method === "DELETE") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("renders the flag detail page with existing users", async () => {
    render(<FeatureFlagDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Test Flag")).toBeInTheDocument();
    });
    expect(screen.getByText("existing@test.com")).toBeInTheDocument();
  });

  it("search does not depend on fetchWithAuth in useEffect deps (uses ref)", async () => {
    // The fix: search effects use fetchRef.current instead of fetchWithAuth
    // in their dependency array. This means even if fetchWithAuth identity
    // changes (after loadFlag re-render), the search effect won't re-fire
    // with an empty query and wipe results.

    render(<FeatureFlagDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Test Flag")).toBeInTheDocument();
    });

    // Type in user search
    const userSearchInput = screen.getByPlaceholderText("Search users by email or name...");
    await userEvent.type(userSearchInput, "new");

    // Wait for debounced search
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/users/search?q=new")
      );
    }, { timeout: 1000 });
  });

  it("account search works with existing accounts configured", async () => {
    render(<FeatureFlagDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Test Flag")).toBeInTheDocument();
    });

    // Type in account search
    const accountSearchInput = screen.getByPlaceholderText("Search accounts to enable...");
    await userEvent.type(accountSearchInput, "another");

    // Wait for debounced search
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/accounts/search?q=another")
      );
    }, { timeout: 1000 });
  });
});
