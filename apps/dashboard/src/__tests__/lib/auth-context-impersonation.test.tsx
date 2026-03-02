import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

import { AuthProvider, useAuth } from "@/lib/auth-context";

// Helper to access auth state
function AuthConsumer({
  onAction,
}: {
  onAction?: (auth: ReturnType<typeof useAuth>) => void;
}) {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(auth.isLoading)}</div>
      <div data-testid="user">{auth.user ? auth.user.name : "null"}</div>
      <div data-testid="impersonation">
        {auth.impersonation ? JSON.stringify(auth.impersonation) : "null"}
      </div>
      <button
        data-testid="action-btn"
        onClick={() => onAction?.(auth)}
      >
        Action
      </button>
      <button
        data-testid="start-impersonate"
        onClick={() => auth.startImpersonation("user-123")}
      >
        Impersonate
      </button>
      <button
        data-testid="stop-impersonate"
        onClick={() => auth.stopImpersonation()}
      >
        Stop
      </button>
      <button
        data-testid="fetch-post"
        onClick={async () => {
          try {
            await auth.fetchWithAuth("/api/account/tracked-apps", {
              method: "POST",
              body: JSON.stringify({ slug: "test" }),
            });
          } catch {
            // cancelled
          }
        }}
      >
        POST
      </button>
      <button
        data-testid="fetch-get"
        onClick={async () => {
          await auth.fetchWithAuth("/api/apps");
        }}
      >
        GET
      </button>
    </div>
  );
}

const meResponseNormal = {
  user: {
    id: "u1",
    email: "admin@test.com",
    name: "Admin",
    role: "owner",
    isSystemAdmin: true,
    emailDigestEnabled: true,
    timezone: "UTC",
  },
  account: {
    id: "a1",
    name: "Account",
    isSuspended: false,
    limits: {
      maxTrackedApps: 10,
      maxTrackedKeywords: 10,
      maxCompetitorApps: 5,
      maxTrackedFeatures: 10,
      maxUsers: 5,
    },
    usage: {
      trackedApps: 0,
      trackedKeywords: 0,
      competitorApps: 0,
      trackedFeatures: 0,
      users: 1,
    },
  },
};

const meResponseImpersonating = {
  ...meResponseNormal,
  user: {
    id: "u2",
    email: "bob@test.com",
    name: "Bob",
    role: "editor",
    isSystemAdmin: true,
    emailDigestEnabled: true,
    timezone: "UTC",
  },
  impersonation: {
    isImpersonating: true,
    realAdmin: {
      userId: "u1",
      email: "admin@test.com",
      name: "Admin",
    },
    targetUser: {
      userId: "u2",
      email: "bob@test.com",
      name: "Bob",
    },
  },
};

