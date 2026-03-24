import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupAuthMock } from "../test-utils";

const mockSuggestions = {
  suggestions: [
    {
      appSlug: "competitor-1",
      appName: "Competitor One",
      iconUrl: "https://example.com/icon1.png",
      averageRating: "4.5",
      ratingCount: 200,
      pricingHint: "$9.99/mo",
      isBuiltForShopify: false,
      isAlreadyCompetitor: false,
      similarity: { overall: 0.75, category: 0.8, feature: 0.7, keyword: 0.6, text: 0.9 },
      categoryRanks: [{ categorySlug: "productivity", position: 5 }],
      isShopifySimilar: true,
    },
    {
      appSlug: "competitor-2",
      appName: "Competitor Two",
      iconUrl: null,
      averageRating: "3.2",
      ratingCount: 50,
      pricingHint: "Free",
      isBuiltForShopify: true,
      isAlreadyCompetitor: true,
      similarity: { overall: 0.45, category: 0.5, feature: 0.4, keyword: 0.3, text: 0.6 },
      categoryRanks: [],
      isShopifySimilar: false,
    },
  ],
};

describe("CompetitorSuggestions", () => {
  let mockFetchWithAuth: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    mockFetchWithAuth = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuggestions),
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
        usePathname: () => "/shopify/apps",
        useSearchParams: () => new URLSearchParams(),
      };
    });
  });

  async function renderComponent(overrides: Record<string, unknown> = {}) {
    const { CompetitorSuggestions } = await import(
      "@/components/competitor-suggestions"
    );
    return render(
      <CompetitorSuggestions
        appSlug="my-app"
        competitorSlugs={new Set()}
        onCompetitorAdded={vi.fn()}
        {...overrides}
      />
    );
  }

  it("renders the suggest competitors button (non-prominent mode)", async () => {
    await renderComponent();
    expect(screen.getByText("Suggest competitors")).toBeInTheDocument();
  });

  it("renders prominent empty state when prominent=true", async () => {
    await renderComponent({ prominent: true });
    // In prominent mode, it auto-opens and loads
    await waitFor(() => {
      expect(screen.getByText("Competitor Suggestions")).toBeInTheDocument();
    });
  });

  it("loads and shows suggestions when button is clicked", async () => {
    const user = userEvent.setup();
    await renderComponent();

    await user.click(screen.getByText("Suggest competitors"));

    await waitFor(() => {
      expect(screen.getByText("Competitor One")).toBeInTheDocument();
      expect(screen.getByText("Competitor Two")).toBeInTheDocument();
    });
  });

  it("shows suggestion count badge", async () => {
    const user = userEvent.setup();
    await renderComponent();

    await user.click(screen.getByText("Suggest competitors"));

    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  it("shows 'Added' for already-competitor suggestions", async () => {
    const user = userEvent.setup();
    await renderComponent();

    await user.click(screen.getByText("Suggest competitors"));

    await waitFor(() => {
      expect(screen.getByText("Added")).toBeInTheDocument();
    });
  });

  it("shows add button for non-competitor suggestions", async () => {
    const user = userEvent.setup();
    await renderComponent();

    await user.click(screen.getByText("Suggest competitors"));

    await waitFor(() => {
      expect(
        screen.getByTitle('Add "Competitor One" as competitor')
      ).toBeInTheDocument();
    });
  });

  it("calls fetchWithAuth to add competitor when add button is clicked", async () => {
    const user = userEvent.setup();
    const onCompetitorAdded = vi.fn();
    await renderComponent({ onCompetitorAdded });

    await user.click(screen.getByText("Suggest competitors"));

    await waitFor(() => {
      expect(screen.getByText("Competitor One")).toBeInTheDocument();
    });

    await user.click(
      screen.getByTitle('Add "Competitor One" as competitor')
    );

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/competitors"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("shows similarity percentage", async () => {
    const user = userEvent.setup();
    await renderComponent();

    await user.click(screen.getByText("Suggest competitors"));

    await waitFor(() => {
      expect(screen.getByText("75%")).toBeInTheDocument();
      expect(screen.getByText("45%")).toBeInTheDocument();
    });
  });

  it("shows empty state when no suggestions available", async () => {
    const user = userEvent.setup();
    vi.resetModules();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ suggestions: [] }),
    });
    setupAuthMock({ fetchWithAuth: mockFetch });
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
        usePathname: () => "/shopify/apps",
        useSearchParams: () => new URLSearchParams(),
      };
    });

    const { CompetitorSuggestions } = await import(
      "@/components/competitor-suggestions"
    );
    render(
      <CompetitorSuggestions
        appSlug="my-app"
        competitorSlugs={new Set()}
        onCompetitorAdded={vi.fn()}
      />
    );

    await user.click(screen.getByText("Suggest competitors"));

    await waitFor(() => {
      expect(
        screen.getByText(/No suggestions available/)
      ).toBeInTheDocument();
    });
  });

  it("shows error message when fetch fails", async () => {
    const user = userEvent.setup();
    vi.resetModules();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    });
    setupAuthMock({ fetchWithAuth: mockFetch });
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
        usePathname: () => "/shopify/apps",
        useSearchParams: () => new URLSearchParams(),
      };
    });

    const { CompetitorSuggestions } = await import(
      "@/components/competitor-suggestions"
    );
    render(
      <CompetitorSuggestions
        appSlug="my-app"
        competitorSlugs={new Set()}
        onCompetitorAdded={vi.fn()}
      />
    );

    await user.click(screen.getByText("Suggest competitors"));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load suggestions")
      ).toBeInTheDocument();
    });
  });
});
