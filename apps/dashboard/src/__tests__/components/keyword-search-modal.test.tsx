import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupAuthMock } from "../test-utils";

describe("KeywordSearchModal", () => {
  let mockFetchWithAuth: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    mockFetchWithAuth = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/keywords/search")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: 1, keyword: "seo tools", slug: "seo-tools" },
              { id: 2, keyword: "seo analyzer", slug: "seo-analyzer" },
            ]),
        });
      }
      if (url === "/api/keywords") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 1, keyword: "seo tools" }]),
        });
      }
      if (url === "/api/account/tracked-apps") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { appSlug: "my-app", appName: "My App" },
            ]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    setupAuthMock({ fetchWithAuth: mockFetchWithAuth });

    vi.doMock("next/navigation", async () => {
      const original = await vi.importActual("next/navigation");
      return {
        ...original,
        useParams: () => ({ platform: "shopify" }),
        useRouter: () => ({
          push: vi.fn(),
          replace: vi.fn(),
          refresh: vi.fn(),
          back: vi.fn(),
          prefetch: vi.fn(),
        }),
        usePathname: () => "/shopify/keywords",
        useSearchParams: () => new URLSearchParams(),
      };
    });
  });

  async function renderComponent(props: Record<string, unknown> = {}) {
    const { KeywordSearchModal } = await import(
      "@/components/keyword-search-modal"
    );
    return render(<KeywordSearchModal {...props} />);
  }

  it("renders the search button when modal is closed", async () => {
    await renderComponent();
    expect(screen.getByText("Search Keywords")).toBeInTheDocument();
  });

  it("opens modal when button is clicked", async () => {
    const user = userEvent.setup();
    await renderComponent({ trackedAppSlug: "my-app" });

    await user.click(screen.getByText("Search Keywords"));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Search keywords...")
      ).toBeInTheDocument();
    });
  });

  it("shows usage count in footer", async () => {
    const user = userEvent.setup();
    await renderComponent({ trackedAppSlug: "my-app" });

    await user.click(screen.getByText("Search Keywords"));

    await waitFor(() => {
      expect(screen.getByText(/10\/50 keywords tracked/)).toBeInTheDocument();
    });
  });

  it("shows search results when user types", async () => {
    const user = userEvent.setup();
    await renderComponent({ trackedAppSlug: "my-app" });

    await user.click(screen.getByText("Search Keywords"));

    const input = await screen.findByPlaceholderText("Search keywords...");
    await user.type(input, "seo");

    await waitFor(
      () => {
        expect(screen.getByText("seo tools")).toBeInTheDocument();
        expect(screen.getByText("seo analyzer")).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it("shows Tracked badge for already-tracked keywords", async () => {
    const user = userEvent.setup();
    await renderComponent({ trackedAppSlug: "my-app" });

    await user.click(screen.getByText("Search Keywords"));

    const input = await screen.findByPlaceholderText("Search keywords...");
    await user.type(input, "seo");

    await waitFor(
      () => {
        // ID 1 is tracked, so "Tracked" badge should appear
        expect(screen.getByText("Tracked")).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it("shows Track button for untracked keywords", async () => {
    const user = userEvent.setup();
    await renderComponent({ trackedAppSlug: "my-app" });

    await user.click(screen.getByText("Search Keywords"));

    const input = await screen.findByPlaceholderText("Search keywords...");
    await user.type(input, "seo");

    await waitFor(
      () => {
        // ID 2 is not tracked, so Track button should appear
        const trackButtons = screen.getAllByText("Track");
        expect(trackButtons.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 1000 }
    );
  });
});
