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

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "acc-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/system-admin/accounts/acc-1",
  useSearchParams: () => new URLSearchParams(),
}));

import AccountDetailPage from "@/app/(dashboard)/system-admin/accounts/[id]/page";

const mockPackages = [
  { id: 1, slug: "starter", name: "Starter", maxTrackedApps: 5, maxTrackedKeywords: 25, maxCompetitorApps: 10, maxTrackedFeatures: 5, maxUsers: 2, sortOrder: 0 },
  { id: 2, slug: "pro", name: "Pro", maxTrackedApps: 10, maxTrackedKeywords: 50, maxCompetitorApps: 20, maxTrackedFeatures: 10, maxUsers: 5, sortOrder: 1 },
];

const mockAccountDetail = {
  id: "acc-1",
  name: "Acme Corp",
  isSuspended: false,
  packageId: 2,
  package: mockPackages[1],
  maxTrackedApps: 15,
  maxTrackedKeywords: 50,
  maxCompetitorApps: 20,
  maxTrackedFeatures: 10,
  maxUsers: 5,
  members: [
    { id: "u1", name: "Alice", email: "alice@test.com", role: "owner", isSystemAdmin: false, createdAt: "2026-01-01T00:00:00Z" },
    { id: "u2", name: "Bob", email: "bob@test.com", role: "viewer", isSystemAdmin: false, createdAt: "2026-02-01T00:00:00Z" },
  ],
  trackedApps: [
    { appSlug: "my-app", appName: "My App", lastScrapedAt: "2026-02-27T10:00:00Z" },
  ],
  trackedKeywords: [
    { keywordId: 1, keyword: "shopify seo", lastScrapedAt: "2026-02-27T08:00:00Z" },
  ],
  competitorApps: [],
  trackedFeatures: [],
};

describe("AccountDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/packages")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPackages) });
      if (url.includes("/accounts/acc-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccountDetail) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("shows loading skeleton initially", () => {
    mockFetchWithAuth.mockReturnValue(new Promise(() => {}));
    render(<AccountDetailPage />);
    expect(screen.getByText("Account Detail")).toBeInTheDocument();
  });

  it("renders account name and status badge", async () => {
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(1);
  });

  it("renders breadcrumbs", async () => {
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    expect(screen.getByText("System Admin")).toBeInTheDocument();
    expect(screen.getByText("Accounts")).toBeInTheDocument();
  });

  it("shows package selection buttons", async () => {
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Starter")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Pro").length).toBeGreaterThanOrEqual(1);
  });

  it("renders limits and usage section", async () => {
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Limits & Usage")).toBeInTheDocument();
    });
    expect(screen.getByText("Tracked Apps")).toBeInTheDocument();
    expect(screen.getByText("Keywords")).toBeInTheDocument();
    expect(screen.getByText("Competitors")).toBeInTheDocument();
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
  });

  it("shows override indicator when limits differ from package", async () => {
    render(<AccountDetailPage />);
    await waitFor(() => {
      // maxTrackedApps is 15 but package default is 10, so there should be a "*"
      const asterisks = screen.getAllByText("*");
      expect(asterisks.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders Edit Limits button", async () => {
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Edit Limits")).toBeInTheDocument();
    });
  });

  it("enters edit mode when Edit Limits is clicked", async () => {
    const user = userEvent.setup();
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Edit Limits")).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByText("Edit Limits"));
    });
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("renders Suspend button", async () => {
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Suspend")).toBeInTheDocument();
    });
  });

  it("calls toggleSuspend when button is clicked", async () => {
    const user = userEvent.setup();
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Suspend")).toBeInTheDocument();
    });
    mockFetchWithAuth.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await act(async () => {
      await user.click(screen.getByText("Suspend"));
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/system-admin/accounts/acc-1",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("renders members table", async () => {
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(/Members \(2\)/)).toBeInTheDocument();
  });

  it("renders tracked apps table", async () => {
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("My App")).toBeInTheDocument();
    });
  });

  it("renders tracked keywords table", async () => {
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("shopify seo")).toBeInTheDocument();
    });
  });

  it("shows empty state for competitor apps and features", async () => {
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("No competitor apps")).toBeInTheDocument();
    });
    expect(screen.getByText("No tracked features")).toBeInTheDocument();
  });

  it("shows 'Account not found' when API returns error", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/packages")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPackages) });
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Account not found.")).toBeInTheDocument();
    });
  });

  it("changes package when a different package button is clicked", async () => {
    const user = userEvent.setup();
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Starter")).toBeInTheDocument();
    });
    mockFetchWithAuth.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await act(async () => {
      await user.click(screen.getByText("Starter"));
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/system-admin/accounts/acc-1",
      expect.objectContaining({ method: "PATCH" })
    );
  });
});
