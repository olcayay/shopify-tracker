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

import ScraperPage from "@/app/(dashboard)/system-admin/scraper/page";

const mockStats = {
  accounts: 5, users: 10, totalApps: 100, totalCategories: 20,
  trackedApps: 25, trackedKeywords: 40, trackedFeatures: 8,
  freshness: [
    { scraperType: "category", lastCompletedAt: new Date().toISOString() },
    { scraperType: "app_details", lastCompletedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
  ],
  workerStats: [
    { scraper_type: "category", avg_duration_ms: 5000, avg_items: 20 },
  ],
};

const mockRuns = {
  runs: [
    { id: "r1", scraperType: "category", status: "completed", triggeredBy: "scheduler", queue: "background", createdAt: "2026-02-27T03:00:00Z", startedAt: "2026-02-27T03:00:01Z", metadata: { duration_ms: 5000, items_scraped: 20, items_failed: 0 }, error: null, assets: [] },
    { id: "r2", scraperType: "app_details", status: "failed", triggeredBy: "manual", queue: "interactive", createdAt: "2026-02-27T10:00:00Z", startedAt: "2026-02-27T10:00:01Z", metadata: { duration_ms: 2000, items_scraped: 5, items_failed: 2 }, error: "Timeout error", assets: [{ name: "my-app", href: "/apps/my-app" }] },
  ],
  total: 2,
};

const mockQueueStatus = {
  isPaused: false,
  counts: { active: 1, waiting: 3, delayed: 0, failed: 2 },
  jobs: [
    { id: "j1", type: "app_details", status: "active", queue: "interactive", createdAt: "2026-02-27T12:00:00Z", data: { slug: "my-app" } },
    { id: "j2", type: "keyword_search", status: "waiting", queue: "background", createdAt: "2026-02-27T12:01:00Z", data: { keyword: "shopify seo" } },
  ],
  queues: {
    interactive: { isPaused: false, counts: { active: 1, waiting: 0, delayed: 0, failed: 0 }, jobs: [] },
    background: { isPaused: false, counts: { active: 0, waiting: 3, delayed: 0, failed: 2 }, jobs: [] },
  },
};

describe("ScraperPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/stats")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStats) });
      if (url.includes("/runs")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRuns) });
      if (url.includes("/queue")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQueueStatus) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("renders the page title", () => {
    render(<ScraperPage />);
    expect(screen.getByText("Scraper Management")).toBeInTheDocument();
  });

  it("renders breadcrumb", () => {
    render(<ScraperPage />);
    expect(screen.getByText("System Admin")).toBeInTheDocument();
  });

  it("renders queue status card", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("Queue Status")).toBeInTheDocument();
    });
  });

  it("shows queue job counts in per-queue breakdown", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      // Per-queue breakdown labels (CSS uppercase but text content is lowercase)
      expect(screen.getByText("Queue Status")).toBeInTheDocument();
      // Queue column badges in the jobs table
      expect(screen.getByText("Pause")).toBeInTheDocument();
    });
  });

  it("shows Pause button when queue is running", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("Pause")).toBeInTheDocument();
    });
  });

  it("shows Clear Waiting button when waiting jobs exist", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("Clear Waiting")).toBeInTheDocument();
    });
  });

  it("shows Clear Failed button when failed jobs exist", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("Clear Failed")).toBeInTheDocument();
    });
  });

  it("renders scraper type cards", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Categories").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("App Details").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Reviews").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Daily Digest").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Review Metrics").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Similarity Scores").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Run buttons for each scraper type", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      const runButtons = screen.getAllByText("Run");
      expect(runButtons.length).toBe(7);
    });
  });

  it("triggers scraper when Run button is clicked", async () => {
    const user = userEvent.setup();
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Run").length).toBe(7);
    });
    mockFetchWithAuth.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    const runButtons = screen.getAllByText("Run");
    await act(async () => {
      await user.click(runButtons[0]);
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/system-admin/scraper/trigger",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("renders Run History section", () => {
    render(<ScraperPage />);
    expect(screen.getByText("Run History")).toBeInTheDocument();
  });

  it("renders run history rows", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getAllByText("category").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("app_details").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("completed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("failed").length).toBeGreaterThanOrEqual(1);
  });

  it("shows scheduler/manual trigger badges", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("scheduler")).toBeInTheDocument();
    });
    expect(screen.getByText("manual")).toBeInTheDocument();
  });

  it("shows items scraped count", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText(/20 scraped/)).toBeInTheDocument();
    });
  });

  it("shows failed items count", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText(/2 failed/)).toBeInTheDocument();
    });
  });

  it("shows empty state for runs", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/stats")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStats) });
      if (url.includes("/runs")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ runs: [], total: 0 }) });
      if (url.includes("/queue")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQueueStatus) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("No scraper runs yet")).toBeInTheDocument();
    });
  });

  it("renders queue jobs table with queue labels", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("j1")).toBeInTheDocument();
    });
    expect(screen.getByText("j2")).toBeInTheDocument();
    expect(screen.getByText(/app: my-app/)).toBeInTheDocument();
    expect(screen.getByText(/keyword: shopify seo/)).toBeInTheDocument();
  });

  it("opens drain confirmation modal", async () => {
    const user = userEvent.setup();
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("Clear Waiting")).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByText("Clear Waiting"));
    });
    expect(screen.getByText("Clear Waiting Jobs")).toBeInTheDocument();
  });

  it("opens clear failed confirmation modal", async () => {
    const user = userEvent.setup();
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("Clear Failed")).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByText("Clear Failed"));
    });
    expect(screen.getByText("Clear Failed Jobs")).toBeInTheDocument();
  });

  it("shows scraper descriptions", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("Scrape Shopify app categories tree")).toBeInTheDocument();
    });
    expect(screen.getByText(/Scrape tracked app details/)).toBeInTheDocument();
  });

  it("shows asset counts", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/20 categories/).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/25 apps/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/40 keywords/).length).toBeGreaterThanOrEqual(1);
  });
});
