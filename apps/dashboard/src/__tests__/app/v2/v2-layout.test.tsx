import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetApp = vi.fn();
const mockGetAppMembership = vi.fn();
const mockGetAppScores = vi.fn();

vi.mock("@/lib/api", () => ({
  getApp: (...args: any[]) => mockGetApp(...args),
  getAppMembership: (...args: any[]) => mockGetAppMembership(...args),
  getAppScores: (...args: any[]) => mockGetAppScores(...args),
}));

vi.mock("@/components/app-icon", () => ({
  AppIcon: ({ src }: any) => <img data-testid="app-icon" src={src} alt="" />,
}));

vi.mock(
  "@/app/(dashboard)/[platform]/apps/[slug]/track-button",
  () => ({
    TrackAppButton: ({ appName }: any) => (
      <button data-testid="track-button">Track {appName}</button>
    ),
  })
);

vi.mock("@/components/competitor-button", () => ({
  CompetitorButton: ({ appName }: any) => (
    <button data-testid="star-button">Star {appName}</button>
  ),
}));

vi.mock("@/components/admin-scraper-trigger", () => ({
  AdminScraperTrigger: () => null,
}));

vi.mock("@/components/v2/score-bar", () => ({
  ScoreBar: ({ label, score }: any) => (
    <div data-testid={`score-bar-${label.toLowerCase()}`}>{label}: {score ?? "—"}</div>
  ),
}));

vi.mock("@/components/v2/v2-nav", () => ({
  V2Nav: ({ slug, isTracked }: any) => (
    <nav data-testid="v2-nav">{slug} tracked={String(isTracked)}</nav>
  ),
}));

vi.mock("@/lib/platform-urls", () => ({
  buildExternalAppUrl: (p: string, slug: string) => `https://example.com/${p}/apps/${slug}`,
  getPlatformName: (p: string) => p.charAt(0).toUpperCase() + p.slice(1),
}));

import V2AppDetailLayout from "@/app/(dashboard)/[platform]/apps/v2/[slug]/layout";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

function setupMocks(overrides: Record<string, any> = {}) {
  mockGetApp.mockResolvedValue({
    slug: "test-app",
    name: "Test App",
    iconUrl: "https://example.com/icon.png",
    isTrackedByAccount: true,
    isBuiltForShopify: false,
    isCompetitor: false,
    competitorForApps: [],
    latestSnapshot: {
      averageRating: 4.5,
      ratingCount: 100,
      pricingPlans: [{ price: 9.99, period: "mo", name: "Basic" }],
      developer: { name: "Dev Co" },
    },
    ...overrides,
  });
  mockGetAppMembership.mockResolvedValue({});
  mockGetAppScores.mockResolvedValue({
    visibility: [{ visibilityScore: 72 }],
    power: [],
    weightedPowerScore: 55,
  });
}

describe("V2AppDetailLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders app name", async () => {
    setupMocks();
    await renderAsync(V2AppDetailLayout({ params, children: <div>Child</div> }));
    expect(screen.getByText("Test App")).toBeInTheDocument();
  });

  it("renders children content", async () => {
    setupMocks();
    await renderAsync(V2AppDetailLayout({ params, children: <div>Child Content</div> }));
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("shows App not found on API error", async () => {
    mockGetApp.mockRejectedValue(new Error("fail"));
    await renderAsync(V2AppDetailLayout({ params, children: <div>Child</div> }));
    expect(screen.getByText("App not found.")).toBeInTheDocument();
  });

  it("renders track and star buttons", async () => {
    setupMocks();
    await renderAsync(V2AppDetailLayout({ params, children: <div /> }));
    expect(screen.getByTestId("track-button")).toBeInTheDocument();
    expect(screen.getByTestId("star-button")).toBeInTheDocument();
  });

  it("renders score bars with computed scores", async () => {
    setupMocks();
    await renderAsync(V2AppDetailLayout({ params, children: <div /> }));
    expect(screen.getByTestId("score-bar-visibility")).toHaveTextContent("Visibility: 72");
    expect(screen.getByTestId("score-bar-power")).toHaveTextContent("Power: 55");
  });

  it("renders V2Nav with correct props", async () => {
    setupMocks();
    await renderAsync(V2AppDetailLayout({ params, children: <div /> }));
    const nav = screen.getByTestId("v2-nav");
    expect(nav).toHaveTextContent("test-app tracked=true");
  });

  it("shows developer name", async () => {
    setupMocks();
    await renderAsync(V2AppDetailLayout({ params, children: <div /> }));
    expect(screen.getByText("Dev Co")).toBeInTheDocument();
  });
});
