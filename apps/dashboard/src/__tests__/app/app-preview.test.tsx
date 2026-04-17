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
    // Default: simulate in-app navigation (history > 1, same-origin referrer)
    Object.defineProperty(window, "history", {
      writable: true,
      value: { length: 3 },
    });
    Object.defineProperty(document, "referrer", {
      writable: true,
      configurable: true,
      value: window.location.origin + "/shopify/apps/test-app/compare",
    });
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

  it("calls router.back() when user came from within the app", async () => {
    setupAppData();
    render(<PreviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Test App")).toBeInTheDocument();
    });

    await clickCloseButton();

    expect(mockBack).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls router.push() when there is no in-app referrer (direct visit)", async () => {
    Object.defineProperty(window, "history", {
      writable: true,
      value: { length: 1 },
    });
    Object.defineProperty(document, "referrer", {
      writable: true,
      configurable: true,
      value: "",
    });

    setupAppData();
    render(<PreviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Test App")).toBeInTheDocument();
    });

    await clickCloseButton();

    expect(mockPush).toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("calls router.push() when referrer is from a different origin", async () => {
    Object.defineProperty(document, "referrer", {
      writable: true,
      configurable: true,
      value: "https://external-site.com/page",
    });

    setupAppData();
    render(<PreviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Test App")).toBeInTheDocument();
    });

    await clickCloseButton();

    expect(mockPush).toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });
});
