import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetAppSimilarApps = vi.fn();
const mockGetAccountTrackedApps = vi.fn();
const mockGetAccountCompetitors = vi.fn();

vi.mock("@/lib/api", () => ({
  getEnabledFeatures: vi.fn().mockResolvedValue([]),
  getAppSimilarApps: (...args: any[]) => mockGetAppSimilarApps(...args),
  getAccountTrackedApps: (...args: any[]) => mockGetAccountTrackedApps(...args),
  getAccountCompetitors: (...args: any[]) => mockGetAccountCompetitors(...args),
}));

vi.mock("@/components/ad-heatmap", () => ({
  AdHeatmap: ({ sightings }: any) => (
    <div data-testid="ad-heatmap">{sightings.length} entries</div>
  ),
}));

import V2SimilarAppsPage from "@/app/(dashboard)/[platform]/apps/v2/[slug]/intel/similar/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

describe("V2SimilarAppsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccountTrackedApps.mockResolvedValue([]);
    mockGetAccountCompetitors.mockResolvedValue([]);
  });

  it("shows empty message when no similar apps data", async () => {
    mockGetAppSimilarApps.mockResolvedValue({});
    await renderAsync(V2SimilarAppsPage({ params }));
    expect(screen.getByText(/No similar app data yet/)).toBeInTheDocument();
  });

  it("renders 'Apps like yours' card when direct data exists", async () => {
    mockGetAppSimilarApps.mockResolvedValue({
      direct: [{ slug: "app-1", name: "App 1", seenDate: "2026-03-01", timesSeenInDay: 1 }],
      reverse: [],
    });
    await renderAsync(V2SimilarAppsPage({ params }));
    expect(screen.getByText("Apps like yours")).toBeInTheDocument();
  });

  it("renders 'Apps that consider you similar' when reverse data exists", async () => {
    mockGetAppSimilarApps.mockResolvedValue({
      direct: [],
      reverse: [{ slug: "app-2", name: "App 2", seenDate: "2026-03-01", timesSeenInDay: 1 }],
    });
    await renderAsync(V2SimilarAppsPage({ params }));
    expect(screen.getByText("Apps that consider you similar")).toBeInTheDocument();
  });

  it("renders 'Extended network' when secondDegree data exists", async () => {
    mockGetAppSimilarApps.mockResolvedValue({
      direct: [],
      reverse: [],
      secondDegree: [{ slug: "app-3", name: "App 3", seenDate: "2026-03-01", timesSeenInDay: 1 }],
    });
    await renderAsync(V2SimilarAppsPage({ params }));
    expect(screen.getByText("Extended network")).toBeInTheDocument();
  });

  it("renders ad heatmap component for direct data", async () => {
    mockGetAppSimilarApps.mockResolvedValue({
      direct: [{ slug: "app-1", name: "App 1", seenDate: "2026-03-01", timesSeenInDay: 1 }],
      reverse: [],
    });
    await renderAsync(V2SimilarAppsPage({ params }));
    expect(screen.getByTestId("ad-heatmap")).toBeInTheDocument();
    expect(screen.getByText("1 entries")).toBeInTheDocument();
  });

  it("handles API errors gracefully", async () => {
    mockGetAppSimilarApps.mockRejectedValue(new Error("fail"));
    await renderAsync(V2SimilarAppsPage({ params }));
    expect(screen.getByText(/No similar app data yet/)).toBeInTheDocument();
  });
});
