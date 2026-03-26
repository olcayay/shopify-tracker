import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CopyReportButton } from "@/components/copy-report-button";

describe("CopyReportButton", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
  });

  it("renders with label", () => {
    render(<CopyReportButton getReport={() => "report"} label="Copy" />);
    expect(screen.getByText("Copy")).toBeTruthy();
  });

  it("renders without label (icon only)", () => {
    const { container } = render(<CopyReportButton getReport={() => "report"} />);
    // Should have a button with no text span
    expect(container.querySelector("button")).toBeTruthy();
    expect(screen.queryByText("Copy")).toBeNull();
  });

  it("copies report text to clipboard on click", async () => {
    render(<CopyReportButton getReport={() => "my debug report"} label="Copy" />);

    fireEvent.click(screen.getByText("Copy"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("my debug report"));
  });

  it("shows Copied! label after clicking", async () => {
    render(<CopyReportButton getReport={() => "report"} label="Copy Report" />);

    fireEvent.click(screen.getByText("Copy Report"));
    await waitFor(() => expect(screen.getByText("Copied!")).toBeTruthy());
  });

  it("calls getReport function on each click", async () => {
    const getReport = vi.fn().mockReturnValue("report content");
    render(<CopyReportButton getReport={getReport} label="Copy" />);

    fireEvent.click(screen.getByText("Copy"));
    await waitFor(() => expect(getReport).toHaveBeenCalledTimes(1));
  });

  it("uses custom className when provided", () => {
    const { container } = render(
      <CopyReportButton getReport={() => ""} className="custom-class" />
    );
    expect(container.querySelector(".custom-class")).toBeTruthy();
  });

  it("uses default className when not provided", () => {
    const { container } = render(<CopyReportButton getReport={() => ""} />);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("text-orange-600");
  });

  it("uses custom title when provided", () => {
    const { container } = render(
      <CopyReportButton getReport={() => ""} title="Custom title" />
    );
    expect(container.querySelector('[title="Custom title"]')).toBeTruthy();
  });

  it("uses default title when not provided", () => {
    const { container } = render(<CopyReportButton getReport={() => ""} />);
    expect(container.querySelector('[title="Copy debug report"]')).toBeTruthy();
  });
});
