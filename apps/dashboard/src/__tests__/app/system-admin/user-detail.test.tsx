import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

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
  useParams: () => ({ id: "user-123" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/system-admin/users/user-123",
  useSearchParams: () => new URLSearchParams(),
}));

import UserDetailPage from "@/app/(dashboard)/system-admin/users/[id]/page";

const mockUserDetail = {
  id: "user-123",
  name: "Alice Smith",
  email: "alice@test.com",
  accountId: "acc-1",
  accountName: "Acme Corp",
  role: "owner",
  isSystemAdmin: true,
  createdAt: "2026-01-15T00:00:00Z",
  trackedApps: [
    { appSlug: "my-app", appName: "My App", createdAt: "2026-01-20T00:00:00Z", lastScrapedAt: "2026-02-27T10:00:00Z" },
  ],
  trackedKeywords: [
    { keywordId: 1, keyword: "shopify seo", createdAt: "2026-01-25T00:00:00Z", lastScrapedAt: "2026-02-27T08:00:00Z" },
  ],
  competitorApps: [
    { appSlug: "competitor-app", appName: "Competitor App", createdAt: "2026-02-01T00:00:00Z", lastScrapedAt: null },
  ],
  trackedFeatures: [
    { featureHandle: "email-marketing", featureTitle: "Email Marketing", createdAt: "2026-02-10T00:00:00Z" },
  ],
};

describe("UserDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUserDetail),
    });
  });

  it("shows loading skeleton initially", () => {
    mockFetchWithAuth.mockReturnValue(new Promise(() => {})); // never resolves
    render(<UserDetailPage />);
    expect(screen.getByText("User Detail")).toBeInTheDocument();
  });

  it("renders user name and badges after loading", async () => {
    render(<UserDetailPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Alice Smith").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("owner").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("System Admin").length).toBeGreaterThanOrEqual(1);
  });

  it("renders breadcrumb navigation", async () => {
    render(<UserDetailPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Alice Smith").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("System Admin").length).toBeGreaterThanOrEqual(1);
  });

  it("renders user info card", async () => {
    render(<UserDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("alice@test.com")).toBeInTheDocument();
    });
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("User Info")).toBeInTheDocument();
  });

  it("renders summary stat cards", async () => {
    render(<UserDetailPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Tracked Apps").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("Keywords").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Competitors").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Features").length).toBeGreaterThanOrEqual(1);
  });

  it("renders tracked apps table", async () => {
    render(<UserDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("My App")).toBeInTheDocument();
    });
    expect(screen.getByText("my-app")).toBeInTheDocument();
  });

  it("renders tracked keywords table", async () => {
    render(<UserDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("shopify seo")).toBeInTheDocument();
    });
  });

  it("renders competitor apps table", async () => {
    render(<UserDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Competitor App")).toBeInTheDocument();
    });
  });

  it("renders tracked features table", async () => {
    render(<UserDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Email Marketing")).toBeInTheDocument();
    });
  });

  it("shows 'User not found' when API returns error", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    render(<UserDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("User not found.")).toBeInTheDocument();
    });
  });

  it("shows empty state for each table when no data", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...mockUserDetail,
        trackedApps: [],
        trackedKeywords: [],
        competitorApps: [],
        trackedFeatures: [],
      }),
    });
    render(<UserDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("No tracked apps")).toBeInTheDocument();
    });
    expect(screen.getByText("No tracked keywords")).toBeInTheDocument();
    expect(screen.getByText("No competitor apps")).toBeInTheDocument();
    expect(screen.getByText("No tracked features")).toBeInTheDocument();
  });
});
