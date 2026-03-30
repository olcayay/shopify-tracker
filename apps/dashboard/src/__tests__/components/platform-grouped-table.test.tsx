import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { PlatformGroupedTable, type PlatformGroup } from "@/components/platform-grouped-table";
import { TableHead, TableCell, TableRow } from "@/components/ui/table";

interface TestItem {
  id: number;
  name: string;
}

const groups: PlatformGroup<TestItem>[] = [
  { platform: "shopify", items: [{ id: 1, name: "App A" }, { id: 2, name: "App B" }] },
  { platform: "salesforce", items: [{ id: 3, name: "App C" }] },
];

const renderHeaderRow = () => (
  <>
    <TableHead>Name</TableHead>
    <TableHead>ID</TableHead>
  </>
);

const renderRow = (item: TestItem) => (
  <TableRow key={item.id}>
    <TableCell>{item.name}</TableCell>
    <TableCell>{item.id}</TableCell>
  </TableRow>
);

describe("PlatformGroupedTable", () => {
  it("renders all platform group headers", () => {
    render(
      <PlatformGroupedTable
        groups={groups}
        colCount={2}
        renderHeaderRow={renderHeaderRow}
        renderRow={renderRow}
      />,
    );
    expect(screen.getByTestId("platform-group-shopify")).toBeInTheDocument();
    expect(screen.getByTestId("platform-group-salesforce")).toBeInTheDocument();
  });

  it("renders all data rows when not collapsed", () => {
    render(
      <PlatformGroupedTable
        groups={groups}
        colCount={2}
        renderHeaderRow={renderHeaderRow}
        renderRow={renderRow}
      />,
    );
    expect(screen.getByText("App A")).toBeInTheDocument();
    expect(screen.getByText("App B")).toBeInTheDocument();
    expect(screen.getByText("App C")).toBeInTheDocument();
  });

  it("shows item count with correct pluralization", () => {
    render(
      <PlatformGroupedTable
        groups={groups}
        colCount={2}
        renderHeaderRow={renderHeaderRow}
        renderRow={renderRow}
        entityLabel="app"
      />,
    );
    expect(screen.getByText("(2 apps)")).toBeInTheDocument();
    expect(screen.getByText("(1 app)")).toBeInTheDocument();
  });

  it("collapses/expands a platform group on click", () => {
    render(
      <PlatformGroupedTable
        groups={groups}
        colCount={2}
        renderHeaderRow={renderHeaderRow}
        renderRow={renderRow}
      />,
    );
    // All rows visible initially
    expect(screen.getByText("App A")).toBeInTheDocument();
    expect(screen.getByText("App B")).toBeInTheDocument();

    // Click Shopify header to collapse
    fireEvent.click(screen.getByTestId("platform-group-shopify"));
    expect(screen.queryByText("App A")).not.toBeInTheDocument();
    expect(screen.queryByText("App B")).not.toBeInTheDocument();
    // Salesforce still visible
    expect(screen.getByText("App C")).toBeInTheDocument();

    // Click again to expand
    fireEvent.click(screen.getByTestId("platform-group-shopify"));
    expect(screen.getByText("App A")).toBeInTheDocument();
  });

  it("renders empty state when no items", () => {
    render(
      <PlatformGroupedTable
        groups={[]}
        colCount={2}
        renderHeaderRow={renderHeaderRow}
        renderRow={renderRow}
        emptyMessage="Nothing here."
      />,
    );
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  it("renders single header by default", () => {
    const { container } = render(
      <PlatformGroupedTable
        groups={groups}
        colCount={2}
        renderHeaderRow={renderHeaderRow}
        renderRow={renderRow}
      />,
    );
    // Only one thead
    const theads = container.querySelectorAll("thead");
    expect(theads).toHaveLength(1);
  });

  it("renders per-group headers when singleHeader is false", () => {
    render(
      <PlatformGroupedTable
        groups={groups}
        colCount={2}
        renderHeaderRow={renderHeaderRow}
        renderRow={renderRow}
        singleHeader={false}
      />,
    );
    // Column header "Name" appears twice (once per group) — in tbody rows
    const nameHeaders = screen.getAllByText("Name");
    expect(nameHeaders).toHaveLength(2);
  });

  it("uses colored left border on group headers", () => {
    render(
      <PlatformGroupedTable
        groups={groups}
        colCount={2}
        renderHeaderRow={renderHeaderRow}
        renderRow={renderRow}
      />,
    );
    const shopifyGroup = screen.getByTestId("platform-group-shopify");
    expect(shopifyGroup.style.borderLeftWidth).toBe("3px");
  });

  it("renders empty state for groups with zero total items", () => {
    const emptyGroups: PlatformGroup<TestItem>[] = [
      { platform: "shopify", items: [] },
      { platform: "salesforce", items: [] },
    ];
    render(
      <PlatformGroupedTable
        groups={emptyGroups}
        colCount={2}
        renderHeaderRow={renderHeaderRow}
        renderRow={renderRow}
      />,
    );
    expect(screen.getByText("No items found.")).toBeInTheDocument();
  });
});
