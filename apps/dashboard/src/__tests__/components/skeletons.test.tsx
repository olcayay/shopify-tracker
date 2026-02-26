import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  TableSkeleton,
  CardSkeleton,
  StatCardSkeleton,
  PageHeaderSkeleton,
  TableCardSkeleton,
} from "@/components/skeletons";

describe("TableSkeleton", () => {
  it("renders with default rows and cols", () => {
    const { container } = render(<TableSkeleton />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(5);
    const firstRowCells = rows[0].querySelectorAll("td");
    expect(firstRowCells.length).toBe(4);
  });

  it("renders with custom rows", () => {
    const { container } = render(<TableSkeleton rows={3} />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(3);
  });

  it("renders with custom cols", () => {
    const { container } = render(<TableSkeleton cols={6} />);
    const headerCells = container.querySelectorAll("thead th");
    expect(headerCells.length).toBe(6);
  });

  it("renders header row", () => {
    const { container } = render(<TableSkeleton />);
    const headerCells = container.querySelectorAll("thead th");
    expect(headerCells.length).toBe(4);
  });

  it("renders skeleton elements in cells", () => {
    const { container } = render(<TableSkeleton rows={1} cols={1} />);
    const skeletons = container.querySelectorAll("[class*='animate-pulse'], [data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });
});

describe("CardSkeleton", () => {
  it("renders with default lines", () => {
    const { container } = render(<CardSkeleton />);
    // 2 header skeletons + 3 content lines = multiple skeleton elements
    const card = container.firstElementChild;
    expect(card).toBeTruthy();
  });

  it("renders with custom lines", () => {
    const { container } = render(<CardSkeleton lines={5} />);
    const card = container.firstElementChild;
    expect(card).toBeTruthy();
  });

  it("renders card header", () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelector("[data-slot='card-header']")).toBeTruthy();
  });

  it("renders card content", () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelector("[data-slot='card-content']")).toBeTruthy();
  });
});

describe("StatCardSkeleton", () => {
  it("renders card structure", () => {
    const { container } = render(<StatCardSkeleton />);
    const card = container.firstElementChild;
    expect(card).toBeTruthy();
  });

  it("renders skeleton elements", () => {
    const { container } = render(<StatCardSkeleton />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });
});

describe("PageHeaderSkeleton", () => {
  it("renders skeleton elements for header", () => {
    const { container } = render(<PageHeaderSkeleton />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBe(2);
  });

  it("renders in a spacing container", () => {
    const { container } = render(<PageHeaderSkeleton />);
    expect(container.firstElementChild?.className).toContain("space-y-2");
  });
});

describe("TableCardSkeleton", () => {
  it("renders card with table inside", () => {
    const { container } = render(<TableCardSkeleton />);
    expect(container.querySelector("table")).toBeTruthy();
  });

  it("renders with default rows and cols", () => {
    const { container } = render(<TableCardSkeleton />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(5);
  });

  it("renders with custom rows and cols", () => {
    const { container } = render(<TableCardSkeleton rows={3} cols={2} />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(3);
    const headerCells = container.querySelectorAll("thead th");
    expect(headerCells.length).toBe(2);
  });

  it("renders card header with skeleton", () => {
    const { container } = render(<TableCardSkeleton />);
    expect(container.querySelector("[data-slot='card-header']")).toBeTruthy();
  });
});
