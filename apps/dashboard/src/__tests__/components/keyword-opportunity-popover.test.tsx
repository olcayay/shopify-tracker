import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeywordOpportunityPopover } from "@/components/keyword-opportunity-popover";
import type { KeywordOpportunityMetrics } from "@appranks/shared";

const mockHasFeature = vi.fn((slug: string) => slug === "keyword-score");

vi.mock("@/contexts/feature-flags-context", () => ({
  useFeatureFlag: (slug: string) => mockHasFeature(slug),
}));

const mockMetrics: KeywordOpportunityMetrics = {
  opportunityScore: 65,
  scores: {
    room: 0.8,
    demand: 0.5,
    maturity: 0.7,
    quality: 0.4,
  },
  stats: {
    totalResults: 500,
    bfsCount: 3,
    certifiedCount: 3,
    count1000: 2,
    count100: 5,
    top1Reviews: 5000,
    top4TotalReviews: 12000,
    top4AvgRating: 4.3,
    firstPageTotalReviews: 20000,
    firstPageAvgRating: 4.1,
    top1ReviewShare: 0.25,
    top4ReviewShare: 0.6,
  },
  topApps: [
    {
      slug: "app-1",
      name: "Top App One",
      logoUrl: "https://example.com/logo1.png",
      rating: 4.8,
      reviews: 5000,
      isBuiltForShopify: true,
    },
    {
      slug: "app-2",
      name: "Top App Two",
      logoUrl: "https://example.com/logo2.png",
      rating: 4.5,
      reviews: 3500,
      isBuiltForShopify: false,
    },
  ],
};

describe("KeywordOpportunityPopover", () => {
  beforeEach(() => {
    mockHasFeature.mockImplementation((slug: string) => slug === "keyword-score");
  });

  it("renders the trigger children", () => {
    render(
      <KeywordOpportunityPopover metrics={mockMetrics}>
        <button>View Opportunity</button>
      </KeywordOpportunityPopover>
    );
    expect(screen.getByText("View Opportunity")).toBeInTheDocument();
  });

  it("shows opportunity score in popover", async () => {
    const user = userEvent.setup();
    render(
      <KeywordOpportunityPopover metrics={mockMetrics}>
        <button>View Opportunity</button>
      </KeywordOpportunityPopover>
    );

    await user.click(screen.getByText("View Opportunity"));

    expect(screen.getByText("65")).toBeInTheDocument();
    expect(screen.getByText("Opportunity Score")).toBeInTheDocument();
  });

  it("shows score breakdown bars", async () => {
    const user = userEvent.setup();
    render(
      <KeywordOpportunityPopover metrics={mockMetrics}>
        <button>View Opportunity</button>
      </KeywordOpportunityPopover>
    );

    await user.click(screen.getByText("View Opportunity"));

    expect(screen.getByText("Room")).toBeInTheDocument();
    expect(screen.getByText("Demand")).toBeInTheDocument();
    expect(screen.getByText("Maturity")).toBeInTheDocument();
    expect(screen.getByText("Quality")).toBeInTheDocument();
  });

  it("shows first page analysis stats", async () => {
    const user = userEvent.setup();
    render(
      <KeywordOpportunityPopover metrics={mockMetrics}>
        <button>View Opportunity</button>
      </KeywordOpportunityPopover>
    );

    await user.click(screen.getByText("View Opportunity"));

    expect(screen.getByText("First Page Analysis")).toBeInTheDocument();
    expect(screen.getByText("Total Results")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("shows top apps list", async () => {
    const user = userEvent.setup();
    render(
      <KeywordOpportunityPopover metrics={mockMetrics}>
        <button>View Opportunity</button>
      </KeywordOpportunityPopover>
    );

    await user.click(screen.getByText("View Opportunity"));

    expect(screen.getByText("Top Apps")).toBeInTheDocument();
    expect(screen.getByText("Top App One")).toBeInTheDocument();
    expect(screen.getByText("Top App Two")).toBeInTheDocument();
  });

  it("shows review concentration bars", async () => {
    const user = userEvent.setup();
    render(
      <KeywordOpportunityPopover metrics={mockMetrics}>
        <button>View Opportunity</button>
      </KeywordOpportunityPopover>
    );

    await user.click(screen.getByText("View Opportunity"));

    expect(screen.getByText("Review Concentration")).toBeInTheDocument();
    expect(screen.getByText("Top 1")).toBeInTheDocument();
    expect(screen.getByText("Top 4")).toBeInTheDocument();
    // The 25% and 60% appear in multiple contexts (score bars and concentration),
    // so just verify they are present somewhere
    const allText = document.body.textContent || "";
    expect(allText).toContain("25%");
    expect(allText).toContain("60%");
  });

  it("does not open the popover when the feature flag is disabled", async () => {
    const user = userEvent.setup();
    mockHasFeature.mockReturnValue(false);

    render(
      <KeywordOpportunityPopover metrics={mockMetrics}>
        <button>View Opportunity</button>
      </KeywordOpportunityPopover>
    );

    await user.click(screen.getByText("View Opportunity"));

    expect(screen.queryByText("Opportunity Score")).not.toBeInTheDocument();
  });
});
