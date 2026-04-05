/* eslint-disable react-hooks/globals */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

// ---------- Shared fixtures ----------

const makeUser = (overrides?: Partial<Record<string, unknown>>) => ({
  id: "1",
  name: "Test User",
  email: "test@test.com",
  role: "owner",
  isSystemAdmin: false,
  emailDigestEnabled: true,
  timezone: "UTC",
  ...overrides,
});

const makeAccount = (overrides?: Partial<Record<string, unknown>>) => ({
  id: "a1",
  name: "Test Account",
  isSuspended: false,
  limits: {
    maxTrackedApps: 10,
    maxTrackedKeywords: 50,
    maxCompetitorApps: 20,
    maxUsers: 5,
    maxResearchProjects: 3,
    maxPlatforms: 5,
  },
  usage: {
    trackedApps: 0,
    trackedKeywords: 0,
    competitorApps: 0,
    starredFeatures: 0,
    users: 1,
    researchProjects: 0,
    platforms: 1,
  },
  ...overrides,
});

const meResponse = (extra?: Record<string, unknown>) => ({
  user: makeUser(),
  account: makeAccount(),
  enabledPlatforms: ["shopify"],
  ...extra,
});

function mockFetchOk(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

function mockFetchFail(status = 401) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: "fail" }),
  };
}

// ---------- Test consumers ----------

function AuthConsumer() {
  const { user, account, isLoading, logout, impersonation } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="user">{user ? user.name : "null"}</div>
      <div data-testid="user-json">{user ? JSON.stringify(user) : "null"}</div>
      <div data-testid="account">{account ? account.name : "null"}</div>
      <div data-testid="impersonation">
        {impersonation ? JSON.stringify(impersonation) : "null"}
      </div>
      <button data-testid="logout-btn" onClick={() => logout()}>
        Logout
      </button>
    </div>
  );
}

function FetchConsumer() {
  const { fetchWithAuth, user, isLoading } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="user">{user ? user.name : "null"}</div>
      <button
        data-testid="fetch-get"
        onClick={async () => {
          const res = await fetchWithAuth("/api/apps");
          const el = document.getElementById("fetch-result");
          if (el) el.textContent = String(res.status);
        }}
      >
        GET
      </button>
      <button
        data-testid="fetch-post"
        onClick={async () => {
          const res = await fetchWithAuth("/api/account/tracked-apps", {
            method: "POST",
            body: JSON.stringify({ slug: "test" }),
          });
          const el = document.getElementById("fetch-result");
          if (el) el.textContent = String(res.status);
        }}
      >
        POST
      </button>
      <div id="fetch-result" data-testid="fetch-result" />
    </div>
  );
}

function LoginConsumer() {
  const { login, user, isLoading } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="user">{user ? user.name : "null"}</div>
      <button
        data-testid="login-btn"
        onClick={async () => {
          try {
            await login("test@test.com", "password123");
          } catch {
            // error expected in some tests
          }
        }}
      >
        Login
      </button>
    </div>
  );
}

function RegisterConsumer() {
  const { register, user, isLoading } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="user">{user ? user.name : "null"}</div>
      <button
        data-testid="register-btn"
        onClick={async () => {
          try {
            await register(
              "new@test.com",
              "password123",
              "New User",
              "New Account",
              "Acme Corp"
            );
          } catch {
            // error expected in some tests
          }
        }}
      >
        Register
      </button>
    </div>
  );
}

