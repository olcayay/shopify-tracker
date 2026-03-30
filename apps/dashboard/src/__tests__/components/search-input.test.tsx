import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { SearchInput } from "@/components/ui/search-input";

describe("SearchInput", () => {
  it("renders search icon and input", () => {
    render(<SearchInput placeholder="Search..." />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("shows clear button when value is non-empty and onClear is provided", () => {
    render(<SearchInput value="hello" onClear={() => {}} onChange={() => {}} />);
    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();
  });

  it("hides clear button when value is empty", () => {
    render(<SearchInput value="" onClear={() => {}} onChange={() => {}} />);
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
  });

  it("hides clear button when onClear is not provided", () => {
    render(<SearchInput value="hello" onChange={() => {}} />);
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
  });

  it("calls onClear when clear button clicked", () => {
    const onClear = vi.fn();
    render(<SearchInput value="hello" onClear={onClear} onChange={() => {}} />);
    fireEvent.click(screen.getByLabelText("Clear search"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("passes className through", () => {
    const { container } = render(<SearchInput className="max-w-md" onChange={() => {}} />);
    const input = container.querySelector("input");
    expect(input?.className).toContain("max-w-md");
  });
});
