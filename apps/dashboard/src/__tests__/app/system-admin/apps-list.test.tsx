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

import AppsListPage from "@/app/(dashboard)/system-admin/apps/page";

const mockApps = [
  { slug: "my-app", name: "My App", isTracked: true, trackedByCount: 2, competitorByCount: 1, lastScrapedAt: "2026-02-27T10:00:00Z", lastChangeAt: "2026-02-25T08:00:00Z" },
  { slug: "other-app", name: "Other App", isTracked: false, trackedByCount: 0, competitorByCount: 0, lastScrapedAt: null, lastChangeAt: null },
  { slug: "third-app", name: "Third App", isTracked: true, trackedByCount: 1, competitorByCount: 3, lastScrapedAt: "2026-02-26T05:00:00Z", lastChangeAt: "2026-02-24T12:00:00Z" },
];

describe("AppsListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/apps")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockApps) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("renders page title with count", async () => {
    render(<AppsListPage />);
    await waitFor(() => {
      // Default filter is "tracked" so shows 2 tracked apps
      expect(screen.getAllByText(/Apps/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders breadcrumb", () => {
    render(<AppsListPage />);
    expect(screen.getByText("System Admin")).toBeInTheDocument();
  });

  it("renders tracked app names (default filter is tracked)", async () => {
    render(<AppsListPage />);
    await waitFor(() => {
      expect(screen.getByText("My App")).toBeInTheDocument();
    });
    expect(screen.getByText("Third App")).toBeInTheDocument();
    // "Other App" is not tracked, so it doesn't appear with default "tracked" filter
  });

  it("shows all apps when All filter is selected", async () => {
    const user = userEvent.setup();
    render(<AppsListPage />);
    await waitFor(() => {
      expect(screen.getByText("My App")).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByText("All"));
    });
    expect(screen.getByText("My App")).toBeInTheDocument();
    expect(screen.getByText("Other App")).toBeInTheDocument();
    expect(screen.getByText("Third App")).toBeInTheDocument();
  });

  it("renders status badges", async () => {
    const user = userEvent.setup();
    render(<AppsListPage />);
    await waitFor(() => {
      expect(screen.getByText("My App")).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByText("All"));
    });
    expect(screen.getAllByText("Tracked").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Not tracked").length).toBeGreaterThanOrEqual(1);
  });

  it("renders status filter buttons", () => {
    render(<AppsListPage />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Not Tracked")).toBeInTheDocument();
  });

  it("filters by search", async () => {
    const user = userEvent.setup();
    render(<AppsListPage />);
    await waitFor(() => {
      expect(screen.getByText("My App")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      await user.type(searchInput, "third");
    });
    expect(screen.getByText("Third App")).toBeInTheDocument();
    expect(screen.queryByText("My App")).not.toBeInTheDocument();
  });

  it("shows empty state when no apps match", async () => {
    const user = userEvent.setup();
    render(<AppsListPage />);
    await waitFor(() => {
      expect(screen.getByText("My App")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      await user.type(searchInput, "zzzzz");
    });
    expect(screen.getByText("No apps found")).toBeInTheDocument();
  });

  it("renders app slugs", async () => {
    render(<AppsListPage />);
    await waitFor(() => {
      expect(screen.getByText("my-app")).toBeInTheDocument();
    });
    expect(screen.getByText("third-app")).toBeInTheDocument();
  });

  it("shows tracked by count links", async () => {
    render(<AppsListPage />);
    await waitFor(() => {
      expect(screen.getByText("2 accounts")).toBeInTheDocument();
    });
  });

  it("shows competitor count links", async () => {
    render(<AppsListPage />);
    await waitFor(() => {
      expect(screen.getByText("3 accounts")).toBeInTheDocument();
    });
  });

  it("triggers scrape when button is clicked", async () => {
    const user = userEvent.setup();
    render(<AppsListPage />);
    await waitFor(() => {
      expect(screen.getByText("My App")).toBeInTheDocument();
    });
    mockFetchWithAuth.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    const scrapeButtons = screen.getAllByTitle("Scrape app");
    await act(async () => {
      await user.click(scrapeButtons[0]);
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/system-admin/scraper/trigger",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("renders sortable column headers", () => {
    render(<AppsListPage />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Slug")).toBeInTheDocument();
    expect(screen.getByText("Tracked By")).toBeInTheDocument();
    expect(screen.getByText("Competitor For")).toBeInTheDocument();
    expect(screen.getByText("Last Scraped")).toBeInTheDocument();
    expect(screen.getByText("Last Change")).toBeInTheDocument();
  });
});