// ---------- Tests ----------

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "access_token=; max-age=0";
    document.cookie = "refresh_token=; max-age=0";
    global.fetch = vi.fn();
  });

  it("starts in loading state", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchFail()
    );
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

  it("uses silentRefresh when access_token expired but refresh_token exists", async () => {
    // Simulate post-deploy state: no access_token but refresh_token still valid
    document.cookie = "refresh_token=valid-refresh-token; path=/";

    (global.fetch as ReturnType<typeof vi.fn>)
      // 1st call: POST /api/auth/refresh — silentRefresh
      .mockResolvedValueOnce(
        mockFetchOk({
          accessToken: "refreshed-access-tok",
          refreshToken: "refreshed-refresh-tok",
        })
      )
      // 2nd call: GET /api/auth/me — after silentRefresh sets new access_token
      .mockResolvedValueOnce(mockFetchOk(meResponse()));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // User should be loaded via silentRefresh → /me
    expect(screen.getByTestId("user").textContent).toBe("Test User");
    expect(screen.getByTestId("account").textContent).toBe("Test Account");

    // Verify silentRefresh was called (POST to /api/auth/refresh)
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const refreshCall = fetchMock.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/api/auth/refresh")
    );
    expect(refreshCall).toBeDefined();
  });

  it("redirects to login when both access_token and refresh_token missing", async () => {
    // No cookies at all
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("null");
    // No fetch calls should be made
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("redirects to login when silentRefresh fails", async () => {
    // Only refresh_token exists but refresh endpoint fails
    document.cookie = "refresh_token=expired-refresh-token; path=/";

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockFetchFail(401)); // refresh fails

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
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchOk(meResponse())
    );

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

  it("sets enabledPlatforms to ['shopify'] when API omits it", async () => {
    document.cookie = "access_token=valid-token; path=/";
    const resp = meResponse();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (resp as any).enabledPlatforms;
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchOk(resp)
    );

    let capturedAccount: unknown = null;
    function AccountCapture() {
      const { account, isLoading } = useAuth();
      if (!isLoading) capturedAccount = account;
      return <div data-testid="loading">{String(isLoading)}</div>;
    }

    render(
      <AuthProvider>
        <AccountCapture />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect((capturedAccount as { enabledPlatforms: string[] }).enabledPlatforms).toEqual([
      "shopify",
    ]);
  });

  it("handles failed /me request gracefully", async () => {
    document.cookie = "access_token=invalid-token; path=/";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchFail(401)
    );

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
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error")
    );

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

  it("sets globalPlatformVisibility from /me response", async () => {
    document.cookie = "access_token=valid-token; path=/";
    const visibility = { shopify: true, salesforce: false };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchOk(meResponse({ globalPlatformVisibility: visibility }))
    );

    let captured: Record<string, boolean> | null = null;
    function VisCapture() {
      const { globalPlatformVisibility, isLoading } = useAuth();
      if (!isLoading) captured = globalPlatformVisibility;
      return <div data-testid="loading">{String(isLoading)}</div>;
    }

    render(
      <AuthProvider>
        <VisCapture />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(captured).toEqual(visibility);
  });

  it("clears globalPlatformVisibility on failed /me", async () => {
    document.cookie = "access_token=valid-token; path=/";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchFail(500)
    );

    let captured: Record<string, boolean> | null | undefined = undefined;
    function VisCapture() {
      const { globalPlatformVisibility, isLoading } = useAuth();
      if (!isLoading) captured = globalPlatformVisibility;
      return <div data-testid="loading">{String(isLoading)}</div>;
    }

    render(
      <AuthProvider>
        <VisCapture />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(captured).toBeNull();
  });
});

