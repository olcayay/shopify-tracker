import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetApp = vi.fn();

vi.mock("@/lib/api", () => ({
  getApp: (...args: any[]) => mockGetApp(...args),
}));

vi.mock(
  "@/app/(dashboard)/[platform]/apps/[slug]/keywords-section",
  () => ({
    KeywordsSection: ({ appSlug }: { appSlug: string }) => (
      <div data-testid="keywords-section">Keywords for {appSlug}</div>
    ),
  })
);

import V2KeywordsPage from "@/app/(dashboard)/[platform]/apps/v2/[slug]/visibility/keywords/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

describe("V2KeywordsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders KeywordsSection when app is tracked", async () => {
    mockGetApp.mockResolvedValue({ slug: "test-app", name: "Test App", isTrackedByAccount: true });
    await renderAsync(V2KeywordsPage({ params }));
    expect(screen.getByTestId("keywords-section")).toBeInTheDocument();
    expect(screen.getByText("Keywords for test-app")).toBeInTheDocument();
  });

  it("shows lock message when app is not tracked", async () => {
    mockGetApp.mockResolvedValue({ slug: "test-app", name: "Test App", isTrackedByAccount: false });
    await renderAsync(V2KeywordsPage({ params }));
    expect(screen.getByText("Track this app to unlock keywords")).toBeInTheDocument();
  });

  it("shows optimization description when not tracked", async () => {
    mockGetApp.mockResolvedValue({ slug: "test-app", name: "Test App", isTrackedByAccount: false });
    await renderAsync(V2KeywordsPage({ params }));
    expect(screen.getByText(/Keyword tracking lets you monitor/)).toBeInTheDocument();
  });

  it("shows 'App not found.' on API error", async () => {
    mockGetApp.mockRejectedValue(new Error("fail"));
    await renderAsync(V2KeywordsPage({ params }));
    expect(screen.getByText("App not found.")).toBeInTheDocument();
  });

  it("calls getApp with correct platform and slug", async () => {
    mockGetApp.mockResolvedValue({ slug: "test-app", name: "Test App", isTrackedByAccount: true });
    await renderAsync(V2KeywordsPage({ params }));
    expect(mockGetApp).toHaveBeenCalledWith("test-app", "shopify");
  });

  it("handles different platform params", async () => {
    mockGetApp.mockResolvedValue({ slug: "sf-app", name: "SF App", isTrackedByAccount: true });
    const sfParams = Promise.resolve({ platform: "salesforce", slug: "sf-app" });
    await renderAsync(V2KeywordsPage({ params: sfParams }));
    expect(mockGetApp).toHaveBeenCalledWith("sf-app", "salesforce");
    expect(screen.getByText("Keywords for sf-app")).toBeInTheDocument();
  });
});
