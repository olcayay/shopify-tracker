import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RANKINGS_DATE_RANGE_STORAGE_KEY } from "@/lib/rankings-date-range";

const mockReplace = vi.fn();
let mockPathname = "/shopify/apps/test-app/rankings";
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
  useParams: () => ({}),
}));

import { RankingsDatePicker } from "@/components/rankings-date-picker";

describe("RankingsDatePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockPathname = "/shopify/apps/test-app/rankings";
    mockSearchParams = new URLSearchParams();
  });

  it("renders all preset options", () => {
    render(<RankingsDatePicker />);

    expect(screen.getByRole("button", { name: "Last month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last 3 months" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last 6 months" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last year" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Custom range/ })).toBeInTheDocument();
  });

  it("updates the URL and localStorage when a preset is selected", async () => {
    render(<RankingsDatePicker />);

    fireEvent.click(screen.getByRole("button", { name: "Last 3 months" }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/shopify/apps/test-app/rankings?days=90");
    });
    expect(localStorage.getItem(RANKINGS_DATE_RANGE_STORAGE_KEY)).toContain("\"preset\":\"90d\"");
  });

  it("validates custom ranges before applying them", async () => {
    render(<RankingsDatePicker />);

    fireEvent.click(screen.getByRole("button", { name: /Custom range/ }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-10" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply range" }));

    expect(await screen.findByText("Start date must be on or before the end date.")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("applies a custom range to the URL and localStorage", async () => {
    render(<RankingsDatePicker />);

    fireEvent.click(screen.getByRole("button", { name: /Custom range/ }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-02-10" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-02-28" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply range" }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/shopify/apps/test-app/rankings?from=2026-02-10&to=2026-02-28"
      );
    });
    expect(localStorage.getItem(RANKINGS_DATE_RANGE_STORAGE_KEY)).toContain("\"preset\":\"custom\"");
  });

  it("restores the saved selection from localStorage when the URL has no explicit params", async () => {
    localStorage.setItem(
      RANKINGS_DATE_RANGE_STORAGE_KEY,
      JSON.stringify({
        preset: "180d",
        from: "2025-10-14",
        to: "2026-04-11",
        days: 180,
      })
    );

    render(<RankingsDatePicker />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/shopify/apps/test-app/rankings?days=180");
    });
  });
});