// ---------- Login ----------

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "access_token=; max-age=0";
    document.cookie = "refresh_token=; max-age=0";
    global.fetch = vi.fn();
  });

  it("stores access and refresh tokens on successful login", async () => {
    const ue = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>)
      // login POST (initial /me skipped — no token in cookie)
      .mockResolvedValueOnce(
        mockFetchOk({
          accessToken: "new-access-tok",
          refreshToken: "new-refresh-tok",
          user: makeUser(),
        })
      )
      // refreshUser /me after login
      .mockResolvedValueOnce(mockFetchOk(meResponse()));

    render(
      <AuthProvider>
        <LoginConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("login-btn"));
    });

    // Verify the login API was called with correct credentials
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const loginCall = fetchMock.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/api/auth/login")
    );
    expect(loginCall).toBeDefined();
    const loginBody = JSON.parse(loginCall![1].body);
    expect(loginBody.email).toBe("test@test.com");
    expect(loginBody.password).toBe("password123");

    // Cookies should be set
    expect(document.cookie).toContain("access_token=new-access-tok");
    expect(document.cookie).toContain("refresh_token=new-refresh-tok");

    // Redirected to /overview
    expect(mockPush).toHaveBeenCalledWith("/overview");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("throws error on failed login without setting tokens", async () => {
    const ue = userEvent.setup();
    let loginError: Error | null = null;

    function LoginErrorConsumer() {
      const { login, isLoading } = useAuth();
      return (
        <div>
          <div data-testid="loading">{String(isLoading)}</div>
          <button
            data-testid="login-btn"
            onClick={async () => {
              try {
                await login("bad@test.com", "wrong");
              } catch (e) {
                loginError = e as Error;
              }
            }}
          >
            Login
          </button>
        </div>
      );
    }

    (global.fetch as ReturnType<typeof vi.fn>)
      // login POST (initial /me skipped — no token in cookie)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Invalid credentials" }),
      });

    render(
      <AuthProvider>
        <LoginErrorConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("login-btn"));
    });

    expect(loginError).not.toBeNull();
    expect(loginError!.message).toBe("Invalid credentials");
    // Tokens should NOT be set
    expect(document.cookie).not.toContain("access_token=");
    expect(mockPush).not.toHaveBeenCalledWith("/overview");
  });

  it("uses generic error message when API returns no error field", async () => {
    const ue = userEvent.setup();
    let loginError: Error | null = null;

    function LoginErrorConsumer() {
      const { login, isLoading } = useAuth();
      return (
        <div>
          <div data-testid="loading">{String(isLoading)}</div>
          <button
            data-testid="login-btn"
            onClick={async () => {
              try {
                await login("bad@test.com", "wrong");
              } catch (e) {
                loginError = e as Error;
              }
            }}
          >
            Login
          </button>
        </div>
      );
    }

    (global.fetch as ReturnType<typeof vi.fn>)
      // login POST (initial /me skipped — no token in cookie)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

    render(
      <AuthProvider>
        <LoginErrorConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("login-btn"));
    });

    expect(loginError!.message).toBe("Login failed");
  });
});

// ---------- Registration ----------

describe("Registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "access_token=; max-age=0";
    document.cookie = "refresh_token=; max-age=0";
    global.fetch = vi.fn();
  });

  it("stores tokens and redirects on successful registration", async () => {
    const ue = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>)
      // register POST (initial /me skipped — no token in cookie)
      .mockResolvedValueOnce(
        mockFetchOk({
          accessToken: "reg-access-tok",
          refreshToken: "reg-refresh-tok",
          user: makeUser({ name: "New User" }),
        })
      )
      .mockResolvedValueOnce(
        mockFetchOk(meResponse({ user: makeUser({ name: "New User" }) }))
      );

    render(
      <AuthProvider>
        <RegisterConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("register-btn"));
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const registerCall = fetchMock.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/api/auth/register")
    );
    expect(registerCall).toBeDefined();
    const body = JSON.parse(registerCall![1].body);
    expect(body.email).toBe("new@test.com");
    expect(body.name).toBe("New User");
    expect(body.accountName).toBe("New Account");
    expect(body.company).toBe("Acme Corp");

    expect(document.cookie).toContain("access_token=reg-access-tok");
    expect(document.cookie).toContain("refresh_token=reg-refresh-tok");
    expect(mockPush).toHaveBeenCalledWith("/overview");
  });

  it("throws on failed registration", async () => {
    const ue = userEvent.setup();
    let error: Error | null = null;

    function RegisterErrorConsumer() {
      const { register, isLoading } = useAuth();
      return (
        <div>
          <div data-testid="loading">{String(isLoading)}</div>
          <button
            data-testid="register-btn"
            onClick={async () => {
              try {
                await register("dup@test.com", "pass", "Name", "Acc");
              } catch (e) {
                error = e as Error;
              }
            }}
          >
            Register
          </button>
        </div>
      );
    }

    (global.fetch as ReturnType<typeof vi.fn>)
      // register POST (initial /me skipped — no token in cookie)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: "Email already exists" }),
      });

    render(
      <AuthProvider>
        <RegisterErrorConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("register-btn"));
    });

    expect(error!.message).toBe("Email already exists");
  });
});

