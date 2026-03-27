import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AccountUsageCards, USAGE_STAT_PRESETS } from "@/components/account-usage-cards";
import type { UsageStat } from "@/components/account-usage-cards";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function makeStats(overrides: Partial<UsageStat>[] = []): UsageStat[] {
  const defaults: UsageStat[] = [
    { key: "apps", ...USAGE_STAT_PRESETS.apps, value: 3, limit: 10 },
    { key: "keywords", ...USAGE_STAT_PRESETS.keywords, value: 8, limit: 50 },
    { key: "competitors", ...USAGE_STAT_PRESETS.competitors, value: 2, limit: 20 },
    { key: "research", ...USAGE_STAT_PRESETS.research, value: 1, limit: 3 },
    { key: "users", ...USAGE_STAT_PRESETS.users, value: 2, limit: 5 },
  ];
  return defaults.map((d, i) => ({ ...d, ...overrides[i] }));
}

describe("AccountUsageCards", () => {
  it("renders all 5 stat cards with labels and values", () => {
    render(<AccountUsageCards stats={makeStats()} />);
    expect(screen.getByText("My Apps")).toBeInTheDocument();
    expect(screen.getByText("Tracked Keywords")).toBeInTheDocument();
    expect(screen.getByText("Competitor Apps")).toBeInTheDocument();
    expect(screen.getByText("Research Projects")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("/10")).toBeInTheDocument();
  });

  it("renders clickable cards when href is provided", () => {
    const stats = makeStats([{ href: "/shopify/apps" }]);
    render(<AccountUsageCards stats={stats} />);
    const link = screen.getByText("My Apps").closest("a");
    expect(link).toHaveAttribute("href", "/shopify/apps");
  });

  it("renders non-clickable cards when href is omitted", () => {
    const stats = makeStats();
    render(<AccountUsageCards stats={stats} />);
    const label = screen.getByText("My Apps");
    expect(label.closest("a")).toBeNull();
  });

  it("hides cards with show=false", () => {
    const stats = makeStats([{}, { show: false }]);
    render(<AccountUsageCards stats={stats} />);
    expect(screen.queryByText("Tracked Keywords")).not.toBeInTheDocument();
    expect(screen.getByText("My Apps")).toBeInTheDocument();
  });

  it("USAGE_STAT_PRESETS has correct keys", () => {
    expect(USAGE_STAT_PRESETS).toHaveProperty("apps");
    expect(USAGE_STAT_PRESETS).toHaveProperty("keywords");
    expect(USAGE_STAT_PRESETS).toHaveProperty("competitors");
    expect(USAGE_STAT_PRESETS).toHaveProperty("research");
    expect(USAGE_STAT_PRESETS).toHaveProperty("users");
    expect(USAGE_STAT_PRESETS.apps.label).toBe("My Apps");
  });
});
