import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { FilterButtonGroup } from "@/components/ui/filter-button-group";

const options = [
  { value: "all", label: "All", count: 42 },
  { value: "active", label: "Active", count: 30 },
  { value: "inactive", label: "Inactive", count: 12 },
];

describe("FilterButtonGroup", () => {
  it("renders all options as buttons", () => {
    render(<FilterButtonGroup options={options} value="all" onChange={() => {}} />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("shows counts when provided", () => {
    render(<FilterButtonGroup options={options} value="all" onChange={() => {}} />);
    expect(screen.getByText("(42)")).toBeInTheDocument();
    expect(screen.getByText("(30)")).toBeInTheDocument();
  });

  it("calls onChange with option value", () => {
    const onChange = vi.fn();
    render(<FilterButtonGroup options={options} value="all" onChange={onChange} />);
    fireEvent.click(screen.getByText("Active"));
    expect(onChange).toHaveBeenCalledWith("active");
  });

  it("hides count when not provided", () => {
    const noCount = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
    render(<FilterButtonGroup options={noCount} value="a" onChange={() => {}} />);
    expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
  });
});