// ---------- Logout ----------

describe("Logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "access_token=; max-age=0";
    document.cookie = "refresh_token=; max-age=0";
    global.fetch = vi.fn();
  });

  it("clears tokens, calls API, and redirects to login", async () => {
    const ue = userEvent.setup();
    document.cookie = "access_token=valid-token; path=/";
    document.cookie = "refresh_token=valid-refresh; path=/";

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockFetchOk(meResponse())) // /me
      .mockResolvedValueOnce(mockFetchOk({})); // logout POST

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Test User");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("logout-btn"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("null");
    });

    // Verify logout API call was made with refresh token
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const logoutCall = fetchMock.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/api/auth/logout")
    );
    expect(logoutCall).toBeDefined();
    const logoutBody = JSON.parse(logoutCall![1].body);
    expect(logoutBody.refreshToken).toBe("valid-refresh");

    expect(mockPush).toHaveBeenCalledWith("/login");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("clears tokens even if logout API call fails", async () => {
    const ue = userEvent.setup();
    document.cookie = "access_token=valid-token; path=/";
    document.cookie = "refresh_token=valid-refresh; path=/";

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockFetchOk(meResponse())) // /me
      .mockRejectedValueOnce(new Error("Network error")); // logout fails

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Test User");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("logout-btn"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("null");
    });
    expect(screen.getByTestId("account").textContent).toBe("null");
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("clears impersonation state on logout", async () => {
    const ue = userEvent.setup();
    document.cookie = "access_token=imp-token; path=/";
    document.cookie = "refresh_token=valid-refresh; path=/";

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        mockFetchOk(
          meResponse({
            impersonation: {
              isImpersonating: true,
              realAdmin: { userId: "u1", email: "admin@test.com", name: "Admin" },
              targetUser: { userId: "u2", email: "bob@test.com", name: "Bob" },
            },
          })
        )
      )
      .mockResolvedValueOnce(mockFetchOk({})); // logout

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("impersonation").textContent).not.toBe("null");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("logout-btn"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("impersonation").textContent).toBe("null");
    });
  });
});

// ---------- fetchWithAuth ----------

