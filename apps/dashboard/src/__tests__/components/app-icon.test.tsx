import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("lucide-react", () => ({
  Package: () => <svg data-testid="package-icon" />,
}));

import { AppIcon } from "../../components/app-icon";

describe("AppIcon", () => {
  it("renders img tag when src is provided", () => {
    const { container } = render(<AppIcon src="https://example.com/icon.png" />);
    const img = container.querySelector("img")!;
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/icon.png");
  });

  it("renders fallback Package icon when src is null", () => {
    render(<AppIcon src={null} />);
    expect(screen.getByTestId("package-icon")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders fallback Package icon when src is undefined", () => {
    render(<AppIcon src={undefined} />);
    expect(screen.getByTestId("package-icon")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders fallback Package icon when src is empty string", () => {
    render(<AppIcon src="" />);
    expect(screen.getByTestId("package-icon")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows fallback after onError event", () => {
    const { container } = render(<AppIcon src="https://example.com/broken.png" />);
    const img = container.querySelector("img")!;
    expect(img).toBeInTheDocument();

    fireEvent.error(img);

    expect(screen.getByTestId("package-icon")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("applies className to img", () => {
    const { container } = render(<AppIcon src="https://example.com/icon.png" className="w-10 h-10" />);
    const img = container.querySelector("img")!;
    expect(img.className).toContain("w-10 h-10");
  });

  it("applies className to fallback div", () => {
    const { container } = render(<AppIcon src={null} className="w-10 h-10" />);
    const fallbackDiv = container.firstChild as HTMLElement;
    expect(fallbackDiv.className).toContain("w-10 h-10");
  });

  it("sets alt attribute on img", () => {
    render(<AppIcon src="https://example.com/icon.png" alt="My App" />);
    const img = screen.getByRole("img", { name: "My App" });
    expect(img).toHaveAttribute("alt", "My App");
  });
});
