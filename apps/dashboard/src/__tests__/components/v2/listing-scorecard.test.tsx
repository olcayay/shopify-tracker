import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListingScorecard } from "@/components/v2/listing-scorecard";

describe("ListingScorecard", () => {
  it("renders completeness percentage", () => {
    const snapshot = {
      name: "My App",
      appCardSubtitle: "A great app",
      appIntroduction: "Introduction text here",
      appDetails: "Detailed description of the app that is long enough",
      features: ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
      seoTitle: "My App - SEO Title",
      seoMetaDescription: "This is the SEO meta description for the app",
    };
    render(<ListingScorecard snapshot={snapshot} platform="shopify" />);
    expect(screen.getByText("Listing Completeness:")).toBeInTheDocument();
    expect(screen.getByText(/\d+%/)).toBeInTheDocument();
  });

  it("shows missing status for empty fields", () => {
    const snapshot = { name: "My App" };
    render(<ListingScorecard snapshot={snapshot} platform="shopify" />);
    // Should have some missing indicators
    const missing = screen.getAllByText("✗");
    expect(missing.length).toBeGreaterThan(0);
  });

  it("shows good status for populated fields", () => {
    const snapshot = {
      name: "My App",
      appCardSubtitle: "A great subtitle for my app",
      appIntroduction: "This is a good introduction text for the app",
      appDetails: "This is a detailed description that covers all the features",
      features: ["F1", "F2", "F3", "F4", "F5"],
      seoTitle: "SEO Title Here",
      seoMetaDescription: "SEO description that is long enough to be considered good",
    };
    render(<ListingScorecard snapshot={snapshot} platform="shopify" />);
    const good = screen.getAllByText("✓");
    expect(good.length).toBeGreaterThan(0);
  });

  it("handles null snapshot", () => {
    render(<ListingScorecard snapshot={null} platform="shopify" />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("adapts to different platforms", () => {
    const snapshot = { name: "App" };
    render(<ListingScorecard snapshot={snapshot} platform="canva" />);
    // Canva has different limits, should still render
    expect(screen.getByText("Listing Completeness:")).toBeInTheDocument();
  });
});
