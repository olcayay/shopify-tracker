import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CopyButton } from "@/components/ui/copy-button";

const mockWriteText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText: mockWriteText },
  });
});

describe("CopyButton", () => {
  it("renders icon-only variant by default", () => {
    const { container } = render(<CopyButton value="test" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("copies value to clipboard when clicked", async () => {
    render(<CopyButton value="hello world" />);
    const button = screen.getByTitle("Copy");
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("hello world");
    });
  });

  it("shows checkmark after copying", async () => {
    render(<CopyButton value="test" />);
    const button = screen.getByTitle("Copy");
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByTitle("Copied!")).toBeTruthy();
    });
  });

  it("renders button variant with label", () => {
    render(<CopyButton value="test" variant="button" label="Copy Code" />);
    expect(screen.getByText("Copy Code")).toBeTruthy();
  });

  it("shows Copied! text in button variant after clicking", async () => {
    render(<CopyButton value="test" variant="button" />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeTruthy();
    });
  });

  it("stops event propagation", () => {
    const parentClick = vi.fn();
    const { container } = render(
      <div onClick={parentClick}>
        <CopyButton value="test" />
      </div>,
    );
    const button = container.querySelector("button")!;
    fireEvent.click(button);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("accepts custom className", () => {
    const { container } = render(<CopyButton value="test" className="custom-class" />);
    const button = container.querySelector("button");
    expect(button?.className).toContain("custom-class");
  });
});
