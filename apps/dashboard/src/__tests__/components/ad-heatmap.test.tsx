import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdHeatmap } from "@/components/ad-heatmap";

const today = new Date().toISOString().slice(0, 10);

const mockSightings = [
  {
    slug: "app-1",
    name: "App One",
    seenDate: today,
    timesSeenInDay: 3,
    iconUrl: "https://example.com/icon1.png",
  },
  {
    slug: "app-2",
    name: "App Two",
    seenDate: today,
    timesSeenInDay: 1,
  },
];

describe("AdHeatmap", () => {
  it("renders heatmap with app names", () => {
    render(<AdHeatmap sightings={mockSightings} />);
    expect(screen.getByText("App One")).toBeInTheDocument();
    expect(screen.getByText("App Two")).toBeInTheDocument();
  });

  it("returns null for empty sightings", () => {
    const { container } = render(<AdHeatmap sightings={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the intensity legend", () => {
    render(<AdHeatmap sightings={mockSightings} />);
    expect(screen.getByText("Not seen")).toBeInTheDocument();
    expect(screen.getByText("Seen")).toBeInTheDocument();
  });

  it("shows tracked badge for tracked apps", () => {
    render(
      <AdHeatmap
        sightings={mockSightings}
        trackedSlugs={["app-1"]}
      />
    );
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("shows competitor badge for competitor apps", () => {
    render(
      <AdHeatmap
        sightings={mockSightings}
        competitorSlugs={["app-2"]}
      />
    );
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("shows 'Show all' button when initialVisible limits rows", () => {
    render(
      <AdHeatmap
        sightings={mockSightings}
        initialVisible={1}
      />
    );
    expect(screen.getByText(/Show all 2 apps/)).toBeInTheDocument();
  });

  // Time navigation tests
  it("renders navigation controls with date range", () => {
    render(<AdHeatmap sightings={mockSightings} />);
    expect(screen.getByLabelText("Previous period")).toBeInTheDocument();
    expect(screen.getByLabelText("Next period")).toBeInTheDocument();
    expect(screen.getByText("Older")).toBeInTheDocument();
    expect(screen.getByText("Newer")).toBeInTheDocument();
    // Date range label should be visible
    expect(screen.getByText(/—/)).toBeInTheDocument();
  });

  it("disables 'Newer' button when at current period (offset=0)", () => {
    render(<AdHeatmap sightings={mockSightings} />);
    const newerBtn = screen.getByLabelText("Next period");
    expect(newerBtn).toBeDisabled();
  });

  it("enables 'Newer' button after navigating to older period", () => {
    render(<AdHeatmap sightings={mockSightings} />);
    const olderBtn = screen.getByLabelText("Previous period");
    fireEvent.click(olderBtn);
    const newerBtn = screen.getByLabelText("Next period");
    expect(newerBtn).not.toBeDisabled();
  });

  it("navigates back and forward through time periods", () => {
    render(<AdHeatmap sightings={mockSightings} />);
    const dateRangeText = screen.getByText(/—/).textContent!;

    // Go to older period
    fireEvent.click(screen.getByLabelText("Previous period"));
    const olderDateRange = screen.getByText(/—/).textContent!;
    expect(olderDateRange).not.toBe(dateRangeText);

    // Go back to newer
    fireEvent.click(screen.getByLabelText("Next period"));
    const restoredDateRange = screen.getByText(/—/).textContent!;
    expect(restoredDateRange).toBe(dateRangeText);
  });

  it("hides navigation when hideNavigation is true", () => {
    render(<AdHeatmap sightings={mockSightings} hideNavigation />);
    expect(screen.queryByLabelText("Previous period")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Next period")).not.toBeInTheDocument();
  });
});
