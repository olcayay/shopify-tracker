import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CompetitorPresets, PRESETS } from "@/components/v2/competitor-presets";

describe("CompetitorPresets", () => {
  it("renders all preset buttons", () => {
    render(<CompetitorPresets active="essential" onChange={() => {}} />);
    expect(screen.getByText("Essential")).toBeInTheDocument();
    expect(screen.getByText("Growth")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Full")).toBeInTheDocument();
  });

  it("highlights active preset", () => {
    render(<CompetitorPresets active="growth" onChange={() => {}} />);
    const growthBtn = screen.getByText("Growth");
    expect(growthBtn.className).toContain("bg-background");
  });

  it("calls onChange with correct preset key", () => {
    const onChange = vi.fn();
    render(<CompetitorPresets active="essential" onChange={onChange} />);
    fireEvent.click(screen.getByText("Content"));
    expect(onChange).toHaveBeenCalledWith("content");
  });

  it("has correct column counts per preset", () => {
    expect(PRESETS.essential.columns).toHaveLength(6);
    expect(PRESETS.growth.columns).toHaveLength(7);
    expect(PRESETS.content.columns).toHaveLength(6);
    expect(PRESETS.full.columns.length).toBeGreaterThan(15);
  });
});
