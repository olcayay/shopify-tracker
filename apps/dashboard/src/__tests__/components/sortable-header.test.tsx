import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { SortableHeader } from "@/components/ui/sortable-header";

describe("SortableHeader", () => {
  it("renders label text", () => {
    render(
      <SortableHeader label="Name" sortKey="name" currentSort="" currentDir="asc" onSort={() => {}} />,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
  });

  it("shows ArrowUpDown when not active sort", () => {
    const { container } = render(
      <SortableHeader label="Name" sortKey="name" currentSort="date" currentDir="asc" onSort={() => {}} />,
    );
    // ArrowUpDown has both up and down arrows
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
  });

  it("calls onSort with sortKey when clicked", () => {
    const onSort = vi.fn();
    render(
      <SortableHeader label="Name" sortKey="name" currentSort="" currentDir="asc" onSort={onSort} />,
    );
    fireEvent.click(screen.getByText("Name"));
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("renders as button for accessibility", () => {
    render(
      <SortableHeader label="Date" sortKey="date" currentSort="" currentDir="asc" onSort={() => {}} />,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