describe("AuthContext — Impersonation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "access_token=; max-age=0";
    document.cookie = "refresh_token=; max-age=0";
    global.fetch = vi.fn();
  });

  it("impersonation is null by default", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId("impersonation").textContent).toBe("null");
    });
  });

  it("impersonation is set after /me returns impersonation data", async () => {
    document.cookie = "access_token=test-token; path=/";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(meResponseImpersonating),
    });
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );
    await waitFor(() => {
      const imp = screen.getByTestId("impersonation").textContent;
      expect(imp).not.toBe("null");
      const parsed = JSON.parse(imp!);
      expect(parsed.isImpersonating).toBe(true);
      expect(parsed.realAdmin.name).toBe("Admin");
      expect(parsed.targetUser.name).toBe("Bob");
    });
  });

  it("impersonation is cleared when /me returns no impersonation", async () => {
    document.cookie = "access_token=test-token; path=/";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(meResponseNormal),
    });
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId("impersonation").textContent).toBe("null");
    });
  });

  it("startImpersonation sets cookie and refreshes user", async () => {
    document.cookie = "access_token=admin-token; path=/";

    let callCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, _opts?: RequestInit) => {
        if (
          typeof url === "string" &&
          url.includes("/api/system-admin/impersonate/")
        ) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                accessToken: "impersonation-token",
                impersonating: {
                  userId: "u2",
                  email: "bob@test.com",
                  name: "Bob",
                },
              }),
          });
        }
        // /me calls
        callCount++;
        if (callCount <= 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(meResponseNormal),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(meResponseImpersonating),
        });
      }
    );

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Admin");
    });

    await act(async () => {
      screen.getByTestId("start-impersonate").click();
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/overview");
    });
  });

  it("stopImpersonation clears state and navigates to users page", async () => {
    document.cookie = "access_token=impersonation-token; path=/";

    let callCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (
          typeof url === "string" &&
          url.includes("/stop-impersonation")
        ) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                accessToken: "admin-token",
                user: {
                  id: "u1",
                  email: "admin@test.com",
                  name: "Admin",
                  role: "owner",
                  isSystemAdmin: true,
                },
              }),
          });
        }
        callCount++;
        if (callCount <= 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(meResponseImpersonating),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(meResponseNormal),
        });
      }
    );

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      const imp = screen.getByTestId("impersonation").textContent;
      expect(imp).not.toBe("null");
    });

    await act(async () => {
      screen.getByTestId("stop-impersonate").click();
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/system-admin/users");
    });
  });

  it("fetchWithAuth does NOT show confirm for GET when impersonating", async () => {
    document.cookie = "access_token=imp-token; path=/";

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (typeof url === "string" && url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(meResponseImpersonating),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      }
    );

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      const imp = screen.getByTestId("impersonation").textContent;
      expect(imp).not.toBe("null");
    });

    await act(async () => {
      screen.getByTestId("fetch-get").click();
    });

    // No confirm dialog should appear
    expect(
      screen.queryByText("Confirm action on behalf of user")
    ).not.toBeInTheDocument();
  });

  it("fetchWithAuth shows confirm dialog for POST when impersonating", async () => {
    document.cookie = "access_token=imp-token; path=/";

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (typeof url === "string" && url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(meResponseImpersonating),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      }
    );

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      const imp = screen.getByTestId("impersonation").textContent;
      expect(imp).not.toBe("null");
    });

    await act(async () => {
      screen.getByTestId("fetch-post").click();
    });

    await waitFor(() => {
      expect(
        screen.getByText("Confirm action on behalf of user")
      ).toBeInTheDocument();
    });
  });

  it("confirming the dialog proceeds with the request", async () => {
    document.cookie = "access_token=imp-token; path=/";

    const fetchCalls: string[] = [];
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        fetchCalls.push(url);
        if (typeof url === "string" && url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(meResponseImpersonating),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      }
    );

    const ue = userEvent.setup();

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      const imp = screen.getByTestId("impersonation").textContent;
      expect(imp).not.toBe("null");
    });

    await act(async () => {
      screen.getByTestId("fetch-post").click();
    });

    await waitFor(() => {
      expect(
        screen.getByText("Confirm action on behalf of user")
      ).toBeInTheDocument();
    });

    await ue.click(screen.getByText("Proceed"));

    await waitFor(() => {
      expect(
        fetchCalls.some((u) => u.includes("/api/account/tracked-apps"))
      ).toBe(true);
    });
  });

  it("canceling the dialog does not make the request", async () => {
    document.cookie = "access_token=imp-token; path=/";

    const fetchCalls: string[] = [];
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        fetchCalls.push(url);
        if (typeof url === "string" && url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(meResponseImpersonating),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      }
    );

    const ue = userEvent.setup();

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      const imp = screen.getByTestId("impersonation").textContent;
      expect(imp).not.toBe("null");
    });

    await act(async () => {
      screen.getByTestId("fetch-post").click();
    });

    await waitFor(() => {
      expect(
        screen.getByText("Confirm action on behalf of user")
      ).toBeInTheDocument();
    });

    await ue.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(
        screen.queryByText("Confirm action on behalf of user")
      ).not.toBeInTheDocument();
    });

    // The tracked-apps API call should NOT have been made
    expect(
      fetchCalls.some((u) => u.includes("/api/account/tracked-apps"))
    ).toBe(false);
  });
});
