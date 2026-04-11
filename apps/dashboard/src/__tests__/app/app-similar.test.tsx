import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock @/lib/api before importing the page
const mockGetAppSimilarApps = vi.fn();
const mockGetAccountTrackedApps = vi.fn();
const mockGetAccountCompetitors = vi.fn();
const mockHasServerFeature = vi.fn((slug: string) => slug === "app-similarity");

vi.mock("@/lib/api", () => ({
  getEnabledFeatures: vi.fn().mockResolvedValue([]),
  getAppSimilarApps: (...args: any[]) => mockGetAppSimilarApps(...args),
  getAccountTrackedApps: (...args: any[]) => mockGetAccountTrackedApps(...args),
  getAccountCompetitors: (...args: any[]) => mockGetAccountCompetitors(...args),
}));

vi.mock("@/lib/score-features-server", () => ({
  hasServerFeature: (slug: string) => mockHasServerFeature(slug),
}));

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
  };
});

// Mock AdHeatmap since it's a complex client component
vi.mock("@/components/ad-heatmap", () => ({
  AdHeatmap: ({ sightings }: { sightings: any[] }) => (
    <div data-testid="ad-heatmap">
      {sightings.map((s: any) => (
        <span key={`${s.slug}-${s.seenDate}`}>{s.name}</span>
      ))}
    </div>
  ),
}));

import SimilarAppsPage from "@/app/(dashboard)/[platform]/apps/[slug]/similar/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

describe("SimilarAppsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasServerFeature.mockImplementation((slug: string) => slug === "app-similarity");
    mockGetAccountTrackedApps.mockResolvedValue([]);
    mockGetAccountCompetitors.mockResolvedValue([]);
  });

  const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

  it("renders empty state when no similar apps data", async () => {
    mockGetAppSimilarApps.mockResolvedValue({});
    await renderAsync(SimilarAppsPage({ params }));
    expect(
      screen.getByText(/No similar app data yet/)
    ).toBeInTheDocument();
  });

  it("calls getAppSimilarApps with correct slug and platform", async () => {
    mockGetAppSimilarApps.mockResolvedValue({});
    await renderAsync(SimilarAppsPage({ params }));
    expect(mockGetAppSimilarApps).toHaveBeenCalledWith(
      "test-app",
      30,
      "shopify"
    );
  });

  it("renders Similar Apps section when direct sightings exist", async () => {
    mockGetAppSimilarApps.mockResolvedValue({
      direct: [
        {
          slug: "app-a",
          name: "App A",
          seenDate: "2026-03-01",
          timesSeenInDay: 1,
          iconUrl: null,
        },
      ],
      reverse: [],
      secondDegree: [],
    });
    await renderAsync(SimilarAppsPage({ params }));
    expect(screen.getByText("Similar Apps")).toBeInTheDocument();
    expect(screen.getByText("App A")).toBeInTheDocument();
  });

  it("renders Reverse Similar section when reverse sightings exist", async () => {
    mockGetAppSimilarApps.mockResolvedValue({
      direct: [],
      reverse: [
        {
          slug: "app-b",
          name: "App B",
          seenDate: "2026-03-01",
          timesSeenInDay: 2,
          iconUrl: null,
        },
      ],
      secondDegree: [],
    });
    await renderAsync(SimilarAppsPage({ params }));
    expect(screen.getByText("Reverse Similar")).toBeInTheDocument();
    expect(screen.getByText("App B")).toBeInTheDocument();
  });

  it("renders 2nd Degree Similar section when secondDegree sightings exist", async () => {
    mockGetAppSimilarApps.mockResolvedValue({
      direct: [],
      reverse: [],
      secondDegree: [
        {
          slug: "app-c",
          name: "App C",
          seenDate: "2026-03-02",
          timesSeenInDay: 1,
          iconUrl: null,
        },
      ],
    });
    await renderAsync(SimilarAppsPage({ params }));
    expect(screen.getByText("2nd Degree Similar")).toBeInTheDocument();
    expect(screen.getByText("App C")).toBeInTheDocument();
  });

  it("handles API error gracefully", async () => {
    mockGetAppSimilarApps.mockRejectedValue(new Error("API error"));
    await renderAsync(SimilarAppsPage({ params }));
    expect(
      screen.getByText(/No similar app data yet/)
    ).toBeInTheDocument();
  });

  it("renders all three sections when all data present", async () => {
    mockGetAppSimilarApps.mockResolvedValue({
      direct: [
        {
          slug: "app-a",
          name: "App A",
          seenDate: "2026-03-01",
          timesSeenInDay: 1,
        },
      ],
      reverse: [
        {
          slug: "app-b",
          name: "App B",
          seenDate: "2026-03-01",
          timesSeenInDay: 1,
        },
      ],
      secondDegree: [
        {
          slug: "app-c",
          name: "App C",
          seenDate: "2026-03-01",
          timesSeenInDay: 1,
        },
      ],
    });
    await renderAsync(SimilarAppsPage({ params }));
    expect(screen.getByText("Similar Apps")).toBeInTheDocument();
    expect(screen.getByText("Reverse Similar")).toBeInTheDocument();
    expect(screen.getByText("2nd Degree Similar")).toBeInTheDocument();
  });

  it("throws notFound when app-similarity is disabled", async () => {
    mockHasServerFeature.mockReturnValue(false);
    await expect(SimilarAppsPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
