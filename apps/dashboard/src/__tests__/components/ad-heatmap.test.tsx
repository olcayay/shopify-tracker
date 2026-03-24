import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("Less")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
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
});
