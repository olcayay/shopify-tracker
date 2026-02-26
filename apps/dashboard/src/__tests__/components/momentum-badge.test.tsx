import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MomentumBadge } from "@/components/momentum-badge";

// Mock the Tooltip components since they use Radix UI
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
}));

import { vi } from "vitest";
import React from "react";

describe("MomentumBadge", () => {
  it("renders dash for null momentum", () => {
    render(<MomentumBadge momentum={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders dash for undefined momentum", () => {
    render(<MomentumBadge />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders accelerating badge", () => {
    render(<MomentumBadge momentum="accelerating" />);
    expect(screen.getByText("Accelerating")).toBeInTheDocument();
  });

  it("renders stable badge", () => {
    render(<MomentumBadge momentum="stable" />);
    expect(screen.getByText("Stable")).toBeInTheDocument();
  });

  it("renders slowing badge", () => {
    render(<MomentumBadge momentum="slowing" />);
    expect(screen.getByText("Slowing")).toBeInTheDocument();
  });

  it("renders spike badge", () => {
    render(<MomentumBadge momentum="spike" />);
    expect(screen.getByText("Spike")).toBeInTheDocument();
  });

  it("renders flat badge", () => {
    render(<MomentumBadge momentum="flat" />);
    expect(screen.getByText("Flat")).toBeInTheDocument();
  });

  it("renders raw text for unknown momentum", () => {
    render(<MomentumBadge momentum="unknown-state" />);
    expect(screen.getByText("unknown-state")).toBeInTheDocument();
  });

  it("renders tooltip with description for accelerating", () => {
    render(<MomentumBadge momentum="accelerating" />);
    expect(
      screen.getByText(/Review pace is increasing/)
    ).toBeInTheDocument();
  });

  it("renders tooltip with description for slowing", () => {
    render(<MomentumBadge momentum="slowing" />);
    expect(
      screen.getByText(/Review pace is declining/)
    ).toBeInTheDocument();
  });

  it("renders tooltip with description for spike", () => {
    render(<MomentumBadge momentum="spike" />);
    expect(screen.getByText(/Unusual surge/)).toBeInTheDocument();
  });

  it("renders tooltip with description for flat", () => {
    render(<MomentumBadge momentum="flat" />);
    expect(screen.getByText(/Very few or no reviews/)).toBeInTheDocument();
  });
});
