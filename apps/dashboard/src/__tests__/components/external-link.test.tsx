import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExternalLink } from "@/components/ui/external-link";

describe("ExternalLink", () => {
  it("renders a link with correct href", () => {
    render(<ExternalLink href="https://example.com">Example</ExternalLink>);
    const link = screen.getByRole("link", { name: /example/i });
    expect(link).toHaveAttribute("href", "https://example.com");
  });

  it("always sets target=_blank and rel=noopener noreferrer", () => {
    render(<ExternalLink href="https://example.com">Click</ExternalLink>);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows ExternalLink icon by default", () => {
    const { container } = render(
      <ExternalLink href="https://example.com">Link</ExternalLink>,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("hides icon when showIcon is false", () => {
    const { container } = render(
      <ExternalLink href="https://example.com" showIcon={false}>
        Link
      </ExternalLink>,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeNull();
  });

  it("uses default icon size (h-3.5 w-3.5)", () => {
    const { container } = render(
      <ExternalLink href="https://example.com">Link</ExternalLink>,
    );
    const svg = container.querySelector("svg");
    const classes = svg?.getAttribute("class") ?? "";
    expect(classes).toContain("h-3.5");
    expect(classes).toContain("w-3.5");
  });

  it("uses small icon size when iconSize=sm", () => {
    const { container } = render(
      <ExternalLink href="https://example.com" iconSize="sm">
        Link
      </ExternalLink>,
    );
    const svg = container.querySelector("svg");
    const classes = svg?.getAttribute("class") ?? "";
    expect(classes).toMatch(/\bh-3\b/);
    expect(classes).toMatch(/\bw-3\b/);
  });

  it("applies hover:underline by default", () => {
    const { container } = render(
      <ExternalLink href="https://example.com">Link</ExternalLink>,
    );
    const link = container.querySelector("a");
    expect(link?.className).toContain("hover:underline");
  });

  it("merges custom className", () => {
    const { container } = render(
      <ExternalLink href="https://example.com" className="text-primary font-bold">
        Link
      </ExternalLink>,
    );
    const link = container.querySelector("a");
    expect(link?.className).toContain("text-primary");
    expect(link?.className).toContain("font-bold");
    expect(link?.className).toContain("hover:underline");
  });

  it("passes additional HTML attributes", () => {
    render(
      <ExternalLink href="https://example.com" title="Go to example">
        Link
      </ExternalLink>,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("title", "Go to example");
  });

  it("renders children correctly", () => {
    render(
      <ExternalLink href="https://example.com">
        <span data-testid="child">Custom child</span>
      </ExternalLink>,
    );
    expect(screen.getByTestId("child")).toBeTruthy();
    expect(screen.getByText("Custom child")).toBeTruthy();
  });
});
