import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetApp = vi.fn();

vi.mock("@/lib/api", () => ({
  getApp: (...args: any[]) => mockGetApp(...args),
}));

vi.mock("@/components/v2/listing-scorecard", () => ({
  ListingScorecard: ({ platform, app }: any) => (
    <div data-testid="listing-scorecard">Scorecard for {app?.name} on {platform}</div>
  ),
}));

import V2StudioPage from "@/app/(dashboard)/[platform]/apps/v2/[slug]/studio/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

describe("V2StudioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders scorecard when tracked", async () => {
    mockGetApp.mockResolvedValue({
      slug: "test-app",
      name: "Test App",
      isTrackedByAccount: true,
      latestSnapshot: { appDetails: "A description", features: [] },
    });
    await renderAsync(V2StudioPage({ params }));
    expect(screen.getByTestId("listing-scorecard")).toBeInTheDocument();
  });

  it("shows Description card with snapshot content", async () => {
    mockGetApp.mockResolvedValue({
      slug: "test-app",
      name: "Test App",
      isTrackedByAccount: true,
      latestSnapshot: { appDetails: "My app description here", features: [] },
    });
    await renderAsync(V2StudioPage({ params }));
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("My app description here")).toBeInTheDocument();
  });

  it("shows Features card", async () => {
    mockGetApp.mockResolvedValue({
      slug: "test-app",
      name: "Test App",
      isTrackedByAccount: true,
      latestSnapshot: { appDetails: "desc", features: ["Feature A", "Feature B"] },
    });
    await renderAsync(V2StudioPage({ params }));
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("Feature A")).toBeInTheDocument();
    expect(screen.getByText("Feature B")).toBeInTheDocument();
  });

  it("shows SEO & Metadata card", async () => {
    mockGetApp.mockResolvedValue({
      slug: "test-app",
      name: "Test App",
      isTrackedByAccount: true,
      latestSnapshot: { appDetails: "desc", seoTitle: "SEO Title Here", seoMetaDescription: "Meta desc" },
    });
    await renderAsync(V2StudioPage({ params }));
    expect(screen.getByText("SEO & Metadata")).toBeInTheDocument();
    expect(screen.getByText("SEO Title Here")).toBeInTheDocument();
  });

  it("shows lock message when not tracked", async () => {
    mockGetApp.mockResolvedValue({ slug: "test-app", name: "Test App", isTrackedByAccount: false });
    await renderAsync(V2StudioPage({ params }));
    expect(screen.getByText("Track this app to unlock Listing Studio")).toBeInTheDocument();
  });

  it("shows 'App not found.' on API error", async () => {
    mockGetApp.mockRejectedValue(new Error("fail"));
    await renderAsync(V2StudioPage({ params }));
    expect(screen.getByText("App not found.")).toBeInTheDocument();
  });

  it("shows 'No features listed.' when no features", async () => {
    mockGetApp.mockResolvedValue({
      slug: "test-app",
      name: "Test App",
      isTrackedByAccount: true,
      latestSnapshot: { appDetails: "desc" },
    });
    await renderAsync(V2StudioPage({ params }));
    expect(screen.getByText("No features listed.")).toBeInTheDocument();
  });
});
