import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { mockAuthContext } from "../../test-utils";

const mockFetchWithAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/shopify/apps/v2/test-app/studio/preview",
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
  buildExternalAppUrl: (p: string, slug: string) => `https://example.com/${p}/apps/${slug}`,
  getPlatformName: (p: string) => p.charAt(0).toUpperCase() + p.slice(1),
}));

vi.mock(
  "@/app/(dashboard)/[platform]/apps/[slug]/preview/shopify-preview",
  () => ({
    ShopifyPreview: ({ appData }: any) => ({
      preview: <div data-testid="shopify-preview">Preview: {appData?.name}</div>,
      editor: <div data-testid="shopify-editor">Editor</div>,
      resetToOriginal: vi.fn(),
    }),
  })
);

vi.mock(
  "@/app/(dashboard)/[platform]/apps/[slug]/preview/salesforce-preview",
  () => ({
    SalesforcePreview: ({ appData }: any) => ({
      preview: <div data-testid="salesforce-preview">SF Preview: {appData?.name}</div>,
      editor: <div data-testid="salesforce-editor">SF Editor</div>,
      resetToOriginal: vi.fn(),
    }),
  })
);

vi.mock(
  "@/app/(dashboard)/[platform]/apps/[slug]/preview/canva-preview",
  () => ({
    CanvaPreview: ({ appData }: any) => ({
      preview: <div data-testid="canva-preview">Canva Preview: {appData?.name}</div>,
      editor: <div data-testid="canva-editor">Canva Editor</div>,
      resetToOriginal: vi.fn(),
    }),
  })
);

import V2PreviewPage from "@/app/(dashboard)/[platform]/apps/v2/[slug]/studio/preview/page";

describe("V2PreviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton while fetching data", () => {
    mockFetchWithAuth.mockReturnValue(new Promise(() => {})); // never resolves
    render(<V2PreviewPage />);
    expect(screen.getByTestId("card-skeleton")).toBeInTheDocument();
  });

  it("renders Live Preview heading after successful load", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ slug: "test-app", name: "Test App" }),
    });
    render(<V2PreviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Live Preview")).toBeInTheDocument();
    });
  });

  it("renders Reset and Refresh buttons after load", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ slug: "test-app", name: "Test App" }),
    });
    render(<V2PreviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
      expect(screen.getByText("Reset")).toBeInTheDocument();
    });
  });

  it("shows Shopify preview component for shopify platform", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ slug: "test-app", name: "Test App" }),
    });
    render(<V2PreviewPage />);
    await waitFor(() => {
      expect(screen.getByTestId("shopify-preview")).toBeInTheDocument();
    });
    expect(screen.getByText("Preview: Test App")).toBeInTheDocument();
  });

  it("shows error message when API returns non-ok", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false });
    render(<V2PreviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Failed to load app data.")).toBeInTheDocument();
    });
  });
});
