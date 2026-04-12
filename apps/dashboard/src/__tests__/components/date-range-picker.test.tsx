import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  RANKINGS_DATE_RANGE_CONFIG,
  REVIEW_TREND_DATE_RANGE_CONFIG,
  type DateRangeConfig,
} from "@/lib/date-range";

const mockReplace = vi.fn();
let mockPathname = "/";
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

import { DateRangePicker } from "@/components/ui/date-range-picker";

function openPicker() {
  fireEvent.click(screen.getByRole("button", { expanded: false }));
}

function run(name: string, config: DateRangeConfig, pathname: string) {
  describe(`DateRangePicker (${name})`, () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
      mockPathname = pathname;
      mockSearchParams = new URLSearchParams();
    });

    it("shows the current selection on the trigger and reveals preset options when opened", () => {
      render(<DateRangePicker config={config} />);

      openPicker();

      for (const preset of config.presets) {
        expect(screen.getAllByRole("button", { name: new RegExp(preset.label) }).length).toBeGreaterThanOrEqual(1);
      }
      expect(screen.getByRole("button", { name: /Custom range/ })).toBeInTheDocument();
    });

    it("updates the URL and localStorage when a preset is selected", async () => {
      const preset = config.presets[2]; // "Last 6 months"
      render(<DateRangePicker config={config} />);

      openPicker();
      fireEvent.click(screen.getByRole("button", { name: preset.label }));

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(`${pathname}?${config.params.days}=${preset.days}`);
      });
      expect(localStorage.getItem(config.storageKey)).toContain(`"preset":"${preset.value}"`);
    });

    it("validates custom ranges before applying them", async () => {
      render(<DateRangePicker config={config} />);

      openPicker();
      fireEvent.click(screen.getByRole("button", { name: /Custom range/ }));
      fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-10" } });
      fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-01" } });
      fireEvent.click(screen.getByRole("button", { name: "Apply range" }));

      expect(
        await screen.findByText("Start date must be on or before the end date.")
      ).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("applies a custom range to the URL and localStorage", async () => {
      render(<DateRangePicker config={config} />);

      openPicker();
      fireEvent.click(screen.getByRole("button", { name: /Custom range/ }));
      fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-02-10" } });
      fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-02-28" } });
      fireEvent.click(screen.getByRole("button", { name: "Apply range" }));

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(
          `${pathname}?${config.params.from}=2026-02-10&${config.params.to}=2026-02-28`
        );
      });
      expect(localStorage.getItem(config.storageKey)).toContain('"preset":"custom"');
    });

    it("restores the saved selection from localStorage when the URL has no explicit params", async () => {
      localStorage.setItem(
        config.storageKey,
        JSON.stringify({ preset: "180d", from: "2025-10-14", to: "2026-04-11", days: 180 })
      );

      render(<DateRangePicker config={config} />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(`${pathname}?${config.params.days}=180`);
      });
    });
  });
}

run("rankings", RANKINGS_DATE_RANGE_CONFIG, "/shopify/apps/test-app/rankings");
run("review trend", REVIEW_TREND_DATE_RANGE_CONFIG, "/shopify/apps/test-app/reviews");
