import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock @/lib/api before importing the page
const mockGetAppChanges = vi.fn();
vi.mock("@/lib/api", () => ({
  getAppChanges: (...args: any[]) => mockGetAppChanges(...args),
}));

vi.mock("@/lib/format-date", () => ({
  formatDateOnly: (d: string) => d,
}));

vi.mock("@/lib/pricing-diff", () => ({
  formatPlanPrice: (plan: any) => plan.price || "$0/mo",
  diffPricingPlans: (oldPlans: any[], newPlans: any[]) => ({
    added: newPlans.filter(
      (n: any) => !oldPlans.some((o: any) => o.name === n.name)
    ),
    removed: oldPlans.filter(
      (n: any) => !newPlans.some((o: any) => o.name === n.name)
    ),
    modified: [],
  }),
}));

import ChangesPage from "@/app/(dashboard)/[platform]/apps/[slug]/changes/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

describe("ChangesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

  it("renders empty state when no changes", async () => {
    mockGetAppChanges.mockResolvedValue([]);
    await renderAsync(ChangesPage({ params }));
    expect(
      screen.getByText("No listing changes detected yet.")
    ).toBeInTheDocument();
  });

  it("calls getAppChanges with correct slug and platform", async () => {
    mockGetAppChanges.mockResolvedValue([]);
    await renderAsync(ChangesPage({ params }));
    expect(mockGetAppChanges).toHaveBeenCalledWith("test-app", 50, "shopify");
  });

  it("renders card title with change count", async () => {
    mockGetAppChanges.mockResolvedValue([
      {
        id: "c1",
        field: "name",
        oldValue: "Old Name",
        newValue: "New Name",
        detectedAt: "2026-03-01",
      },
    ]);
    await renderAsync(ChangesPage({ params }));
    expect(screen.getByText("Listing Changes (1)")).toBeInTheDocument();
  });

  it("renders field label badge for name changes", async () => {
    mockGetAppChanges.mockResolvedValue([
      {
        id: "c1",
        field: "name",
        oldValue: "Old Name",
        newValue: "New Name",
        detectedAt: "2026-03-01",
      },
    ]);
    await renderAsync(ChangesPage({ params }));
    expect(screen.getByText("App Name")).toBeInTheDocument();
  });

  it("renders old and new values for text changes", async () => {
    mockGetAppChanges.mockResolvedValue([
      {
        id: "c1",
        field: "name",
        oldValue: "Old Name",
        newValue: "New Name",
        detectedAt: "2026-03-01",
      },
    ]);
    await renderAsync(ChangesPage({ params }));
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
    expect(screen.getByText("Old Name")).toBeInTheDocument();
    expect(screen.getByText("New Name")).toBeInTheDocument();
  });

  it("renders feature changes with added and removed", async () => {
    mockGetAppChanges.mockResolvedValue([
      {
        id: "c2",
        field: "features",
        oldValue: JSON.stringify(["Feature A", "Feature B"]),
        newValue: JSON.stringify(["Feature A", "Feature C"]),
        detectedAt: "2026-03-02",
      },
    ]);
    await renderAsync(ChangesPage({ params }));
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("- Feature B")).toBeInTheDocument();
    expect(screen.getByText("+ Feature C")).toBeInTheDocument();
  });

  it("renders pricing plan changes", async () => {
    mockGetAppChanges.mockResolvedValue([
      {
        id: "c3",
        field: "pricingPlans",
        oldValue: JSON.stringify([
          { name: "Basic", price: "$10/mo", features: [] },
        ]),
        newValue: JSON.stringify([
          { name: "Pro", price: "$20/mo", features: ["Fast support"] },
        ]),
        detectedAt: "2026-03-03",
      },
    ]);
    await renderAsync(ChangesPage({ params }));
    expect(screen.getByText("Pricing Plans")).toBeInTheDocument();
    expect(screen.getByText(/- Basic/)).toBeInTheDocument();
    expect(screen.getByText(/\+ Pro/)).toBeInTheDocument();
  });

  it("handles API error gracefully", async () => {
    mockGetAppChanges.mockRejectedValue(new Error("API error"));
    await renderAsync(ChangesPage({ params }));
    expect(
      screen.getByText("No listing changes detected yet.")
    ).toBeInTheDocument();
  });

  it("renders date for each change", async () => {
    mockGetAppChanges.mockResolvedValue([
      {
        id: "c1",
        field: "name",
        oldValue: "Old",
        newValue: "New",
        detectedAt: "2026-03-15",
      },
    ]);
    await renderAsync(ChangesPage({ params }));
    expect(screen.getByText("2026-03-15")).toBeInTheDocument();
  });

  it("uses platform-specific label for canva appIntroduction", async () => {
    const canvaParams = Promise.resolve({
      platform: "canva",
      slug: "test-app",
    });
    mockGetAppChanges.mockResolvedValue([
      {
        id: "c1",
        field: "appIntroduction",
        oldValue: "Old intro",
        newValue: "New intro",
        detectedAt: "2026-03-01",
      },
    ]);
    await renderAsync(ChangesPage({ params: canvaParams }));
    expect(screen.getByText("Short Description")).toBeInTheDocument();
  });
});
