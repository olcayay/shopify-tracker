import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/ranking-chart", () => ({
  RankingChart: ({ data }: any) => (
    <div data-testid="ranking-chart">
      {[...new Set(data.map((d: any) => d.label))].sort().join(",")}
    </div>
  ),
}));

import { KeywordRankingsSection } from "@/app/(dashboard)/[platform]/apps/[slug]/rankings/keyword-rankings-section";

// Build data with multiple keywords sharing common words
const data = [
  { date: "2026-04-01", position: 1, label: "ai chatbot", slug: "ai-chatbot", linkPrefix: "/shopify/keywords/" },
  { date: "2026-04-02", position: 2, label: "ai chatbot", slug: "ai-chatbot", linkPrefix: "/shopify/keywords/" },
  { date: "2026-04-01", position: 3, label: "ai helpdesk", slug: "ai-helpdesk", linkPrefix: "/shopify/keywords/" },
  { date: "2026-04-01", position: 5, label: "smart chatbot", slug: "smart-chatbot", linkPrefix: "/shopify/keywords/" },
  { date: "2026-04-01", position: 10, label: "email marketing", slug: "email-marketing", linkPrefix: "/shopify/keywords/" },
];

describe("KeywordRankingsSection", () => {
  it("renders chart with all keywords when no filter is active", () => {
    render(<KeywordRankingsSection data={data} pageSize={24} />);
    expect(screen.getByTestId("ranking-chart")).toHaveTextContent(
      "ai chatbot,ai helpdesk,email marketing,smart chatbot"
    );
  });

  it("renders Common Words filter when word groups exist", () => {
    render(<KeywordRankingsSection data={data} pageSize={24} />);
    // "ai" appears in 2 keywords, "chatbot" appears in 2 keywords
    expect(screen.getByText("Common words:")).toBeInTheDocument();
    expect(screen.getByText("ai")).toBeInTheDocument();
    expect(screen.getByText("chatbot")).toBeInTheDocument();
  });

  it("does not render filter when no common words exist", () => {
    const uniqueData = [
      { date: "2026-04-01", position: 1, label: "alpha", slug: "alpha", linkPrefix: "/" },
      { date: "2026-04-01", position: 2, label: "beta", slug: "beta", linkPrefix: "/" },
    ];
    render(<KeywordRankingsSection data={uniqueData} pageSize={24} />);
    expect(screen.queryByText("Common words:")).not.toBeInTheDocument();
  });

  it("filters chart data when a word group is toggled", async () => {
    const user = userEvent.setup();
    render(<KeywordRankingsSection data={data} pageSize={24} />);

    // Click "chatbot" to filter
    await user.click(screen.getByText("chatbot"));
    // Should show only keywords containing "chatbot": ai chatbot, smart chatbot
    expect(screen.getByTestId("ranking-chart")).toHaveTextContent(
      "ai chatbot,smart chatbot"
    );
  });

  it("supports multi-select filtering (OR logic)", async () => {
    const user = userEvent.setup();
    render(<KeywordRankingsSection data={data} pageSize={24} />);

    // Click "chatbot" then "email"
    await user.click(screen.getByText("chatbot"));
    // "email" isn't a common word (appears once), so let's use "ai" instead
    await user.click(screen.getByText("ai"));
    // Should show union: ai chatbot, ai helpdesk, smart chatbot
    expect(screen.getByTestId("ranking-chart")).toHaveTextContent(
      "ai chatbot,ai helpdesk,smart chatbot"
    );
  });

  it("clears all filters when Clear button is clicked", async () => {
    const user = userEvent.setup();
    render(<KeywordRankingsSection data={data} pageSize={24} />);

    await user.click(screen.getByText("chatbot"));
    expect(screen.getByTestId("ranking-chart")).toHaveTextContent(
      "ai chatbot,smart chatbot"
    );

    await user.click(screen.getByText("Clear"));
    expect(screen.getByTestId("ranking-chart")).toHaveTextContent(
      "ai chatbot,ai helpdesk,email marketing,smart chatbot"
    );
  });

  it("toggles a word off when clicked twice", async () => {
    const user = userEvent.setup();
    render(<KeywordRankingsSection data={data} pageSize={24} />);

    await user.click(screen.getByText("chatbot"));
    expect(screen.getByTestId("ranking-chart")).toHaveTextContent(
      "ai chatbot,smart chatbot"
    );

    await user.click(screen.getByText("chatbot"));
    expect(screen.getByTestId("ranking-chart")).toHaveTextContent(
      "ai chatbot,ai helpdesk,email marketing,smart chatbot"
    );
  });
});
