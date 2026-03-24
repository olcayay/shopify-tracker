import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VisibilityScorePopover } from "@/components/visibility-score-popover";

describe("VisibilityScorePopover", () => {
  const defaultProps = {
    visibilityScore: 85,
    keywordCount: 12,
    visibilityRaw: 342.5,
  };

  it("renders the trigger children", () => {
    render(
      <VisibilityScorePopover {...defaultProps}>
        <button>View Visibility</button>
      </VisibilityScorePopover>
    );
    expect(screen.getByText("View Visibility")).toBeInTheDocument();
  });

  it("shows the visibility score in the popover", async () => {
    const user = userEvent.setup();
    render(
      <VisibilityScorePopover {...defaultProps}>
        <button>View Visibility</button>
      </VisibilityScorePopover>
    );

    await user.click(screen.getByText("View Visibility"));

    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("Visibility Score")).toBeInTheDocument();
  });

  it("shows keyword count in step 1", async () => {
    const user = userEvent.setup();
    render(
      <VisibilityScorePopover {...defaultProps}>
        <button>View Visibility</button>
      </VisibilityScorePopover>
    );

    await user.click(screen.getByText("View Visibility"));

    expect(screen.getByText(/Ranked on 12 keywords/)).toBeInTheDocument();
  });

  it("shows raw score in step 5", async () => {
    const user = userEvent.setup();
    render(
      <VisibilityScorePopover {...defaultProps}>
        <button>View Visibility</button>
      </VisibilityScorePopover>
    );

    await user.click(screen.getByText("View Visibility"));

    expect(screen.getByText(/Raw score: 342.5/)).toBeInTheDocument();
  });

  it("handles singular keyword count", async () => {
    const user = userEvent.setup();
    render(
      <VisibilityScorePopover
        visibilityScore={10}
        keywordCount={1}
        visibilityRaw={5.2}
      >
        <button>View Visibility</button>
      </VisibilityScorePopover>
    );

    await user.click(screen.getByText("View Visibility"));

    expect(screen.getByText(/Ranked on 1 keyword$/)).toBeInTheDocument();
  });

  it("shows rank weight explanation", async () => {
    const user = userEvent.setup();
    render(
      <VisibilityScorePopover {...defaultProps}>
        <button>View Visibility</button>
      </VisibilityScorePopover>
    );

    await user.click(screen.getByText("View Visibility"));

    expect(screen.getByText(/Rank 1 → 100%/)).toBeInTheDocument();
  });
});
