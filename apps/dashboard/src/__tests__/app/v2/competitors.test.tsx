import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetApp = vi.fn();

vi.mock("@/lib/api", () => ({
  getEnabledFeatures: vi.fn().mockResolvedValue([]),
  getApp: (...args: any[]) => mockGetApp(...args),
}));

vi.mock(
  "@/app/(dashboard)/[platform]/apps/[slug]/competitors-section",
  () => ({
    CompetitorsSection: ({ appSlug }: { appSlug: string }) => (
      <div data-testid="competitors-section">Competitors for {appSlug}</div>
    ),
  })
);

import V2CompetitorsPage from "@/app/(dashboard)/[platform]/apps/v2/[slug]/intel/competitors/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

describe("V2CompetitorsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders CompetitorsSection when tracked", async () => {
    mockGetApp.mockResolvedValue({ slug: "test-app", name: "Test App", isTrackedByAccount: true });
    await renderAsync(V2CompetitorsPage({ params }));
    expect(screen.getByTestId("competitors-section")).toBeInTheDocument();
    expect(screen.getByText("Competitors for test-app")).toBeInTheDocument();
  });

  it("shows lock message when not tracked", async () => {
    mockGetApp.mockResolvedValue({ slug: "test-app", name: "Test App", isTrackedByAccount: false });
    await renderAsync(V2CompetitorsPage({ params }));
    expect(screen.getByText("Track this app to unlock competitor analysis")).toBeInTheDocument();
  });

  it("shows description when not tracked", async () => {
    mockGetApp.mockResolvedValue({ slug: "test-app", name: "Test App", isTrackedByAccount: false });
    await renderAsync(V2CompetitorsPage({ params }));
    expect(screen.getByText(/Add competitors to compare ratings/)).toBeInTheDocument();
  });

  it("shows 'App not found.' on API error", async () => {
    mockGetApp.mockRejectedValue(new Error("fail"));
    await renderAsync(V2CompetitorsPage({ params }));
    expect(screen.getByText("App not found.")).toBeInTheDocument();
  });

  it("calls getApp with correct params", async () => {
    mockGetApp.mockResolvedValue({ slug: "test-app", name: "Test App", isTrackedByAccount: true });
    await renderAsync(V2CompetitorsPage({ params }));
    expect(mockGetApp).toHaveBeenCalledWith("test-app", "shopify");
  });

  it("handles salesforce platform param", async () => {
    mockGetApp.mockResolvedValue({ slug: "sf-app", name: "SF App", isTrackedByAccount: true });
    const sfParams = Promise.resolve({ platform: "salesforce", slug: "sf-app" });
    await renderAsync(V2CompetitorsPage({ params: sfParams }));
    expect(mockGetApp).toHaveBeenCalledWith("sf-app", "salesforce");
  });
});
