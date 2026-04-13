import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  RankingChartTooltip,
  buildTooltipGroups,
  tierFor,
  changeFor,
  type RankingTooltipRow,
} from "@/components/ranking-chart-tooltip";

/** PLA-1045 — tooltip grouping + sorting + change semantics. */

describe("tierFor", () => {
  it("buckets positions correctly", () => {
    expect(tierFor(1)).toBe("top3");
    expect(tierFor(3)).toBe("top3");
    expect(tierFor(4)).toBe("top10");
    expect(tierFor(10)).toBe("top10");
    expect(tierFor(11)).toBe("top50");
    expect(tierFor(50)).toBe("top50");
    expect(tierFor(51)).toBe("beyond");
    expect(tierFor(9999)).toBe("beyond");
    expect(tierFor(null)).toBe("dropped");
    expect(tierFor(0)).toBe("dropped");
  });
});

describe("changeFor", () => {
  const base: RankingTooltipRow = { label: "x", color: "#000", position: 5, previousPosition: 7 };
  it("reports an improvement as 'up'", () => {
    expect(changeFor(base)).toEqual({ kind: "up", value: 2 });
  });
  it("reports a regression as 'down'", () => {
    expect(changeFor({ ...base, position: 9, previousPosition: 3 })).toEqual({ kind: "down", value: 6 });
  });
  it("reports unchanged as 'same'", () => {
    expect(changeFor({ ...base, position: 5, previousPosition: 5 })).toEqual({ kind: "same" });
  });
  it("reports new when previous is null", () => {
    expect(changeFor({ ...base, previousPosition: null })).toEqual({ kind: "new" });
  });
  it("reports lost when current is null", () => {
    expect(changeFor({ ...base, position: null })).toEqual({ kind: "lost" });
  });
});

describe("buildTooltipGroups", () => {
  const labels = ["alpha", "bravo", "charlie", "delta", "echo"];
  const colorMap = new Map(labels.map((l, i) => [l, `c${i}`]));
  const pivoted = [
    { date: "Apr 10", alpha: 5, bravo: 12, charlie: 60, delta: null, echo: 2 },
    { date: "Apr 11", alpha: 2, bravo: 12, charlie: 70, delta: 8, echo: null },
  ];

  it("returns [] when payload is empty", () => {
    expect(buildTooltipGroups([], pivoted, labels, colorMap, new Set(), "Apr 11")).toEqual([]);
  });

  it("groups by tier and sorts by position ascending", () => {
    const payload = [
      { dataKey: "alpha", value: 2 },
      { dataKey: "bravo", value: 12 },
      { dataKey: "charlie", value: 70 },
      { dataKey: "delta", value: 8 },
      { dataKey: "echo", value: null },
    ];
    const groups = buildTooltipGroups(payload, pivoted, labels, colorMap, new Set(), "Apr 11");
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.rows.map((r) => r.label)]));
    expect(byKey.top3).toEqual(["alpha"]);
    expect(byKey.top10).toEqual(["delta"]);
    expect(byKey.top50).toEqual(["bravo"]);
    expect(byKey.beyond).toEqual(["charlie"]);
    expect(byKey.dropped).toEqual(["echo"]);
  });

  it("filters out hidden labels", () => {
    const payload = [
      { dataKey: "alpha", value: 2 },
      { dataKey: "bravo", value: 12 },
    ];
    const groups = buildTooltipGroups(payload, pivoted, labels, colorMap, new Set(["bravo"]), "Apr 11");
    const rows = groups.flatMap((g) => g.rows.map((r) => r.label));
    expect(rows).toEqual(["alpha"]);
  });

  it("computes previousPosition from the prior pivoted row", () => {
    const payload = [{ dataKey: "alpha", value: 2 }];
    const groups = buildTooltipGroups(payload, pivoted, labels, colorMap, new Set(), "Apr 11");
    const row = groups[0].rows[0];
    expect(row.previousPosition).toBe(5); // alpha was 5 on Apr 10
    expect(changeFor(row)).toEqual({ kind: "up", value: 3 });
  });

  it("collapses Beyond 50 and Dropped groups by default", () => {
    const payload = [
      { dataKey: "alpha", value: 2 },
      { dataKey: "charlie", value: 70 },
      { dataKey: "echo", value: null },
    ];
    const groups = buildTooltipGroups(payload, pivoted, labels, colorMap, new Set(), "Apr 11");
    const collapsed = groups.filter((g) => g.defaultCollapsed).map((g) => g.key);
    expect(collapsed).toEqual(expect.arrayContaining(["beyond", "dropped"]));
    const expanded = groups.filter((g) => !g.defaultCollapsed).map((g) => g.key);
    expect(expanded).toEqual(expect.arrayContaining(["top3"]));
  });

  it("breaks ties alphabetically", () => {
    const samePosData = [
      { date: "Apr 11", bb: 5, aa: 5 },
    ];
    const payload = [
      { dataKey: "aa", value: 5 },
      { dataKey: "bb", value: 5 },
    ];
    const groups = buildTooltipGroups(
      payload,
      samePosData,
      ["aa", "bb"],
      new Map([["aa", "c1"], ["bb", "c2"]]),
      new Set(),
      "Apr 11",
    );
    expect(groups[0].rows.map((r) => r.label)).toEqual(["aa", "bb"]);
  });
});

