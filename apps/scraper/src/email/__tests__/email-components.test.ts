import { describe, it, expect } from "vitest";
import {
  emailLayout,
  header,
  heroStat,
  dataTable,
  insightBlock,
  competitorCard,
  ctaButton,
  footer,
  summaryBadge,
  reviewCard,
  milestoneCard,
} from "../components/index.js";

describe("Email template components", () => {
  it("emailLayout wraps content in valid HTML", () => {
    const html = emailLayout("<p>Hello</p>", "Preview text");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<p>Hello</p>");
    expect(html).toContain("Preview text");
    expect(html).toContain("</html>");
  });

  it("header renders type label and date", () => {
    const html = header("Daily Digest", "Mar 29, 2026");
    expect(html).toContain("AppRanks");
    expect(html).toContain("Daily Digest");
    expect(html).toContain("Mar 29, 2026");
  });

  it("heroStat renders value and change", () => {
    const html = heroStat("Ranking", "#1", { from: "#3", to: "#1", isPositive: true });
    expect(html).toContain("#1");
    expect(html).toContain("#3");
    expect(html).toContain("Ranking");
  });

  it("dataTable renders headers and rows", () => {
    const html = dataTable(
      ["App", "Position"],
      [
        { cells: ["Test App", "#1"], changeValue: 2 },
        { cells: ["Other App", "#3"], changeValue: -1 },
      ]
    );
    expect(html).toContain("App");
    expect(html).toContain("Position");
    expect(html).toContain("Test App");
    expect(html).toContain("#1");
  });

  it("insightBlock renders text with icon", () => {
    const html = insightBlock("Your app is trending upward.");
    expect(html).toContain("Insight");
    expect(html).toContain("Your app is trending upward.");
  });

  it("competitorCard renders competitor info", () => {
    const html = competitorCard({ name: "Rival App", rating: 4.5, ratingCount: 200 });
    expect(html).toContain("Rival App");
    expect(html).toContain("4.5");
  });

  it("ctaButton renders primary and secondary variants", () => {
    const primary = ctaButton("View Dashboard", "https://appranks.io", "primary");
    expect(primary).toContain("View Dashboard");
    expect(primary).toContain("https://appranks.io");
    expect(primary).toContain("#6366f1"); // primary color bg

    const secondary = ctaButton("Learn More", "https://appranks.io", "secondary");
    expect(secondary).toContain("transparent");
  });

  it("footer renders unsubscribe and preferences links", () => {
    const html = footer("https://appranks.io/unsub", "https://appranks.io/prefs");
    expect(html).toContain("Unsubscribe");
    expect(html).toContain("Email Preferences");
    expect(html).toContain("https://appranks.io/unsub");
  });

  it("summaryBadge renders colored badges", () => {
    const html = summaryBadge([
      { label: "improved", count: 5, color: "green" },
      { label: "dropped", count: 2, color: "red" },
    ]);
    expect(html).toContain("5 improved");
    expect(html).toContain("2 dropped");
  });

  it("reviewCard renders rating stars and content", () => {
    const html = reviewCard(5, "John Doe", "Amazing app!", "2026-03-29");
    expect(html).toContain("★★★★★");
    expect(html).toContain("Amazing app!");
    expect(html).toContain("John Doe");
  });

  it("milestoneCard renders celebration", () => {
    const html = milestoneCard("Top 3!", "Your app entered the top 3 in Marketing.");
    expect(html).toContain("Top 3!");
    expect(html).toContain("Your app entered the top 3");
  });
});
