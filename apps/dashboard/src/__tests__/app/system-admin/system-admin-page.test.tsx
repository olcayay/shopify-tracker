import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Admin", email: "a@b.com", role: "owner", isSystemAdmin: true, emailDigestEnabled: true, timezone: "UTC" },
    account: null,
    isLoading: false,
    fetchWithAuth: mockFetchWithAuth,
    refreshUser: vi.fn(),
  }),
}));

vi.mock("@/lib/format-date", () => ({
  useFormatDate: () => ({
    formatDateTime: (d: string) => d,
    formatDateOnly: (d: string) => d,
  }),
}));

import SystemAdminPage from "@/app/(dashboard)/system-admin/page";

function mockOkResponse(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}

const mockStats = {
  accounts: 5,
  users: 12,
  totalApps: 100,
  trackedApps: 25,
  trackedKeywords: 40,
  trackedFeatures: 8,
};

const mockAccounts = [
  { id: "a1", name: "Acme Corp", isSuspended: false, maxTrackedApps: 10, maxTrackedKeywords: 50, maxCompetitorApps: 20, maxTrackedFeatures: 10, usage: { members: 3, trackedApps: 5, trackedKeywords: 20, competitorApps: 8, trackedFeatures: 4 } },
  { id: "a2", name: "Beta Inc", isSuspended: true, maxTrackedApps: 5, maxTrackedKeywords: 25, maxCompetitorApps: 10, maxTrackedFeatures: 5, usage: { members: 1, trackedApps: 2, trackedKeywords: 10, competitorApps: 3, trackedFeatures: 1 } },
];

const mockUsers = [
  { id: "u1", name: "Alice", email: "alice@test.com", accountId: "a1", accountName: "Acme Corp", role: "owner", isSystemAdmin: true },
  { id: "u2", name: "Bob", email: "bob@test.com", accountId: "a2", accountName: "Beta Inc", role: "viewer", isSystemAdmin: false },
];

const mockRuns = [
  { id: "r1", scraperType: "category", status: "completed", startedAt: "2026-02-27T10:00:00Z", metadata: { duration_ms: 5000 } },
  { id: "r2", scraperType: "app_details", status: "running", startedAt: "2026-02-27T11:00:00Z", metadata: {} },
];

describe("SystemAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/stats")) return Promise.resolve(mockOkResponse(mockStats));
      if (url.includes("/accounts")) return Promise.resolve(mockOkResponse(mockAccounts));
      if (url.includes("/users")) return Promise.resolve(mockOkResponse(mockUsers));
      if (url.includes("/runs")) return Promise.resolve(mockOkResponse({ runs: mockRuns }));
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
  });

  it("renders the page title", async () => {
    render(<SystemAdminPage />);
    expect(screen.getByText("System Admin")).toBeInTheDocument();
  });

  it("renders stat cards after loading", async () => {
    render(<SystemAdminPage />);
    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument(); // accounts
    });
    expect(screen.getByText("12")).toBeInTheDocument(); // users
    expect(screen.getByText("100")).toBeInTheDocument(); // totalApps
    expect(screen.getByText("25")).toBeInTheDocument(); // trackedApps
    expect(screen.getByText("40")).toBeInTheDocument(); // keywords
    expect(screen.getByText("8")).toBeInTheDocument(); // features
  });

  it("renders stat card labels", async () => {
    render(<SystemAdminPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Accounts").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("Users").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Total Apps")).toBeInTheDocument();
    expect(screen.getByText("Tracked Apps")).toBeInTheDocument();
    expect(screen.getAllByText("Keywords").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Features").length).toBeGreaterThanOrEqual(1);
  });

  it("renders tabs", async () => {
    render(<SystemAdminPage />);
    expect(screen.getByRole("tab", { name: /accounts/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /users/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /scraper/i })).toBeInTheDocument();
  });

  it("renders accounts table by default", async () => {
    render(<SystemAdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
  });

  it("shows Active/Suspended badges for accounts", async () => {
    render(<SystemAdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
    expect(screen.getByText("Suspended")).toBeInTheDocument();
  });

  it("shows Suspend/Activate buttons", async () => {
    render(<SystemAdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Suspend")).toBeInTheDocument();
    });
    expect(screen.getByText("Activate")).toBeInTheDocument();
  });

  it("calls updateAccount when Suspend button is clicked", async () => {
    const user = userEvent.setup();
    render(<SystemAdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Suspend")).toBeInTheDocument();
    });
    mockFetchWithAuth.mockResolvedValueOnce(mockOkResponse({}));
    await act(async () => {
      await user.click(screen.getByText("Suspend"));
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/system-admin/accounts/a1",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("renders scraper trigger buttons in Scraper tab", async () => {
    const user = userEvent.setup();
    render(<SystemAdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByRole("tab", { name: /scraper/i }));
    });
    expect(screen.getByText("Categories")).toBeInTheDocument();
    expect(screen.getByText("App Details")).toBeInTheDocument();
    expect(screen.getByText("Reviews")).toBeInTheDocument();
  });

  it("triggers scraper when button is clicked", async () => {
    const user = userEvent.setup();
    render(<SystemAdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByRole("tab", { name: /scraper/i }));
    });
    mockFetchWithAuth.mockResolvedValueOnce(mockOkResponse({}));
    await act(async () => {
      await user.click(screen.getByText("Categories"));
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/system-admin/scraper/trigger",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows recent runs in scraper tab", async () => {
    const user = userEvent.setup();
    render(<SystemAdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByRole("tab", { name: /scraper/i }));
    });
    expect(screen.getByText("category")).toBeInTheDocument();
    expect(screen.getByText("app_details")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });

  it("shows empty state for runs", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/stats")) return Promise.resolve(mockOkResponse(mockStats));
      if (url.includes("/accounts")) return Promise.resolve(mockOkResponse([]));
      if (url.includes("/users")) return Promise.resolve(mockOkResponse([]));
      if (url.includes("/runs")) return Promise.resolve(mockOkResponse({ runs: [] }));
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    const user = userEvent.setup();
    render(<SystemAdminPage />);
    await act(async () => {
      await user.click(screen.getByRole("tab", { name: /scraper/i }));
    });
    await waitFor(() => {
      expect(screen.getByText("No scraper runs yet")).toBeInTheDocument();
    });
  });

  it("renders users table in Users tab", async () => {
    const user = userEvent.setup();
    render(<SystemAdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByRole("tab", { name: /users/i }));
    });
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("alice@test.com")).toBeInTheDocument();
  });

  it("shows message after triggering scraper", async () => {
    const user = userEvent.setup();
    render(<SystemAdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByRole("tab", { name: /scraper/i }));
    });
    mockFetchWithAuth.mockResolvedValueOnce(mockOkResponse({}));
    await act(async () => {
      await user.click(screen.getByText("Categories"));
    });
    await waitFor(() => {
      expect(screen.getByText(/Scraper "category" triggered/)).toBeInTheDocument();
    });
  });
});
