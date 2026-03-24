import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PowerScorePopover, WeightedPowerPopover } from "@/components/power-score-popover";

describe("PowerScorePopover", () => {
  const defaultProps = {
    powerScore: 72,
    ratingScore: 0.85,
    reviewScore: 0.6,
    categoryScore: 0.7,
    momentumScore: 0.4,
    position: 3,
    totalApps: 50,
  };

  it("renders the trigger children", () => {
    render(
      <PowerScorePopover {...defaultProps}>
        <button>View Score</button>
      </PowerScorePopover>
    );
    expect(screen.getByText("View Score")).toBeInTheDocument();
  });

  it("shows the power score value in the popover", async () => {
    const user = userEvent.setup();
    render(
      <PowerScorePopover {...defaultProps}>
        <button>View Score</button>
      </PowerScorePopover>
    );

    await user.click(screen.getByText("View Score"));

    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("Power Score")).toBeInTheDocument();
  });

  it("shows position info when position and totalApps are provided", async () => {
    const user = userEvent.setup();
    render(
      <PowerScorePopover {...defaultProps}>
        <button>View Score</button>
      </PowerScorePopover>
    );

    await user.click(screen.getByText("View Score"));

    expect(screen.getByText("(#3/50)")).toBeInTheDocument();
  });

  it("shows score breakdown bars", async () => {
    const user = userEvent.setup();
    render(
      <PowerScorePopover {...defaultProps}>
        <button>View Score</button>
      </PowerScorePopover>
    );

    await user.click(screen.getByText("View Score"));

    expect(screen.getByText("Rating")).toBeInTheDocument();
    expect(screen.getByText("Review Auth.")).toBeInTheDocument();
    expect(screen.getByText("Category Rank")).toBeInTheDocument();
    expect(screen.getByText("Momentum")).toBeInTheDocument();
  });

  it("hides rating and review bars when hasReviews is false", async () => {
    const user = userEvent.setup();
    render(
      <PowerScorePopover {...defaultProps} hasReviews={false}>
        <button>View Score</button>
      </PowerScorePopover>
    );

    await user.click(screen.getByText("View Score"));

    expect(screen.queryByText("Rating")).not.toBeInTheDocument();
    expect(screen.queryByText("Review Auth.")).not.toBeInTheDocument();
    expect(screen.getByText("Category Rank")).toBeInTheDocument();
  });
});

describe("WeightedPowerPopover", () => {
  it("renders weighted power score", async () => {
    const user = userEvent.setup();
    render(
      <WeightedPowerPopover
        weightedPowerScore={65}
        powerCategories={[
          {
            title: "Marketing",
            powerScore: 70,
            appCount: 30,
            position: 5,
            ratingScore: 0.8,
            reviewScore: 0.6,
            categoryScore: 0.7,
            momentumScore: 0.5,
          },
        ]}
      >
        <button>View Weighted</button>
      </WeightedPowerPopover>
    );

    await user.click(screen.getByText("View Weighted"));

    expect(screen.getByText("65")).toBeInTheDocument();
    expect(screen.getByText("Weighted Power")).toBeInTheDocument();
    expect(screen.getByText("Marketing")).toBeInTheDocument();
  });
});
