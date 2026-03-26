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

const mockHealthData = {
  matrix: [
    {
      platform: "shopify", scraperType: "category",
      lastRun: { status: "completed", completedAt: new Date().toISOString(), durationMs: 5000, itemsScraped: 20, itemsFailed: 0, error: null, fallbackUsed: false },
      avgDurationMs: 4500, prevDurationMs: 4000, currentlyRunning: false, runningStartedAt: null,
      schedule: { cron: "0 3 * * *", nextRunAt: new Date(Date.now() + 3600000).toISOString() },
    },
    {
      platform: "shopify", scraperType: "app_details",
      lastRun: { status: "failed", completedAt: new Date().toISOString(), durationMs: 2000, itemsScraped: 5, itemsFailed: 2, error: "Timeout", fallbackUsed: true },
      avgDurationMs: 3000, prevDurationMs: 2500, currentlyRunning: false, runningStartedAt: null,
      schedule: { cron: "0 1,13 * * *", nextRunAt: new Date(Date.now() + 7200000).toISOString() },
    },
    {
      platform: "salesforce", scraperType: "category",
      lastRun: null, avgDurationMs: null, prevDurationMs: null, currentlyRunning: true, runningStartedAt: new Date().toISOString(),
      schedule: { cron: "0 3 * * *", nextRunAt: new Date(Date.now() + 3600000).toISOString() },
    },
  ],
  summary: { healthy: 30, failed: 5, stale: 3, running: 2, totalScheduled: 55 },
  recentFailures: [],
  anomalies: [],
};

const mockStats = {
  accounts: 5, users: 10, totalApps: 100, totalCategories: 20,
  trackedApps: 25, trackedKeywords: 40, trackedFeatures: 8,
  freshness: [
    { scraperType: "daily_digest", lastCompletedAt: new Date().toISOString() },
    { scraperType: "compute_review_metrics", lastCompletedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
  ],
  workerStats: [],
};

const mockRuns = {
  runs: [
    { id: "r1", scraperType: "category", platform: "shopify", status: "completed", triggeredBy: "scheduler", queue: "background", createdAt: "2026-02-27T03:00:00Z", startedAt: "2026-02-27T03:00:01Z", metadata: { duration_ms: 5000, items_scraped: 20, items_failed: 0 }, error: null, assets: [] },
    { id: "r2", scraperType: "app_details", platform: "salesforce", status: "failed", triggeredBy: "manual", queue: "interactive", createdAt: "2026-02-27T10:00:00Z", startedAt: "2026-02-27T10:00:01Z", metadata: { duration_ms: 2000, items_scraped: 5, items_failed: 2, fallback_used: true, fallback_count: 1, fallback_contexts: ["salesforce/fetchAppPage/some-app"] }, error: "Timeout error", assets: [{ name: "my-app", href: "/apps/my-app" }] },
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
    localStorage.clear();
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/scraper/health")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockHealthData) });
      if (url.includes("/stats")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStats) });
      if (url.includes("/smoke-test/history")) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.includes("/runs")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRuns) });
      if (url.includes("/queue")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQueueStatus) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("renders the page title and breadcrumb", () => {
    render(<ScraperPage />);
    expect(screen.getByText("Scraper Management")).toBeInTheDocument();
    expect(screen.getByText("System Admin")).toBeInTheDocument();
  });

  it("renders summary stats pills", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText(/30 Healthy/)).toBeInTheDocument();
    });
    expect(screen.getByText(/5 Failed/)).toBeInTheDocument();
    expect(screen.getByText(/3 Stale/)).toBeInTheDocument();
    expect(screen.getByText(/2 Running/)).toBeInTheDocument();
  });

  it("renders operational matrix with platform rows", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("Operational Matrix")).toBeInTheDocument();
    });
    // Platform labels should appear (may appear in matrix + run history)
    expect(screen.getAllByText("Shopify").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Salesforce").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Canva").length).toBeGreaterThanOrEqual(1);
  });

  it("renders matrix column headers", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      // The matrix has 5 scraper type columns
      expect(screen.getAllByText("Categories").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("App Details").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Keywords").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Reviews").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Scores").length).toBeGreaterThanOrEqual(1);
  });

  it("renders fallback badge on cells with fallbackUsed", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      // The shopify/app_details cell has fallbackUsed: true, which shows "F" badge
      expect(screen.getAllByText("F").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders utility scraper cards", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("Utility Scrapers")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Daily Digest").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Review Metrics").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Similarity Scores").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Backfill Categories").length).toBeGreaterThanOrEqual(1);
  });

  it("renders queue status card", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("Queue Status")).toBeInTheDocument();
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

  it("renders queue jobs table with details", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("j1")).toBeInTheDocument();
    });
    expect(screen.getByText("j2")).toBeInTheDocument();
    expect(screen.getByText(/app: my-app/)).toBeInTheDocument();
    expect(screen.getByText(/keyword: shopify seo/)).toBeInTheDocument();
  });

  it("renders Run History section", () => {
    render(<ScraperPage />);
    expect(screen.getByText("Run History")).toBeInTheDocument();
  });

  it("renders run history rows with platform badges", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getAllByText("category").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("app_details").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("completed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("failed").length).toBeGreaterThanOrEqual(1);
  });

  it("shows scheduler/manual trigger badges in run history", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("scheduler")).toBeInTheDocument();
    });
    expect(screen.getByText("manual")).toBeInTheDocument();
  });

  it("shows fallback badge in run history", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("Fallback")).toBeInTheDocument();
    });
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
      if (url.includes("/scraper/health")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockHealthData) });
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

  it("fetches health data on mount", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/scraper/health")
      );
    });
  });

  it("renders Health Dashboard link", () => {
    render(<ScraperPage />);
    expect(screen.getByText(/View Health Dashboard/)).toBeInTheDocument();
  });

  it("renders Trigger All buttons per platform row", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      // There should be 11 "All" buttons (one per platform)
      expect(screen.getAllByText("All").length).toBe(11);
    });
  });

  it("renders smoke test history section with empty state", async () => {
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("Smoke Test History")).toBeInTheDocument();
    });
    expect(screen.getByText(/No smoke test results yet/)).toBeInTheDocument();
  });

  it("renders smoke test history with data", async () => {
    const mockSmokeHistory = [
      { platform: "shopify", checkName: "categories", passCount: 8, totalCount: 10, lastRunAt: new Date().toISOString(), lastStatus: "pass", recentErrors: [] },
      { platform: "shopify", checkName: "app", passCount: 3, totalCount: 10, lastRunAt: new Date().toISOString(), lastStatus: "fail", recentErrors: [{ error: "timeout", createdAt: new Date().toISOString(), durationMs: 60000 }] },
    ];
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/scraper/health")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockHealthData) });
      if (url.includes("/stats")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStats) });
      if (url.includes("/smoke-test/history")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSmokeHistory) });
      if (url.includes("/runs")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRuns) });
      if (url.includes("/queue")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQueueStatus) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(<ScraperPage />);
    await waitFor(() => {
      expect(screen.getByText("Smoke Test History")).toBeInTheDocument();
    });
    // Should show rate badges
    await waitFor(() => {
      expect(screen.getByText("8/10")).toBeInTheDocument();
    });
    expect(screen.getByText("3/10")).toBeInTheDocument();
    // Should show overall rate
    expect(screen.getByText(/55% overall/)).toBeInTheDocument();
  });
});
