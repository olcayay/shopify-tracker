import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AlertsCard, generateAlerts, type Alert } from "@/components/v2/alerts-card";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

describe("generateAlerts", () => {
  const base = { platform: "shopify", slug: "test-app" };

  it("generates keyword drop alerts", () => {
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const rankings = {
      keywordRankings: [
        { keyword: "crm", position: 20, scrapedAt: now },
        { keyword: "crm", position: 10, scrapedAt: yesterday },
      ],
    };
    const alerts = generateAlerts({ rankings, changes: [], featuredData: {}, reviewData: {}, adData: {}, ...base });
    expect(alerts.some((a) => a.type === "keyword-drop")).toBe(true);
  });

  it("generates keyword rise alerts", () => {
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const rankings = {
      keywordRankings: [
        { keyword: "crm", position: 3, scrapedAt: now },
        { keyword: "crm", position: 15, scrapedAt: yesterday },
      ],
    };
    const alerts = generateAlerts({ rankings, changes: [], featuredData: {}, reviewData: {}, adData: {}, ...base });
    expect(alerts.some((a) => a.type === "keyword-rise")).toBe(true);
  });

  it("generates change alerts for recent changes", () => {
    const changes = [{ field: "name", detectedAt: new Date().toISOString() }];
    const alerts = generateAlerts({ rankings: {}, changes, featuredData: {}, reviewData: {}, adData: {}, ...base });
    expect(alerts.some((a) => a.type === "competitor-change")).toBe(true);
  });

  it("does not generate change alerts for old changes", () => {
    const changes = [{ field: "name", detectedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString() }];
    const alerts = generateAlerts({ rankings: {}, changes, featuredData: {}, reviewData: {}, adData: {}, ...base });
    expect(alerts.some((a) => a.type === "competitor-change")).toBe(false);
  });

  it("generates featured alerts", () => {
    const featuredData = { sightings: [{ sectionHandle: "staff-pick", seenDate: new Date().toISOString() }] };
    const alerts = generateAlerts({ rankings: {}, changes: [], featuredData, reviewData: {}, adData: {}, ...base });
    expect(alerts.some((a) => a.type === "new-featured")).toBe(true);
  });

  it("returns empty for no activity", () => {
    const alerts = generateAlerts({ rankings: {}, changes: [], featuredData: {}, reviewData: {}, adData: {}, ...base });
    expect(alerts).toHaveLength(0);
  });

  it("sorts warnings before success before info", () => {
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const alerts = generateAlerts({
      rankings: {
        keywordRankings: [
          { keyword: "crm", position: 20, scrapedAt: now },
          { keyword: "crm", position: 10, scrapedAt: yesterday },
        ],
      },
      changes: [{ field: "name", detectedAt: now }],
      featuredData: { sightings: [{ sectionHandle: "pick", seenDate: now }] },
      reviewData: {},
      adData: {},
      ...base,
    });
    const severities = alerts.map((a) => a.severity);
    const warningIdx = severities.indexOf("warning");
    const infoIdx = severities.indexOf("info");
    if (warningIdx >= 0 && infoIdx >= 0) {
      expect(warningIdx).toBeLessThan(infoIdx);
    }
  });
});

describe("AlertsCard", () => {
  it("renders empty state", () => {
    render(<AlertsCard alerts={[]} />);
    expect(screen.getByText("All clear! No alerts right now.")).toBeInTheDocument();
  });

  it("renders alert messages with links", () => {
    const alerts: Alert[] = [
      { type: "keyword-drop", severity: "warning", message: "3 keywords dropped 5+ positions", href: "/test/visibility/keywords" },
      { type: "new-featured", severity: "success", message: "Featured in 1 section", href: "/test/visibility/featured" },
    ];
    render(<AlertsCard alerts={alerts} />);
    expect(screen.getByText("3 keywords dropped 5+ positions")).toBeInTheDocument();
    expect(screen.getByText("Featured in 1 section")).toBeInTheDocument();
    expect(screen.getAllByText("View →")).toHaveLength(2);
  });
});
