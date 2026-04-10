import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupAuthMock } from "../test-utils";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe("GlobalAppSearch", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    setupAuthMock({ fetchWithAuth: mockFetch });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderComponent(props: Record<string, unknown> = {}) {
    const { GlobalAppSearch } = await import(
      "@/components/global-app-search"
    );
    return render(<GlobalAppSearch mode="track" {...props} />);
  }

  it("renders search input", async () => {
    await renderComponent();
    expect(
      screen.getByPlaceholderText("Search all apps...")
    ).toBeInTheDocument();
  });

  it("calls /api/public/apps/search with correct prefix", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            slug: "jotform",
            name: "Jotform",
            iconUrl: null,
            platform: "shopify",
            averageRating: 4.5,
            ratingCount: 100,
            pricingHint: "Free",
          },
        ]),
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderComponent();

    const input = screen.getByPlaceholderText("Search all apps...");
    await user.type(input, "jotform");

    await vi.advanceTimersByTimeAsync(400);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/public/apps/search?q=jotform&limit=10"
    );
  });

  it("does not search when query is less than 2 characters", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderComponent();

    const input = screen.getByPlaceholderText("Search all apps...");
    await user.type(input, "a");

    await vi.advanceTimersByTimeAsync(400);

    const searchCalls = mockFetch.mock.calls.filter(
      (c: unknown[]) =>
        typeof c[0] === "string" && c[0].includes("/api/public/apps/search")
    );
    expect(searchCalls.length).toBe(0);
  });

  it("shows results when search returns data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            slug: "slack",
            name: "Slack",
            iconUrl: "https://cdn.example.com/slack.png",
            platform: "shopify",
            averageRating: 4.5,
            ratingCount: 1200,
            pricingHint: "Free",
          },
        ]),
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderComponent();

    const input = screen.getByPlaceholderText("Search all apps...");
    await user.type(input, "slack");

    await vi.advanceTimersByTimeAsync(400);

    await vi.waitFor(
      () => {
        expect(screen.getByText("Slack")).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });
});
