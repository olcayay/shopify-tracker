import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetApp = vi.fn();
const mockGetAppCompetitors = vi.fn();
const mockGetAppSimilarApps = vi.fn();
const mockGetAppReviews = vi.fn();
const mockGetAppChanges = vi.fn();

vi.mock("@/lib/api", () => ({
  getApp: (...args: any[]) => mockGetApp(...args),
  getAppCompetitors: (...args: any[]) => mockGetAppCompetitors(...args),
  getAppSimilarApps: (...args: any[]) => mockGetAppSimilarApps(...args),
  getAppReviews: (...args: any[]) => mockGetAppReviews(...args),
  getAppChanges: (...args: any[]) => mockGetAppChanges(...args),
}));

import IntelOverviewPage from "@/app/(dashboard)/[platform]/apps/v2/[slug]/intel/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

function setupMocks(overrides: Record<string, any> = {}) {
  mockGetApp.mockResolvedValue({
    slug: "test-app",
    name: "Test App",
    isTrackedByAccount: true,
    ...overrides,
  });
  mockGetAppCompetitors.mockResolvedValue([{ slug: "comp-1", name: "Comp 1" }]);
  mockGetAppSimilarApps.mockResolvedValue({ direct: [], reverse: [] });
  mockGetAppReviews.mockResolvedValue({ reviews: [], total: 42, distribution: [] });
  mockGetAppChanges.mockResolvedValue([{ field: "name", detectedAt: "2026-03-01" }]);
}

describe("IntelOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Competitors card", async () => {
    setupMocks();
    await renderAsync(IntelOverviewPage({ params }));
    expect(screen.getByText("Competitors")).toBeInTheDocument();
  });

  it("shows competitor count when tracked", async () => {
    setupMocks();
    await renderAsync(IntelOverviewPage({ params }));
    expect(screen.getByText("competitors tracked")).toBeInTheDocument();
    // The competitors count "1" appears alongside the text
    const competitorsCard = screen.getByText("competitors tracked").closest("[data-slot='card-content']");
    expect(competitorsCard).toBeInTheDocument();
  });

  it("shows lock message when not tracked", async () => {
    setupMocks({ isTrackedByAccount: false });
    await renderAsync(IntelOverviewPage({ params }));
    expect(screen.getByText("Track to unlock")).toBeInTheDocument();
  });

  it("shows Reviews card with total", async () => {
    setupMocks();
    await renderAsync(IntelOverviewPage({ params }));
    expect(screen.getByText("Reviews")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("total reviews")).toBeInTheDocument();
  });

  it("shows Recent Changes card", async () => {
    setupMocks();
    await renderAsync(IntelOverviewPage({ params }));
    expect(screen.getByText("Recent Changes")).toBeInTheDocument();
    expect(screen.getByText("changes detected")).toBeInTheDocument();
  });

  it("shows error message on complete API failure", async () => {
    mockGetApp.mockRejectedValue(new Error("fail"));
    await renderAsync(IntelOverviewPage({ params }));
    expect(screen.getByText("Failed to load market intel.")).toBeInTheDocument();
  });

  it("renders navigation links to sub-pages", async () => {
    setupMocks();
    await renderAsync(IntelOverviewPage({ params }));
    expect(screen.getByText("View competitors")).toBeInTheDocument();
    expect(screen.getByText("View reviews")).toBeInTheDocument();
    expect(screen.getByText("View change log")).toBeInTheDocument();
  });
});