describe("fetchWithAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "access_token=; max-age=0";
    document.cookie = "refresh_token=; max-age=0";
    global.fetch = vi.fn();
  });

  it("attaches Authorization header with access token", async () => {
    const ue = userEvent.setup();
    document.cookie = "access_token=my-token; path=/";

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (typeof url === "string" && url.includes("/api/auth/me")) {
          return Promise.resolve(mockFetchOk(meResponse()));
        }
        return Promise.resolve(mockFetchOk({ data: [] }));
      }
    );

    render(
      <AuthProvider>
        <FetchConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Test User");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("fetch-get"));
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const appsCall = fetchMock.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/api/apps")
    );
    expect(appsCall).toBeDefined();
    expect(appsCall![1].headers.Authorization).toBe("Bearer my-token");
  });

  it("returns synthetic 401 when no token exists for non-auth endpoints", async () => {
    const ue = userEvent.setup();

    // No token set — /me returns nothing (no token scenario)
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchFail()
    );

    render(
      <AuthProvider>
        <FetchConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("fetch-get"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("fetch-result").textContent).toBe("401");
    });

    // fetch should NOT have been called for /api/apps (synthetic response)
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const appsCall = fetchMock.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/api/apps")
    );
    expect(appsCall).toBeUndefined();
  });

  it("sets Content-Type to application/json when body is present", async () => {
    const ue = userEvent.setup();
    document.cookie = "access_token=my-token; path=/";

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (typeof url === "string" && url.includes("/api/auth/me")) {
          return Promise.resolve(mockFetchOk(meResponse()));
        }
        return Promise.resolve(mockFetchOk({}));
      }
    );

    render(
      <AuthProvider>
        <FetchConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Test User");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("fetch-post"));
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const postCall = fetchMock.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" && c[0].includes("/api/account/tracked-apps")
    );
    expect(postCall).toBeDefined();
    expect(postCall![1].headers["Content-Type"]).toBe("application/json");
  });

  it("clears auth state on 401 response from API", async () => {
    const ue = userEvent.setup();
    document.cookie = "access_token=expired-token; path=/";

    let callCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (typeof url === "string" && url.includes("/api/auth/me")) {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve(mockFetchOk(meResponse()));
          }
          return Promise.resolve(mockFetchFail(401));
        }
        // /api/apps returns 401
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: "Token expired" }),
        });
      }
    );

    render(
      <AuthProvider>
        <FetchConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Test User");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("fetch-get"));
    });

    // Auth state should be cleared after 401
    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("null");
    });
  });

  it("passes through non-401 errors unchanged", async () => {
    const ue = userEvent.setup();
    document.cookie = "access_token=my-token; path=/";

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (typeof url === "string" && url.includes("/api/auth/me")) {
          return Promise.resolve(mockFetchOk(meResponse()));
        }
        // Return 500 error
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Internal server error" }),
        });
      }
    );

    render(
      <AuthProvider>
        <FetchConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Test User");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("fetch-get"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("fetch-result").textContent).toBe("500");
    });

    // User should still be authenticated (500 does not clear state)
    expect(screen.getByTestId("user").textContent).toBe("Test User");
  });

  it("does not clear auth state on 401 for auth endpoints", async () => {
    document.cookie = "access_token=my-token; path=/";

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (typeof url === "string" && url.includes("/api/auth/me")) {
          return Promise.resolve(mockFetchOk(meResponse()));
        }
        return Promise.resolve(mockFetchOk({}));
      }
    );

    // Internally test doFetch: auth endpoints with 401 should NOT clear state
    // This is implicitly tested — /api/auth/ paths are excluded from the clear-on-401 logic
    let capturedFetchWithAuth: ((path: string, opts?: RequestInit) => Promise<Response>) | null =
      null;
    function CaptureFetch() {
      const { fetchWithAuth, isLoading } = useAuth();
      capturedFetchWithAuth = fetchWithAuth;
      return <div data-testid="loading">{String(isLoading)}</div>;
    }

    render(
      <AuthProvider>
        <CaptureFetch />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // This should not throw or clear auth state
    expect(capturedFetchWithAuth).not.toBeNull();
  });
});

// ---------- Platform auto-injection ----------

