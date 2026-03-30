import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { StatusIndicator } from "@/components/ui/status-indicator";

describe("StatusIndicator", () => {
  it("renders label text", () => {
    render(<StatusIndicator variant="success" label="Active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies success colors", () => {
    const { container } = render(<StatusIndicator variant="success" label="OK" />);
    const dot = container.querySelector(".bg-emerald-500");
    expect(dot).toBeInTheDocument();
    expect(screen.getByText("OK").className).toContain("emerald");
  });

  it("applies error colors", () => {
    const { container } = render(<StatusIndicator variant="error" label="Failed" />);
    const dot = container.querySelector(".bg-red-500");
    expect(dot).toBeInTheDocument();
  });

  it("renders sm size with smaller classes", () => {
    render(<StatusIndicator variant="info" label="Info" size="sm" />);
    const text = screen.getByText("Info");
    expect(text.className).toContain("text-xs");
  });

  it("renders pulse animation when pulse is true", () => {
    const { container } = render(<StatusIndicator variant="active" label="Running" pulse />);
    const pulseDot = container.querySelector(".animate-ping");
    expect(pulseDot).toBeInTheDocument();
  });

  it("does not render pulse when pulse is false", () => {
    const { container } = render(<StatusIndicator variant="active" label="Running" />);
    expect(container.querySelector(".animate-ping")).not.toBeInTheDocument();
  });
});
