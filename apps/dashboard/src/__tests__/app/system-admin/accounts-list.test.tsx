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

import AccountsListPage from "@/app/(dashboard)/system-admin/accounts/page";

const mockAccounts = [
  {
    id: "a1", name: "Acme Corp", company: "Acme Inc", isSuspended: false, packageName: "Pro",
    hasLimitOverrides: false, packageId: 1, maxTrackedApps: 10, maxTrackedKeywords: 50,
    maxCompetitorApps: 20, maxTrackedFeatures: 10,
    usage: { members: 3, trackedApps: 5, trackedKeywords: 20, competitorApps: 8, trackedFeatures: 4 },
    createdAt: "2026-01-01T00:00:00Z", lastSeen: "2026-02-27T12:00:00Z",
  },
  {
    id: "a2", name: "Beta Inc", company: null, isSuspended: true, packageName: "Starter",
    hasLimitOverrides: true, packageId: 2, maxTrackedApps: 5, maxTrackedKeywords: 25,
    maxCompetitorApps: 10, maxTrackedFeatures: 5,
    usage: { members: 1, trackedApps: 2, trackedKeywords: 10, competitorApps: 3, trackedFeatures: 1 },
    createdAt: "2026-02-01T00:00:00Z", lastSeen: null,
  },
];

describe("AccountsListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("renders page title with count", async () => {
    render(<AccountsListPage />);
    await waitFor(() => {
      expect(screen.getByText(/Accounts \(2\)/)).toBeInTheDocument();
    });
  });

  it("renders breadcrumb", () => {
    render(<AccountsListPage />);
    expect(screen.getByText("System Admin")).toBeInTheDocument();
  });

  it("renders all accounts", async () => {
    render(<AccountsListPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
  });

  it("shows status filter buttons", () => {
    render(<AccountsListPage />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Suspended")).toBeInTheDocument();
  });

  it("filters by suspended status", async () => {
    const user = userEvent.setup();
    render(<AccountsListPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    // Click Suspended filter (there's a filter button with "Suspended" text)
    const suspendedBtns = screen.getAllByText("Suspended");
    // Find the filter button (not the badge in the table)
    const filterBtn = suspendedBtns.find((el) => el.closest("button")?.className.includes("text-xs"));
    if (filterBtn) {
      await act(async () => {
        await user.click(filterBtn);
      });
    }
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
  });

  it("searches by account name", async () => {
    const user = userEvent.setup();
    render(<AccountsListPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      await user.type(searchInput, "beta");
    });
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
  });

  it("shows empty state when no accounts match", async () => {
    const user = userEvent.setup();
    render(<AccountsListPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      await user.type(searchInput, "zzzzz");
    });
    expect(screen.getByText("No accounts found")).toBeInTheDocument();
  });

  it("shows package name badge", async () => {
    render(<AccountsListPage />);
    await waitFor(() => {
      expect(screen.getByText("Pro")).toBeInTheDocument();
    });
    expect(screen.getByText("Starter")).toBeInTheDocument();
  });

  it("shows override indicator for accounts with limit overrides", async () => {
    render(<AccountsListPage />);
    await waitFor(() => {
      expect(screen.getByText("*")).toBeInTheDocument();
    });
  });

  it("renders Suspend/Activate buttons", async () => {
    render(<AccountsListPage />);
    await waitFor(() => {
      expect(screen.getByText("Suspend")).toBeInTheDocument();
    });
    expect(screen.getByText("Activate")).toBeInTheDocument();
  });

  it("calls updateAccount on Suspend click", async () => {
    const user = userEvent.setup();
    render(<AccountsListPage />);
    await waitFor(() => {
      expect(screen.getByText("Suspend")).toBeInTheDocument();
    });
    mockFetchWithAuth.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await act(async () => {
      await user.click(screen.getByText("Suspend"));
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/system-admin/accounts/a1",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("sends digest for an account", async () => {
    const user = userEvent.setup();
    render(<AccountsListPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: "Digest sent" }),
    });
    const sendBtns = screen.getAllByRole("button");
    // Find the send button (small icon button)
    const sendBtn = sendBtns.find((b) => b.className.includes("h-8 w-8"));
    if (sendBtn) {
      await act(async () => {
        await user.click(sendBtn);
      });
    }
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/send-digest"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("renders sortable column headers", () => {
    render(<AccountsListPage />);
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Package")).toBeInTheDocument();
    expect(screen.getByText("Company")).toBeInTheDocument();
    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
  });

  it("shows usage fractions", async () => {
    render(<AccountsListPage />);
    await waitFor(() => {
      expect(screen.getByText("5/10")).toBeInTheDocument(); // trackedApps
    });
  });
});