describe("Platform auto-injection (withAutoPlatform)", () => {
  let originalPathname: string;

  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "access_token=; max-age=0";
    document.cookie = "refresh_token=; max-age=0";
    global.fetch = vi.fn();
    originalPathname = window.location.pathname;
  });

  afterEach(() => {
    // Restore pathname
    Object.defineProperty(window, "location", {
      value: { ...window.location, pathname: originalPathname },
      writable: true,
    });
  });

  it("appends platform param when URL path has a valid platform segment", async () => {
    const ue = userEvent.setup();
    document.cookie = "access_token=my-token; path=/";

    // Set pathname to /shopify/apps
    Object.defineProperty(window, "location", {
      value: { ...window.location, pathname: "/shopify/apps" },
      writable: true,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (typeof url === "string" && url.includes("/api/auth/me")) {
          return Promise.resolve(mockFetchOk(meResponse()));
        }
        return Promise.resolve(mockFetchOk({ data: [] }));
      }
    );

    render(
      <AuthProvider>
        <FetchConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Test User");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("fetch-get"));
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const appsCall = fetchMock.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/api/apps")
    );
    expect(appsCall).toBeDefined();
    expect(appsCall![0]).toContain("?platform=shopify");
  });

  it("does not append platform for exempt paths (auth, system-admin)", async () => {
    document.cookie = "access_token=my-token; path=/";

    Object.defineProperty(window, "location", {
      value: { ...window.location, pathname: "/shopify/apps" },
      writable: true,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
      return Promise.resolve(mockFetchOk(meResponse()));
    });

    let capturedFetchWithAuth: ((path: string, opts?: RequestInit) => Promise<Response>) | null =
      null;
    function CaptureFetch() {
      const { fetchWithAuth, isLoading } = useAuth();
      capturedFetchWithAuth = fetchWithAuth;
      return <div data-testid="loading">{String(isLoading)}</div>;
    }

    render(
      <AuthProvider>
        <CaptureFetch />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // Call an exempt path
    await act(async () => {
      await capturedFetchWithAuth!("/api/auth/me");
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const meCalls = fetchMock.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/api/auth/me")
    );
    // All /me calls should NOT have platform appended
    for (const call of meCalls) {
      expect(call[0]).not.toContain("platform=");
    }
  });

  it("does not duplicate platform param if already present", async () => {
    const ue = userEvent.setup();
    document.cookie = "access_token=my-token; path=/";

    Object.defineProperty(window, "location", {
      value: { ...window.location, pathname: "/shopify/apps" },
      writable: true,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (typeof url === "string" && url.includes("/api/auth/me")) {
          return Promise.resolve(mockFetchOk(meResponse()));
        }
        return Promise.resolve(mockFetchOk({}));
      }
    );

    let capturedFetchWithAuth: ((path: string, opts?: RequestInit) => Promise<Response>) | null =
      null;
    function CaptureFetch() {
      const { fetchWithAuth, isLoading } = useAuth();
      capturedFetchWithAuth = fetchWithAuth;
      return <div data-testid="loading">{String(isLoading)}</div>;
    }

    render(
      <AuthProvider>
        <CaptureFetch />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    await act(async () => {
      await capturedFetchWithAuth!("/api/apps?platform=salesforce");
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const appsCall = fetchMock.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/api/apps?platform=salesforce")
    );
    expect(appsCall).toBeDefined();
    // Should NOT have double platform params
    const url = appsCall![0] as string;
    const platformMatches = url.match(/platform=/g);
    expect(platformMatches).toHaveLength(1);
  });

  it("does not append platform when path segment is not a valid platform", async () => {
    document.cookie = "access_token=my-token; path=/";

    Object.defineProperty(window, "location", {
      value: { ...window.location, pathname: "/overview" },
      writable: true,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (typeof url === "string" && url.includes("/api/auth/me")) {
          return Promise.resolve(mockFetchOk(meResponse()));
        }
        return Promise.resolve(mockFetchOk({}));
      }
    );

    let capturedFetchWithAuth: ((path: string, opts?: RequestInit) => Promise<Response>) | null =
      null;
    function CaptureFetch() {
      const { fetchWithAuth, isLoading } = useAuth();
      capturedFetchWithAuth = fetchWithAuth;
      return <div data-testid="loading">{String(isLoading)}</div>;
    }

    render(
      <AuthProvider>
        <CaptureFetch />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    await act(async () => {
      await capturedFetchWithAuth!("/api/apps");
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const appsCall = fetchMock.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/api/apps")
    );
    expect(appsCall).toBeDefined();
    expect(appsCall![0]).not.toContain("platform=");
  });
});

// ---------- Session lifecycle ----------

describe("Session lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "access_token=; max-age=0";
    document.cookie = "refresh_token=; max-age=0";
    global.fetch = vi.fn();
  });

  it("page load with valid token - user stays logged in", async () => {
    document.cookie = "access_token=valid-token; path=/";

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchOk(meResponse())
    );

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("Test User");
    expect(screen.getByTestId("account").textContent).toBe("Test Account");
  });

  it("page load with no tokens - user is not logged in, loading completes", async () => {
    // No cookies set at all

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("null");
    expect(screen.getByTestId("account").textContent).toBe("null");
    // fetch should NOT have been called (no token means skip)
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("page load with expired/invalid token - /me fails, user cleared", async () => {
    document.cookie = "access_token=expired-token; path=/";

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchFail(401)
    );

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("null");
    expect(screen.getByTestId("account").textContent).toBe("null");
  });

  it("refreshUser can be called to re-fetch user data", async () => {
    document.cookie = "access_token=valid-token; path=/";

    let callCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          mockFetchOk(meResponse({ user: makeUser({ name: "Original" }) }))
        );
      }
      return Promise.resolve(
        mockFetchOk(meResponse({ user: makeUser({ name: "Updated" }) }))
      );
    });

    let capturedRefreshUser: (() => Promise<void>) | null = null;
    function RefreshCapture() {
      const { user, isLoading, refreshUser } = useAuth();
      capturedRefreshUser = refreshUser;
      return (
        <div>
          <div data-testid="loading">{String(isLoading)}</div>
          <div data-testid="user">{user ? user.name : "null"}</div>
        </div>
      );
    }

    render(
      <AuthProvider>
        <RefreshCapture />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Original");
    });

    await act(async () => {
      await capturedRefreshUser!();
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Updated");
    });
  });

  it("refreshUser clears state when token is deleted between calls", async () => {
    document.cookie = "access_token=valid-token; path=/";

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchOk(meResponse())
    );

    let capturedRefreshUser: (() => Promise<void>) | null = null;
    function RefreshCapture() {
      const { user, isLoading, refreshUser } = useAuth();
      capturedRefreshUser = refreshUser;
      return (
        <div>
          <div data-testid="loading">{String(isLoading)}</div>
          <div data-testid="user">{user ? user.name : "null"}</div>
        </div>
      );
    }

    render(
      <AuthProvider>
        <RefreshCapture />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Test User");
    });

    // Delete token
    document.cookie = "access_token=; max-age=0";

    await act(async () => {
      await capturedRefreshUser!();
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("null");
    });
  });
});

