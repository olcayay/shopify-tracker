import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VelocityCell } from "@/components/velocity-cell";

describe("VelocityCell", () => {
  it("renders dash for null value", () => {
    render(<VelocityCell value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders dash for undefined value", () => {
    render(<VelocityCell value={undefined} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders '0' for zero value", () => {
    render(<VelocityCell value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders positive value with + prefix", () => {
    render(<VelocityCell value={5} />);
    expect(screen.getByText("+5")).toBeInTheDocument();
  });

  it("renders large positive value with + prefix", () => {
    render(<VelocityCell value={100} />);
    expect(screen.getByText("+100")).toBeInTheDocument();
  });

  it("renders decimal value with + prefix", () => {
    render(<VelocityCell value={2.5} />);
    expect(screen.getByText("+2.5")).toBeInTheDocument();
  });

  it("applies muted styling for null value", () => {
    const { container } = render(<VelocityCell value={null} />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("text-muted-foreground");
  });
});
