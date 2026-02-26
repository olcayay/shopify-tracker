import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "@/lib/auth-context";

// Unmock auth-context for this test file
vi.unmock("@/lib/auth-context");

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: mockRefresh,
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/overview",
  useSearchParams: () => new URLSearchParams(),
}));

// Component that exposes auth state for testing
function AuthConsumer() {
  const { user, account, isLoading, logout } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="user">{user ? user.name : "null"}</div>
      <div data-testid="account">{account ? account.name : "null"}</div>
      <button data-testid="logout-btn" onClick={() => logout()}>
        Logout
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cookies
    document.cookie = "access_token=; max-age=0";
    document.cookie = "refresh_token=; max-age=0";
    global.fetch = vi.fn();
  });

  it("starts in loading state", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("sets user to null when no token exists", async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("fetches user when token exists", async () => {
    document.cookie = "access_token=valid-token; path=/";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          user: { id: "1", name: "Test User", email: "test@test.com", role: "owner", isSystemAdmin: false, emailDigestEnabled: true, timezone: "UTC" },
          account: { id: "a1", name: "Test Account", isSuspended: false, limits: { maxTrackedApps: 10, maxTrackedKeywords: 50, maxCompetitorApps: 20, maxUsers: 5 }, usage: { trackedApps: 0, trackedKeywords: 0, competitorApps: 0, starredFeatures: 0, users: 1 } },
        }),
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Test User");
    });
    expect(screen.getByTestId("account").textContent).toBe("Test Account");
  });

  it("handles logout", async () => {
    const user = userEvent.setup();
    document.cookie = "access_token=valid-token; path=/";
    document.cookie = "refresh_token=valid-refresh; path=/";

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            user: { id: "1", name: "Test User", email: "test@test.com", role: "owner", isSystemAdmin: false, emailDigestEnabled: true, timezone: "UTC" },
            account: { id: "a1", name: "Test Account", isSuspended: false, limits: { maxTrackedApps: 10, maxTrackedKeywords: 50, maxCompetitorApps: 20, maxUsers: 5 }, usage: { trackedApps: 0, trackedKeywords: 0, competitorApps: 0, starredFeatures: 0, users: 1 } },
          }),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }); // logout call

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Test User");
    });

    await act(async () => {
      await user.click(screen.getByTestId("logout-btn"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("null");
    });
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("handles failed /me request gracefully", async () => {
    document.cookie = "access_token=invalid-token; path=/";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("handles network error during /me gracefully", async () => {
    document.cookie = "access_token=valid-token; path=/";
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("null");
  });
});

describe("useAuth", () => {
  it("throws when used outside AuthProvider", () => {
    function BadComponent() {
      useAuth();
      return null;
    }

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<BadComponent />)).toThrow(
      "useAuth must be used within an AuthProvider"
    );
    spy.mockRestore();
  });
});
