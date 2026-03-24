import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupAuthMock, mockAdminUser } from "../test-utils";

describe("AdminScraperTrigger", () => {
  let mockFetchWithAuth: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    mockFetchWithAuth = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  async function renderComponent(
    props: Record<string, unknown> = {},
    userOverrides: Record<string, unknown> = {}
  ) {
    vi.resetModules();
    setupAuthMock({
      fetchWithAuth: mockFetchWithAuth,
      user: mockAdminUser,
      ...userOverrides,
    });

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
        usePathname: () => "/shopify/categories/marketing",
        useSearchParams: () => new URLSearchParams(),
      };
    });

    const { AdminScraperTrigger } = await import(
      "@/components/admin-scraper-trigger"
    );
    return render(
      <AdminScraperTrigger
        scraperType="category"
        label="Scrape Category"
        {...props}
      />
    );
  }

  it("renders the trigger button for system admins", async () => {
    await renderComponent();
    expect(screen.getByText("Scrape Category")).toBeInTheDocument();
  });

  it("does not render for non-admin users", async () => {
    vi.resetModules();
    setupAuthMock({
      fetchWithAuth: mockFetchWithAuth,
      user: { ...mockAdminUser, isSystemAdmin: false },
    });

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
        usePathname: () => "/shopify/categories/marketing",
        useSearchParams: () => new URLSearchParams(),
      };
    });

    const { AdminScraperTrigger } = await import(
      "@/components/admin-scraper-trigger"
    );
    const { container } = render(
      <AdminScraperTrigger
        scraperType="category"
        label="Scrape Category"
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("opens options modal when button is clicked", async () => {
    const user = userEvent.setup();
    await renderComponent();

    await user.click(screen.getByText("Scrape Category"));

    expect(screen.getByText("Scraper Options")).toBeInTheDocument();
  });

  it("shows pages options for category scraper type", async () => {
    const user = userEvent.setup();
    await renderComponent();

    await user.click(screen.getByText("Scrape Category"));

    expect(screen.getByText("Pages to scrape")).toBeInTheDocument();
    expect(screen.getByText("First page only")).toBeInTheDocument();
    expect(screen.getByText("All pages")).toBeInTheDocument();
  });

  it("calls fetchWithAuth when Start Scraper is clicked", async () => {
    const user = userEvent.setup();
    await renderComponent();

    await user.click(screen.getByText("Scrape Category"));
    await user.click(screen.getByText("Start Scraper"));

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/system-admin/scraper/trigger",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("shows 'Queued!' after successful trigger", async () => {
    const user = userEvent.setup();
    await renderComponent();

    await user.click(screen.getByText("Scrape Category"));
    await user.click(screen.getByText("Start Scraper"));

    await waitFor(() => {
      expect(screen.getByText("Queued!")).toBeInTheDocument();
    });
  });

  it("has cancel button in options modal", async () => {
    const user = userEvent.setup();
    await renderComponent();

    await user.click(screen.getByText("Scrape Category"));

    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("closes modal when cancel is clicked", async () => {
    const user = userEvent.setup();
    await renderComponent();

    await user.click(screen.getByText("Scrape Category"));
    expect(screen.getByText("Scraper Options")).toBeInTheDocument();

    await user.click(screen.getByText("Cancel"));

    // The modal should close, Scraper Options should not be visible
    await waitFor(() => {
      expect(screen.queryByText("Scraper Options")).not.toBeInTheDocument();
    });
  });
});
