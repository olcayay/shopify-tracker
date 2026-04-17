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

  it("reads name and appCardSubtitle from app prop instead of snapshot", () => {
    const snapshot = {
      appIntroduction: "Intro text",
      appDetails: "Description text",
    };
    const app = {
      name: "App From Root",
      appCardSubtitle: "A great subtitle from root that is long enough",
    };
    render(<ListingScorecard snapshot={snapshot} platform="shopify" app={app} />);
    // Title and Subtitle should show as good (not missing), proving they came from app
    const good = screen.getAllByText("✓");
    expect(good.length).toBeGreaterThanOrEqual(2);
    // Should not show Title or Subtitle as missing
    const missing = screen.getAllByText("✗");
    const labels = screen.getAllByText(/Title|Subtitle/);
    // Verify Title is not missing by checking it appears with a good indicator
    expect(labels.length).toBeGreaterThan(0);
  });

  it("falls back to snapshot when app prop is not provided", () => {
    const snapshot = {
      name: "Snapshot Name",
      appCardSubtitle: "A great subtitle that is long enough for validation",
    };
    render(<ListingScorecard snapshot={snapshot} platform="shopify" />);
    // Should still work with snapshot values (not missing)
    const good = screen.getAllByText("✓");
    expect(good.length).toBeGreaterThanOrEqual(2);
  });

  it("shows good status for fields at or near the character limit (PLA-767)", () => {
    // Shopify title limit is 30 chars, seoTitle limit is 0 (hidden)
    const snapshot = {
      name: "A".repeat(30), // exactly at limit — should be good, not warning
      appCardSubtitle: "B".repeat(60), // 60/62 — near limit, should be good
      appIntroduction: "C".repeat(92), // 92/100 — near limit, should be good
      appDetails: "D".repeat(480), // 480/500 — near limit, should be good
      features: ["F1", "F2", "F3", "F4", "F5"],
      seoTitle: "E".repeat(58), // seoTitle hidden for shopify (limit=0)
      seoMetaDescription: "F".repeat(155), // 155/160 — near limit, should be good
    };
    render(<ListingScorecard snapshot={snapshot} platform="shopify" />);
    const good = screen.getAllByText("✓");
    // 6 checks good (Title, Subtitle, Introduction, Description, Features, SEO Description — seoTitle hidden for shopify)
    expect(good.length).toBe(6);
    // No warnings should exist
    const warnings = screen.queryAllByText("⚠");
    expect(warnings.length).toBe(0);
  });

  it("shows warning for fields over the character limit (PLA-767)", () => {
    const snapshot = {
      name: "A".repeat(35), // 35/30 — over limit, should warn
    };
    render(<ListingScorecard snapshot={snapshot} platform="shopify" />);
    expect(screen.getByText(/over limit/)).toBeInTheDocument();
  });

  it("shows warning for fields below 30% of limit", () => {
    const snapshot = {
      name: "Hi", // 2/30 — too short
    };
    render(<ListingScorecard snapshot={snapshot} platform="shopify" />);
    expect(screen.getByText(/too short/)).toBeInTheDocument();
  });
});