describe("<RankingChartTooltip />", () => {
  const labels = ["a", "b", "c"];
  const colorMap = new Map(labels.map((l, i) => [l, `c${i}`]));
  const pivoted = [
    { date: "Apr 10", a: 2, b: 100, c: null },
    { date: "Apr 11", a: 1, b: 120, c: 5 },
  ];

  it("renders nothing when inactive", () => {
    const { container } = render(
      <RankingChartTooltip
        active={false}
        payload={[]}
        label="Apr 11"
        pivotedData={pivoted}
        labels={labels}
        colorMap={colorMap}
        hiddenLabels={new Set()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders tier groups with counts and keyword names", () => {
    render(
      <RankingChartTooltip
        active={true}
        payload={[
          { dataKey: "a", value: 1 },
          { dataKey: "b", value: 120 },
          { dataKey: "c", value: 5 },
        ]}
        label="Apr 11"
        pivotedData={pivoted}
        labels={labels}
        colorMap={colorMap}
        hiddenLabels={new Set()}
      />,
    );
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("c")).toBeInTheDocument();
    // Beyond 50 is collapsed by default so "b" is not visible.
    expect(screen.queryByText("b")).not.toBeInTheDocument();
    // But the group button is present with the count.
    expect(screen.getByText("Beyond 50")).toBeInTheDocument();
  });

  it("expands a collapsed tier on click", () => {
    // Need >5 total rows to exit flatMode.
    const bigLabels = ["a", "b", "c", "d", "e", "f", "g"];
    const bigColor = new Map(bigLabels.map((l, i) => [l, `c${i}`]));
    const bigPivot = [
      { date: "Apr 10", a: 1, b: 2, c: 3, d: 4, e: 5, f: 60, g: 120 },
      { date: "Apr 11", a: 1, b: 2, c: 3, d: 4, e: 5, f: 70, g: 130 },
    ];
    render(
      <RankingChartTooltip
        active={true}
        payload={bigLabels.map((k) => ({ dataKey: k, value: (bigPivot[1] as Record<string, number>)[k] }))}
        label="Apr 11"
        pivotedData={bigPivot}
        labels={bigLabels}
        colorMap={bigColor}
        hiddenLabels={new Set()}
      />,
    );
    expect(screen.queryByText("f")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Beyond 50"));
    expect(screen.getByText("f")).toBeInTheDocument();
  });
});

/** PLA-1059 — itemLabel prop, pluralization, 2-col grid, pin-on-hover. */
describe("<RankingChartTooltip /> (PLA-1059)", () => {
  const smallPivot = [
    { date: "Apr 10", a: 2 },
    { date: "Apr 11", a: 1 },
  ];

  it("defaults the header noun to 'keyword(s)' and pluralizes", () => {
    render(
      <RankingChartTooltip
        active={true}
        payload={[{ dataKey: "a", value: 1 }]}
        label="Apr 11"
        pivotedData={smallPivot}
        labels={["a"]}
        colorMap={new Map([["a", "c1"]])}
        hiddenLabels={new Set()}
      />,
    );
    expect(screen.getByText(/1 keyword$/)).toBeInTheDocument();
  });

  it("uses itemLabel='category' with 'categories' plural", () => {
    const labels = ["a", "b"];
    const pivot = [
      { date: "Apr 10", a: 2, b: 3 },
      { date: "Apr 11", a: 1, b: 2 },
    ];
    render(
      <RankingChartTooltip
        active={true}
        payload={[
          { dataKey: "a", value: 1 },
          { dataKey: "b", value: 2 },
        ]}
        label="Apr 11"
        pivotedData={pivot}
        labels={labels}
        colorMap={new Map([["a", "c1"], ["b", "c2"]])}
        hiddenLabels={new Set()}
        itemLabel="category"
      />,
    );
    expect(screen.getByText(/2 categories$/)).toBeInTheDocument();
  });

  it("renders a 2-column grid for tiers with more than 12 rows", () => {
    const N = 15;
    const bigLabels = Array.from({ length: N }, (_, i) => `k${i}`);
    const prevRow: Record<string, any> = { date: "Apr 10" };
    const curRow: Record<string, any> = { date: "Apr 11" };
    // Place every row in Top 50 (positions 11..25) so one tier exceeds the grid threshold.
    bigLabels.forEach((l, i) => {
      prevRow[l] = i + 11;
      curRow[l] = i + 11;
    });
    const pivot = [prevRow, curRow];
    render(
      <RankingChartTooltip
        active={true}
        payload={bigLabels.map((l, i) => ({ dataKey: l, value: i + 11 }))}
        label="Apr 11"
        pivotedData={pivot}
        labels={bigLabels}
        colorMap={new Map(bigLabels.map((l, i) => [l, `c${i}`]))}
        hiddenLabels={new Set()}
      />,
    );
    expect(screen.getByTestId("tier-top50-grid")).toBeInTheDocument();
  });

  it("keeps a single-column list for tiers at or below the grid threshold", () => {
    const N = 8;
    const bigLabels = Array.from({ length: N }, (_, i) => `k${i}`);
    const prevRow: Record<string, any> = { date: "Apr 10" };
    const curRow: Record<string, any> = { date: "Apr 11" };
    bigLabels.forEach((l, i) => {
      prevRow[l] = i + 11;
      curRow[l] = i + 11; // Top 50 (11..18)
    });
    const pivot = [prevRow, curRow];
    render(
      <RankingChartTooltip
        active={true}
        payload={bigLabels.map((l, i) => ({ dataKey: l, value: i + 11 }))}
        label="Apr 11"
        pivotedData={pivot}
        labels={bigLabels}
        colorMap={new Map(bigLabels.map((l, i) => [l, `c${i}`]))}
        hiddenLabels={new Set()}
      />,
    );
    expect(screen.getByTestId("tier-top50-list")).toBeInTheDocument();
  });

  it("pins on mouseenter so content does not change on re-render", () => {
    const { rerender } = render(
      <RankingChartTooltip
        active={true}
        payload={[{ dataKey: "a", value: 1 }]}
        label="Apr 11"
        pivotedData={smallPivot}
        labels={["a"]}
        colorMap={new Map([["a", "c1"]])}
        hiddenLabels={new Set()}
      />,
    );
    const tt = screen.getByTestId("ranking-tooltip");
    fireEvent.mouseEnter(tt);
    // Simulate recharts pushing a new label (cursor moved off to a day with no data).
    rerender(
      <RankingChartTooltip
        active={false}
        payload={[]}
        label={undefined}
        pivotedData={smallPivot}
        labels={["a"]}
        colorMap={new Map([["a", "c1"]])}
        hiddenLabels={new Set()}
      />,
    );
    // Pinned: tooltip still shows the frozen Apr 11 + `a` row.
    expect(screen.getByTestId("ranking-tooltip")).toBeInTheDocument();
    expect(screen.getByText("a")).toBeInTheDocument();
    // Unpinning via mouseleave removes it on the next inactive render.
    fireEvent.mouseLeave(screen.getByTestId("ranking-tooltip"));
    rerender(
      <RankingChartTooltip
        active={false}
        payload={[]}
        label={undefined}
        pivotedData={smallPivot}
        labels={["a"]}
        colorMap={new Map([["a", "c1"]])}
        hiddenLabels={new Set()}
      />,
    );
    expect(screen.queryByTestId("ranking-tooltip")).not.toBeInTheDocument();
  });
});
