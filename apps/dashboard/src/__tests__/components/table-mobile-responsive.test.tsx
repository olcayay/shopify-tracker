import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PlatformGroupedTable,
  type PlatformGroup,
} from "@/components/platform-grouped-table";

function renderSimpleTable() {
  return render(
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Item</TableCell>
          <TableCell>123</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );
}

describe("Table mobile responsiveness", () => {
  it("base Table container has overflow-x-auto for horizontal scrolling", () => {
    const { container } = renderSimpleTable();
    const tableContainer = container.querySelector(
      '[data-slot="table-container"]',
    );
    expect(tableContainer).toBeInTheDocument();
    expect(tableContainer?.className).toContain("overflow-x-auto");
  });

  it("base Table container has w-full to fill available width", () => {
    const { container } = renderSimpleTable();
    const tableContainer = container.querySelector(
      '[data-slot="table-container"]',
    );
    expect(tableContainer?.className).toContain("w-full");
  });

  it("PlatformGroupedTable wrapper has overflow-x-auto for horizontal scrolling", () => {
    interface TestItem {
      id: number;
      name: string;
    }
    const groups: PlatformGroup<TestItem>[] = [
      {
        platform: "shopify",
        items: [{ id: 1, name: "App A" }],
      },
    ];

    const { container } = render(
      <PlatformGroupedTable
        groups={groups}
        colCount={2}
        renderHeaderRow={() => (
          <>
            <TableHead>Name</TableHead>
            <TableHead>ID</TableHead>
          </>
        )}
        renderRow={(item: TestItem) => (
          <TableRow key={item.id}>
            <TableCell>{item.name}</TableCell>
            <TableCell>{item.id}</TableCell>
          </TableRow>
        )}
      />,
    );

    // The outermost wrapper div should have overflow-x-auto
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("overflow-x-auto");
    expect(wrapper?.className).toContain("rounded-md");
    expect(wrapper?.className).toContain("border");
  });
});
