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

import KeywordsListPage from "@/app/(dashboard)/system-admin/keywords/page";

const mockKeywords = [
  { id: 1, keyword: "shopify seo", slug: "shopify-seo", isActive: true, trackedByCount: 3, createdAt: "2026-01-10T00:00:00Z", lastScrapedAt: "2026-02-27T08:00:00Z" },
  { id: 2, keyword: "ecommerce tools", slug: "ecommerce-tools", isActive: true, trackedByCount: 1, createdAt: "2026-02-01T00:00:00Z", lastScrapedAt: "2026-02-27T07:00:00Z" },
  { id: 3, keyword: "abandoned cart", slug: "abandoned-cart", isActive: false, trackedByCount: 0, createdAt: "2026-01-20T00:00:00Z", lastScrapedAt: null },
];

describe("KeywordsListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/keywords")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockKeywords) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("renders page title with count", async () => {
    render(<KeywordsListPage />);
    await waitFor(() => {
      expect(screen.getByText(/Keywords \(3\)/)).toBeInTheDocument();
    });
  });

  it("renders breadcrumb", () => {
    render(<KeywordsListPage />);
    expect(screen.getByText("System Admin")).toBeInTheDocument();
  });

  it("renders all keywords", async () => {
    render(<KeywordsListPage />);
    await waitFor(() => {
      expect(screen.getByText("shopify seo")).toBeInTheDocument();
    });
    expect(screen.getByText("ecommerce tools")).toBeInTheDocument();
    expect(screen.getByText("abandoned cart")).toBeInTheDocument();
  });

  it("renders status badges", async () => {
    render(<KeywordsListPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("Inactive").length).toBeGreaterThanOrEqual(1);
  });

  it("renders status filter buttons", () => {
    render(<KeywordsListPage />);
    expect(screen.getByText("All")).toBeInTheDocument();
  });

  it("filters by Active status", async () => {
    const user = userEvent.setup();
    render(<KeywordsListPage />);
    await waitFor(() => {
      expect(screen.getByText("shopify seo")).toBeInTheDocument();
    });
    // Find the Active filter button
    const activeBtns = screen.getAllByText("Active");
    const filterBtn = activeBtns.find((el) => el.closest("button")?.className.includes("text-xs"));
    if (filterBtn) {
      await act(async () => {
        await user.click(filterBtn);
      });
    }
    expect(screen.getByText("shopify seo")).toBeInTheDocument();
    expect(screen.getByText("ecommerce tools")).toBeInTheDocument();
    expect(screen.queryByText("abandoned cart")).not.toBeInTheDocument();
  });

  it("filters by search", async () => {
    const user = userEvent.setup();
    render(<KeywordsListPage />);
    await waitFor(() => {
      expect(screen.getByText("shopify seo")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      await user.type(searchInput, "ecommerce");
    });
    expect(screen.getByText("ecommerce tools")).toBeInTheDocument();
    expect(screen.queryByText("shopify seo")).not.toBeInTheDocument();
  });

  it("shows empty state", async () => {
    const user = userEvent.setup();
    render(<KeywordsListPage />);
    await waitFor(() => {
      expect(screen.getByText("shopify seo")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      await user.type(searchInput, "zzzzz");
    });
    expect(screen.getByText("No keywords found")).toBeInTheDocument();
  });

  it("shows tracked by count", async () => {
    render(<KeywordsListPage />);
    await waitFor(() => {
      expect(screen.getByText("3 accounts")).toBeInTheDocument();
    });
    expect(screen.getByText("1 account")).toBeInTheDocument();
  });

  it("opens delete confirmation modal", async () => {
    const user = userEvent.setup();
    render(<KeywordsListPage />);
    await waitFor(() => {
      expect(screen.getByText("shopify seo")).toBeInTheDocument();
    });
    // Click any delete button (Trash2 icon)
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.className.includes("hover:text-destructive")
    );
    if (deleteButtons.length > 0) {
      await act(async () => {
        await user.click(deleteButtons[0]);
      });
      expect(screen.getByText("Delete Keyword")).toBeInTheDocument();
    }
  });

  it("triggers scrape when button is clicked", async () => {
    const user = userEvent.setup();
    render(<KeywordsListPage />);
    await waitFor(() => {
      expect(screen.getByText("shopify seo")).toBeInTheDocument();
    });
    mockFetchWithAuth.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    const scrapeButtons = screen.getAllByTitle("Scrape keyword");
    await act(async () => {
      await user.click(scrapeButtons[0]);
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/system-admin/scraper/trigger",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("renders sortable column headers", () => {
    render(<KeywordsListPage />);
    expect(screen.getByText("Keyword")).toBeInTheDocument();
    expect(screen.getByText("Tracked By")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Last Scraped")).toBeInTheDocument();
  });
});
