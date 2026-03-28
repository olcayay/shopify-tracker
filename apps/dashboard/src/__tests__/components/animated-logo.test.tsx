import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AnimatedLogo } from "@/components/animated-logo";

describe("AnimatedLogo", () => {
  it("renders an SVG with 4 bars and axes", () => {
    const { container } = render(<AnimatedLogo />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBe(4);
    const lines = container.querySelectorAll("line");
    expect(lines.length).toBe(2); // X and Y axes
  });

  it("does not apply animation styles when animating is false", () => {
    const { container } = render(<AnimatedLogo animating={false} />);
    const rects = container.querySelectorAll("rect");
    for (const rect of rects) {
      expect(rect.style.animation).toBe("");
    }
  });

  it("applies animation styles when animating is true", () => {
    const { container } = render(<AnimatedLogo animating={true} />);
    const rects = container.querySelectorAll("rect");
    for (const rect of rects) {
      expect(rect.style.animation).toContain("chart-bar-grow");
    }
  });

  it("applies different animation delays to each bar", () => {
    const { container } = render(<AnimatedLogo animating={true} />);
    const rects = container.querySelectorAll("rect");
    const delays = Array.from(rects).map((r) => r.style.animationDelay);
    // All delays should be different
    const unique = new Set(delays);
    expect(unique.size).toBe(4);
  });

  it("accepts custom className", () => {
    const { container } = render(<AnimatedLogo className="text-red-500" />);
    const svg = container.querySelector("svg");
    expect(svg?.className.baseVal).toContain("text-red-500");
  });

  it("is hidden from accessibility tree", () => {
    const { container } = render(<AnimatedLogo />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
});
