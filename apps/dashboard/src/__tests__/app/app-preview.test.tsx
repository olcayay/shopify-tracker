import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { mockAuthContext } from "../test-utils";

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockFetchWithAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: mockBack,
    prefetch: vi.fn(),
  }),
  usePathname: () => "/shopify/apps/test-app/preview",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ platform: "shopify", slug: "test-app" }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    ...mockAuthContext,
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

vi.mock("@/components/skeletons", () => ({
  CardSkeleton: () => <div data-testid="card-skeleton">Loading...</div>,
}));

vi.mock("@/lib/platform-urls", () => ({
  buildExternalAppUrl: (p: string, slug: string) =>
    `https://example.com/${p}/apps/${slug}`,
  getPlatformName: (p: string) => p.charAt(0).toUpperCase() + p.slice(1),
}));

vi.mock(
  "@/app/(dashboard)/[platform]/apps/[slug]/preview/shopify-preview",
  () => ({
    ShopifyPreview: ({ appData }: any) => ({
      preview: (
        <div data-testid="shopify-preview">Preview: {appData?.name}</div>
      ),
      editor: <div data-testid="shopify-editor">Editor</div>,
      resetToOriginal: vi.fn(),
    }),
  })
);

vi.mock(
  "@/app/(dashboard)/[platform]/apps/[slug]/preview/salesforce-preview",
  () => ({
    SalesforcePreview: () => ({
      preview: <div>SF</div>,
      editor: null,
      resetToOriginal: vi.fn(),
    }),
  })
);

vi.mock(
  "@/app/(dashboard)/[platform]/apps/[slug]/preview/canva-preview",
  () => ({
    CanvaPreview: () => ({
      preview: <div>Canva</div>,
      editor: null,
      resetToOriginal: vi.fn(),
    }),
  })
);

import PreviewPage from "@/app/(dashboard)/[platform]/apps/[slug]/preview/page";

describe("PreviewPage close button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  function setupAppData() {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ slug: "test-app", name: "Test App", iconUrl: null }),
    });
  }

  async function clickCloseButton() {
    // The close button is a ghost variant icon-only button with an SVG (XIcon)
    // It's the last button in the header bar
    const buttons = screen.getAllByRole("button");
    // Reset button has text "Reset", close button is icon-only after it
    const resetIdx = buttons.findIndex((b) => b.textContent?.includes("Reset"));
    const closeBtn = resetIdx >= 0 ? buttons[resetIdx + 1] : buttons[buttons.length - 1];
    fireEvent.click(closeBtn);
  }

  it("returns to saved tab from localStorage when available", async () => {
    localStorage.setItem("app-tab-test-app", "/shopify/apps/v2/test-app/competitors");

    setupAppData();
    render(<PreviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Test App")).toBeInTheDocument();
    });

    await clickCloseButton();

    expect(mockPush).toHaveBeenCalledWith("/shopify/apps/v2/test-app/competitors");
  });

  it("falls back to base app URL when no saved tab", async () => {
    setupAppData();
    render(<PreviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Test App")).toBeInTheDocument();
    });

    await clickCloseButton();

    // Should go to the base app URL (overview) with version prefix
    expect(mockPush).toHaveBeenCalledWith("/shopify/apps/v2/test-app");
  });

  it("ignores saved tab that does not start with base URL", async () => {
    localStorage.setItem("app-tab-test-app", "/other-platform/apps/v2/other-app/details");

    setupAppData();
    render(<PreviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Test App")).toBeInTheDocument();
    });

    await clickCloseButton();

    // Should fall back to base URL since saved tab doesn't match
    expect(mockPush).toHaveBeenCalledWith("/shopify/apps/v2/test-app");
  });

  it("does not loop back to preview when localStorage has preview URL saved", async () => {
    // This is the bug scenario: app-nav.tsx saved the preview URL to localStorage,
    // so closePreview() would navigate back to preview instead of away from it
    localStorage.setItem("app-tab-test-app", "/shopify/apps/v2/test-app/preview");

    setupAppData();
    render(<PreviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Test App")).toBeInTheDocument();
    });

    await clickCloseButton();

    // Should fall back to base URL, NOT navigate back to preview
    expect(mockPush).toHaveBeenCalledWith("/shopify/apps/v2/test-app");
    expect(mockPush).not.toHaveBeenCalledWith("/shopify/apps/v2/test-app/preview");
  });
});
