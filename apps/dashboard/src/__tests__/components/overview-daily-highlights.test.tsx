import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { DailyHighlights, selectHighlights } from "@/components/overview-daily-highlights";

const emptyHighlights = {
  keywordMovers: [],
  categoryMovers: [],
  reviewPulse: [],
  recentChanges: [],
  featuredSightings: [],
  competitorAlerts: [],
  adActivity: [],
};

const appRef = (name: string, slug: string) => ({
  slug,
  name,
  platform: "shopify",
  iconUrl: null,
});

describe("selectHighlights", () => {
  it("returns empty array when no highlight data", () => {
    const result = selectHighlights(emptyHighlights, "shopify");
    expect(result).toEqual([]);
  });

  it("prioritizes by score (bigger movers first)", () => {
    const highlights = {
      ...emptyHighlights,
      keywordMovers: [
        { app: appRef("App A", "app-a"), keyword: "test", oldPosition: 10, newPosition: 8, delta: 2 },
        { app: appRef("App B", "app-b"), keyword: "demo", oldPosition: 20, newPosition: 5, delta: 15 },
      ],
    };
    const result = selectHighlights(highlights, "shopify");
    // App B has bigger delta (15) so should come first
    expect(result[0].detail).toContain("App B");
    expect(result[1].detail).toContain("App A");
  });

  it("deduplicates by app slug (one highlight per app)", () => {
    const highlights = {
      ...emptyHighlights,
      keywordMovers: [
        { app: appRef("App A", "app-a"), keyword: "test", oldPosition: 10, newPosition: 5, delta: 5 },
      ],
      reviewPulse: [
        { app: appRef("App A", "app-a"), v7d: 10, v30d: 30, momentum: "stable", latestRating: 4.0 },
      ],
    };
    const result = selectHighlights(highlights, "shopify");
    // Only 1 card for App A (the higher scored one)
    expect(result).toHaveLength(1);
    expect(result[0].detail).toContain("App A");
  });

  it("limits to maxCards", () => {
    const highlights = {
      ...emptyHighlights,
      keywordMovers: [
        { app: appRef("App A", "app-a"), keyword: "k1", oldPosition: 10, newPosition: 5, delta: 5 },
        { app: appRef("App B", "app-b"), keyword: "k2", oldPosition: 20, newPosition: 10, delta: 10 },
        { app: appRef("App C", "app-c"), keyword: "k3", oldPosition: 15, newPosition: 8, delta: 7 },
        { app: appRef("App D", "app-d"), keyword: "k4", oldPosition: 5, newPosition: 1, delta: 4 },
      ],
    };
    const result = selectHighlights(highlights, "shopify", 2);
    expect(result).toHaveLength(2);
  });

  it("generates correct links with platform prefix", () => {
    const highlights = {
      ...emptyHighlights,
      featuredSightings: [
        { app: appRef("App A", "app-a"), sectionTitle: "Staff Picks", position: 2, seenDate: "2026-03-30" },
      ],
    };
    const result = selectHighlights(highlights, "salesforce");
    expect(result[0].href).toBe("/salesforce/apps/app-a/featured");
  });

  it("marks positive movers as green, negative as red", () => {
    const highlights = {
      ...emptyHighlights,
      keywordMovers: [
        { app: appRef("Up", "up"), keyword: "kw", oldPosition: 10, newPosition: 5, delta: 5 },
        { app: appRef("Down", "down"), keyword: "kw2", oldPosition: 5, newPosition: 10, delta: -5 },
      ],
    };
    const result = selectHighlights(highlights, "shopify");
    const up = result.find((c) => c.detail.includes("Up"));
    const down = result.find((c) => c.detail.includes("Down"));
    expect(up?.color).toContain("green");
    expect(down?.color).toContain("red");
  });
});

describe("DailyHighlights component", () => {
  it("renders 'No activity' when no highlights", () => {
    render(<DailyHighlights highlights={emptyHighlights} platformId="shopify" />);
    expect(screen.getByText("No activity in the last 24h")).toBeInTheDocument();
  });

  it("renders highlight cards when data available", () => {
    const highlights = {
      ...emptyHighlights,
      keywordMovers: [
        { app: appRef("My App", "my-app"), keyword: "form builder", oldPosition: 10, newPosition: 3, delta: 7 },
      ],
    };
    render(<DailyHighlights highlights={highlights} platformId="shopify" />);
    expect(screen.getByText("Biggest Mover")).toBeInTheDocument();
    expect(screen.getByText(/My App jumped #10 → #3/)).toBeInTheDocument();
    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
  });

  it("renders highlight card as link to app detail", () => {
    const highlights = {
      ...emptyHighlights,
      reviewPulse: [
        { app: appRef("Review App", "review-app"), v7d: 15, v30d: 40, momentum: "accelerating", latestRating: 4.5 },
      ],
    };
    render(<DailyHighlights highlights={highlights} platformId="shopify" />);
    const link = screen.getByText("Review Pulse").closest("a");
    expect(link).toHaveAttribute("href", "/shopify/apps/review-app/reviews");
  });
});
