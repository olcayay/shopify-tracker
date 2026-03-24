import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupAuthMock } from "../test-utils";

const mockPlatformCounts = {
  apps: [
    { platform: "shopify", total: 100, tracked: 5, scraped: 80 },
    { platform: "salesforce", total: 50, tracked: 3, scraped: 40 },
  ],
  keywords: [
    { platform: "shopify", total: 200, active: 150 },
    { platform: "salesforce", total: 100, active: 75 },
  ],
  categories: [
    { platform: "shopify", total: 12 },
    { platform: "salesforce", total: 8 },
  ],
};

describe("PlatformOverviewCards", () => {
  beforeEach(() => {
    vi.resetModules();
    const mockFetchWithAuth = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPlatformCounts),
    });
    setupAuthMock({ fetchWithAuth: mockFetchWithAuth });
  });

  async function renderComponent(overrides: Record<string, unknown> = {}) {
    const { PlatformOverviewCards } = await import(
      "@/components/platform-overview-cards"
    );
    return render(
      <PlatformOverviewCards
        type="apps"
        activePlatform=""
        onSelect={vi.fn()}
        {...overrides}
      />
    );
  }

  it("renders platform cards with labels", async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Shopify")).toBeInTheDocument();
      expect(screen.getByText("Salesforce")).toBeInTheDocument();
    });
  });

  it("shows app counts for apps type", async () => {
    await renderComponent({ type: "apps" });
    await waitFor(() => {
      expect(screen.getByText("5 tracked")).toBeInTheDocument();
      expect(screen.getByText("100 total")).toBeInTheDocument();
    });
  });

  it("shows keyword counts for keywords type", async () => {
    await renderComponent({ type: "keywords" });
    await waitFor(() => {
      expect(screen.getByText("150 active")).toBeInTheDocument();
      expect(screen.getByText("200 total")).toBeInTheDocument();
    });
  });

  it("shows category counts for categories type", async () => {
    await renderComponent({ type: "categories" });
    await waitFor(() => {
      expect(screen.getByText("12 categories")).toBeInTheDocument();
    });
  });

  it("calls onSelect when a card is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    await renderComponent({ onSelect });

    await waitFor(() => {
      expect(screen.getByText("Shopify")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Shopify"));
    expect(onSelect).toHaveBeenCalledWith("shopify");
  });

  it("renders skeleton loading state initially", async () => {
    vi.resetModules();
    // Return a never-resolving promise to keep loading state
    const neverResolve = vi.fn().mockReturnValue(new Promise(() => {}));
    setupAuthMock({ fetchWithAuth: neverResolve });

    const { PlatformOverviewCards } = await import(
      "@/components/platform-overview-cards"
    );
    const { container } = render(
      <PlatformOverviewCards type="apps" activePlatform="" onSelect={vi.fn()} />
    );

    // Skeleton components should be rendered
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