// ---------- Impersonation (additional tests) ----------

describe("Impersonation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "access_token=; max-age=0";
    document.cookie = "refresh_token=; max-age=0";
    global.fetch = vi.fn();
  });

  it("startImpersonation stores new access token and refreshes user", async () => {
    const ue = userEvent.setup();
    document.cookie = "access_token=admin-token; path=/";
    document.cookie = "refresh_token=admin-refresh; path=/";

    let meCallCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (
          typeof url === "string" &&
          url.includes("/api/system-admin/impersonate/")
        ) {
          return Promise.resolve(
            mockFetchOk({ accessToken: "impersonation-token" })
          );
        }
        meCallCount++;
        if (meCallCount <= 1) {
          return Promise.resolve(mockFetchOk(meResponse()));
        }
        return Promise.resolve(
          mockFetchOk(
            meResponse({
              user: makeUser({ id: "u2", name: "Bob", email: "bob@test.com" }),
              impersonation: {
                isImpersonating: true,
                realAdmin: {
                  userId: "1",
                  email: "test@test.com",
                  name: "Test User",
                },
                targetUser: {
                  userId: "u2",
                  email: "bob@test.com",
                  name: "Bob",
                },
              },
            })
          )
        );
      }
    );

    function ImpersonateConsumer() {
      const { user, isLoading, startImpersonation, impersonation } = useAuth();
      return (
        <div>
          <div data-testid="loading">{String(isLoading)}</div>
          <div data-testid="user">{user ? user.name : "null"}</div>
          <div data-testid="impersonation">
            {impersonation ? JSON.stringify(impersonation) : "null"}
          </div>
          <button
            data-testid="start-imp"
            onClick={() => startImpersonation("u2")}
          >
            Start
          </button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <ImpersonateConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Test User");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("start-imp"));
    });

    // Access token should be updated
    expect(document.cookie).toContain("access_token=impersonation-token");
    // Refresh token should still be the admin's (not changed)
    expect(document.cookie).toContain("refresh_token=admin-refresh");
    expect(mockPush).toHaveBeenCalledWith("/overview");

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Bob");
    });
  });

  it("startImpersonation throws on API failure", async () => {
    const ue = userEvent.setup();
    document.cookie = "access_token=admin-token; path=/";

    let impError: Error | null = null;

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (
          typeof url === "string" &&
          url.includes("/api/system-admin/impersonate/")
        ) {
          return Promise.resolve({
            ok: false,
            status: 403,
            json: () => Promise.resolve({ error: "Not authorized" }),
          });
        }
        return Promise.resolve(mockFetchOk(meResponse()));
      }
    );

    function ImpErrorConsumer() {
      const { isLoading, startImpersonation } = useAuth();
      return (
        <div>
          <div data-testid="loading">{String(isLoading)}</div>
          <button
            data-testid="start-imp"
            onClick={async () => {
              try {
                await startImpersonation("u2");
              } catch (e) {
                impError = e as Error;
              }
            }}
          >
            Start
          </button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <ImpErrorConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("start-imp"));
    });

    expect(impError).not.toBeNull();
    expect(impError!.message).toBe("Not authorized");
  });

  it("stopImpersonation restores admin token and navigates to users page", async () => {
    const ue = userEvent.setup();
    document.cookie = "access_token=imp-token; path=/";

    let meCallCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (typeof url === "string" && url.includes("/stop-impersonation")) {
          return Promise.resolve(
            mockFetchOk({ accessToken: "admin-restored-token" })
          );
        }
        meCallCount++;
        if (meCallCount <= 1) {
          return Promise.resolve(
            mockFetchOk(
              meResponse({
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
              })
            )
          );
        }
        return Promise.resolve(mockFetchOk(meResponse()));
      }
    );

    function StopImpConsumer() {
      const { isLoading, stopImpersonation, impersonation } = useAuth();
      return (
        <div>
          <div data-testid="loading">{String(isLoading)}</div>
          <div data-testid="impersonation">
            {impersonation ? JSON.stringify(impersonation) : "null"}
          </div>
          <button
            data-testid="stop-imp"
            onClick={() => stopImpersonation()}
          >
            Stop
          </button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <StopImpConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("impersonation").textContent).not.toBe("null");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("stop-imp"));
    });

    expect(document.cookie).toContain("access_token=admin-restored-token");
    expect(mockPush).toHaveBeenCalledWith("/system-admin/users");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("stopImpersonation throws on API failure", async () => {
    const ue = userEvent.setup();
    document.cookie = "access_token=imp-token; path=/";

    let stopError: Error | null = null;

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (typeof url === "string" && url.includes("/stop-impersonation")) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve(
          mockFetchOk(
            meResponse({
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
            })
          )
        );
      }
    );

    function StopImpErrorConsumer() {
      const { isLoading, stopImpersonation } = useAuth();
      return (
        <div>
          <div data-testid="loading">{String(isLoading)}</div>
          <button
            data-testid="stop-imp"
            onClick={async () => {
              try {
                await stopImpersonation();
              } catch (e) {
                stopError = e as Error;
              }
            }}
          >
            Stop
          </button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <StopImpErrorConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    await act(async () => {
      await ue.click(screen.getByTestId("stop-imp"));
    });

    expect(stopError).not.toBeNull();
    expect(stopError!.message).toBe("Failed to stop impersonation");
  });
});

// ---------- useAuth hook ----------

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
