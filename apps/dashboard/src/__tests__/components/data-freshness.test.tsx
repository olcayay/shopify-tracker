import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataFreshness } from "@/components/data-freshness";

describe("DataFreshness", () => {
  it("renders nothing when dateStr is null", () => {
    const { container } = render(<DataFreshness dateStr={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when dateStr is undefined", () => {
    const { container } = render(<DataFreshness dateStr={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders 'Data from' text with a recent timestamp", () => {
    const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
    render(<DataFreshness dateStr={recentDate} />);
    expect(screen.getByText(/Data from/)).toBeTruthy();
  });

  it("uses default color for recent data (<24h)", () => {
    const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    render(<DataFreshness dateStr={recentDate} />);
    const el = screen.getByText(/Data from/);
    expect(el.className).toContain("text-muted-foreground");
  });

  it("uses amber color for stale data (24-72h)", () => {
    const staleDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    render(<DataFreshness dateStr={staleDate} />);
    const el = screen.getByText(/Data from/);
    expect(el.className).toContain("text-amber-600");
  });

  it("uses red color for very stale data (>72h)", () => {
    const veryStaleDate = new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString();
    render(<DataFreshness dateStr={veryStaleDate} />);
    const el = screen.getByText(/Data from/);
    expect(el.className).toContain("text-red-600");
  });
});
