import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupAuthMock } from "../test-utils";

describe("AppSearchBar", () => {
  // A default mock that always returns a valid response, so debounced
  // fetches that fire after a test ends don't cause unhandled rejections.
  const safeFetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  });

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupAuthMock({ fetchWithAuth: safeFetchMock });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderComponent(props: Record<string, unknown> = {}) {
    const { AppSearchBar } = await import("@/components/app-search-bar");
    return render(<AppSearchBar mode="follow" {...props} />);
  }

  it("renders search input with default placeholder", async () => {
    await renderComponent();
    expect(screen.getByPlaceholderText("Search apps...")).toBeInTheDocument();
  });

  it("renders search input with custom placeholder", async () => {
    await renderComponent({ placeholder: "Find an app..." });
    expect(screen.getByPlaceholderText("Find an app...")).toBeInTheDocument();
  });

  it("updates input value when user types", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderComponent();
    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "test");
    expect(input).toHaveValue("test");
  });

  it("calls fetchWithAuth when user types a query", async () => {
    const mockFetchWithAuth = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.resetModules();
    setupAuthMock({ fetchWithAuth: mockFetchWithAuth });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { AppSearchBar } = await import("@/components/app-search-bar");
    render(<AppSearchBar mode="follow" />);

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "test");

    // Advance past the 300ms debounce
    await vi.advanceTimersByTimeAsync(400);

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/apps/search?q=")
    );
  });

  it("shows suggestions when results are returned", async () => {
    const mockFetchWithAuth = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            slug: "test-app",
            name: "Test App",
            averageRating: 4.5,
            ratingCount: 100,
          },
        ]),
    });
    vi.resetModules();
    setupAuthMock({ fetchWithAuth: mockFetchWithAuth });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { AppSearchBar } = await import("@/components/app-search-bar");
    render(<AppSearchBar mode="follow" />);

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "test");

    await vi.advanceTimersByTimeAsync(400);

    await vi.waitFor(
      () => {
        expect(screen.getByText("Test App")).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it("shows 'Following' label for already tracked apps", async () => {
    const mockFetchWithAuth = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            slug: "tracked-app",
            name: "Tracked App",
            averageRating: 4.0,
            ratingCount: 50,
          },
        ]),
    });
    vi.resetModules();
    setupAuthMock({ fetchWithAuth: mockFetchWithAuth });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { AppSearchBar } = await import("@/components/app-search-bar");
    render(
      <AppSearchBar
        mode="follow"
        trackedSlugs={new Set(["tracked-app"])}
      />
    );

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "tracked");

    await vi.advanceTimersByTimeAsync(400);

    await vi.waitFor(
      () => {
        expect(screen.getByText("Following")).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });
});
