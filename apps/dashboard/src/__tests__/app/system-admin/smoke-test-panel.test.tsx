import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock shared module
vi.mock("@appranks/shared", () => ({
  SMOKE_PLATFORMS: [
    { platform: "shopify", checks: ["categories", "app", "keyword", "reviews", "featured"] },
    { platform: "salesforce", checks: ["categories", "app", "keyword", "reviews", "featured"] },
  ],
  SMOKE_CHECKS: ["categories", "app", "keyword", "reviews", "featured"],
  getSmokeCheck: (platform: string, check: string) => {
    const map: Record<string, string[]> = {
      shopify: ["categories", "app", "keyword", "reviews", "featured"],
      salesforce: ["categories", "app", "keyword", "reviews"],
    };
    return map[platform]?.includes(check) ? { cmd: check } : null;
  },
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Admin", email: "a@b.com", role: "owner", isSystemAdmin: true },
    fetchWithAuth: vi.fn(),
  }),
}));

// Capture useSmokeTest results passed to the panel
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockRetryCheck = vi.fn();

vi.mock(
  "@/app/(dashboard)/system-admin/scraper-health/use-smoke-test",
  () => ({
    useSmokeTest: () => ({
      isRunning: false,
      results: new Map(),
      progress: { completed: 0, total: 0, running: 0 },
      summary: null,
      start: mockStart,
      stop: mockStop,
      retryCheck: mockRetryCheck,
    }),
  })
);

vi.mock("@/lib/platform-display", () => ({
  PLATFORM_LABELS: { shopify: "Shopify", salesforce: "Salesforce" },
  PLATFORM_COLORS: { shopify: "#96BF47", salesforce: "#00A1E0" },
}));

vi.mock("@/lib/format-utils", () => ({
  timeAgo: (d: string) => "2h ago",
}));

vi.mock("@/components/copy-report-button", () => ({
  CopyReportButton: () => null,
}));

vi.mock("@/lib/scraper-report", () => ({
  buildSmokeTestReport: () => "",
}));

import { SmokeTestPanel } from "@/app/(dashboard)/system-admin/scraper-health/smoke-test-panel";

describe("SmokeTestPanel — historical results on load", () => {
  const mockHistory = [
    { platform: "shopify", checkName: "categories", passCount: 9, totalCount: 10, lastRunAt: "2026-04-05T10:00:00Z", lastStatus: "pass", lastDurationMs: 1200, recentErrors: [] },
    { platform: "shopify", checkName: "app", passCount: 8, totalCount: 10, lastRunAt: "2026-04-05T10:00:00Z", lastStatus: "pass", lastDurationMs: 3500, recentErrors: [] },
    { platform: "shopify", checkName: "keyword", passCount: 7, totalCount: 10, lastRunAt: "2026-04-05T10:00:00Z", lastStatus: "fail", lastDurationMs: 5000, recentErrors: [{ error: "timeout", createdAt: "2026-04-05T10:00:00Z", durationMs: 5000 }] },
  ];

  it("renders historical results without requiring a live test run", () => {
    render(<SmokeTestPanel history={mockHistory} />);
    // Panel should be auto-opened with history and show "Last run results"
    expect(screen.getByText("Last run results")).toBeTruthy();
  });

  it("shows pass/fail badges from historical data in the header", () => {
    render(<SmokeTestPanel history={mockHistory} />);
    // Header should show passed/failed counts
    expect(screen.getByText("2 passed")).toBeTruthy();
    expect(screen.getByText("1 failed")).toBeTruthy();
  });

  it("shows empty state when no history", () => {
    render(<SmokeTestPanel history={[]} />);
    // Should show Run button but no "Last run results"
    expect(screen.getByText("Run Smoke Test")).toBeTruthy();
    expect(screen.queryByText("Last run results")).toBeNull();
  });

  it("shows 'last run X ago' label with historical data", () => {
    render(<SmokeTestPanel history={mockHistory} />);
    expect(screen.getByText(/last run/)).toBeTruthy();
  });
});
