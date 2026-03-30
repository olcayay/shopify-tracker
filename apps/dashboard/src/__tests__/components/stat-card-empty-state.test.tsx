import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, Search } from "lucide-react";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Total Users" value={42} />);
    expect(screen.getByText("Total Users")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders string value as-is", () => {
    render(<StatCard label="Rate" value="98.5%" />);
    expect(screen.getByText("98.5%")).toBeInTheDocument();
  });

  it("renders positive change in green", () => {
    render(<StatCard label="Growth" value={42} change={{ value: 12 }} />);
    const change = screen.getByText("+12%");
    expect(change.className).toContain("emerald");
  });

  it("renders negative change in red", () => {
    render(<StatCard label="Churn" value={5} change={{ value: -3 }} />);
    const change = screen.getByText("-3%");
    expect(change.className).toContain("red");
  });

  it("renders icon when provided", () => {
    const { container } = render(<StatCard label="Users" value={10} icon={Users} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No results found" />);
    expect(screen.getByText("No results found")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="Empty" description="Try adjusting your filters" />);
    expect(screen.getByText("Try adjusting your filters")).toBeInTheDocument();
  });

  it("renders action button and calls onClick", () => {
    const onClick = vi.fn();
    render(<EmptyState title="Empty" action={{ label: "Add Item", onClick }} />);
    fireEvent.click(screen.getByText("Add Item"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders custom icon", () => {
    const { container } = render(<EmptyState title="No search results" icon={Search} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
