import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  mockUser,
  mockViewerUser,
  mockAccount,
  mockAuthContext,
} from "../test-utils";

// Mock redirect
const mockRedirect = vi.fn();

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/shopify/apps/my-app/keywords",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ platform: "shopify", slug: "my-app" }),
  redirect: (...args: any[]) => {
    mockRedirect(...args);
    throw new Error("NEXT_REDIRECT");
  },
}));

// Mock API
const mockGetApp = vi.fn();

vi.mock("@/lib/api", () => ({
  getApp: (...args: any[]) => mockGetApp(...args),
}));

// Mock auth context (used by KeywordsSection)
const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    ...mockAuthContext,
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

// Mock useFormatDate
vi.mock("@/lib/format-date", () => ({
  useFormatDate: () => ({
    formatDateOnly: (d: string) => new Date(d).toLocaleDateString(),
    formatDateTime: (d: string) => new Date(d).toLocaleString(),
  }),
  formatDateOnly: (d: string) => new Date(d).toLocaleDateString(),
  formatDateTime: (d: string) => new Date(d).toLocaleString(),
}));

// Mock KeywordsSection — the complex client component
vi.mock(
  "@/app/(dashboard)/[platform]/apps/[slug]/keywords-section",
  () => ({
    KeywordsSection: ({ appSlug }: { appSlug: string }) => (
      <div data-testid="keywords-section">
        Keywords for {appSlug}
      </div>
    ),
  })
);

import KeywordsPage from "@/app/(dashboard)/[platform]/apps/[slug]/keywords/page";

describe("App KeywordsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders KeywordsSection when app is tracked", async () => {
    mockGetApp.mockResolvedValue({
      slug: "my-app",
      name: "My App",
      isTrackedByAccount: true,
    });

    const page = await KeywordsPage({
      params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
    });
    render(page);
    expect(screen.getByTestId("keywords-section")).toBeInTheDocument();
    expect(screen.getByText("Keywords for my-app")).toBeInTheDocument();
  });

  it("shows 'App not found.' when API throws", async () => {
    mockGetApp.mockRejectedValue(new Error("Not found"));
    const page = await KeywordsPage({
      params: Promise.resolve({ platform: "shopify", slug: "nonexistent" }),
    });
    render(page);
    expect(screen.getByText("App not found.")).toBeInTheDocument();
  });

  it("redirects when app is not tracked", async () => {
    mockGetApp.mockResolvedValue({
      slug: "other-app",
      name: "Other App",
      isTrackedByAccount: false,
    });

    await expect(
      KeywordsPage({
        params: Promise.resolve({ platform: "shopify", slug: "other-app" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/shopify/apps/other-app");
  });

  it("calls getApp with correct slug and platform", async () => {
    mockGetApp.mockResolvedValue({
      slug: "my-app",
      name: "My App",
      isTrackedByAccount: true,
    });

    await KeywordsPage({
      params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
    });

    expect(mockGetApp).toHaveBeenCalledWith("my-app", "shopify");
  });

  it("passes correct appSlug to KeywordsSection", async () => {
    mockGetApp.mockResolvedValue({
      slug: "my-special-app",
      name: "My Special App",
      isTrackedByAccount: true,
    });

    const page = await KeywordsPage({
      params: Promise.resolve({ platform: "shopify", slug: "my-special-app" }),
    });
    render(page);
    expect(screen.getByText("Keywords for my-special-app")).toBeInTheDocument();
  });
});

// Test the KeywordsSection client component separately
describe("KeywordsSection (client component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows keywords section when app is tracked", async () => {
    mockGetApp.mockResolvedValue({
      slug: "my-app",
      name: "My App",
      isTrackedByAccount: true,
    });

    const page = await KeywordsPage({
      params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
    });
    render(page);
    expect(screen.getByTestId("keywords-section")).toBeInTheDocument();
  });

  it("passes correct appSlug to the section component", async () => {
    mockGetApp.mockResolvedValue({
      slug: "another-app",
      name: "Another App",
      isTrackedByAccount: true,
    });

    const page = await KeywordsPage({
      params: Promise.resolve({ platform: "shopify", slug: "another-app" }),
    });
    render(page);
    expect(screen.getByText("Keywords for another-app")).toBeInTheDocument();
  });

  it("handles different platform params", async () => {
    mockGetApp.mockResolvedValue({
      slug: "sf-app",
      name: "SF App",
      isTrackedByAccount: true,
    });

    const page = await KeywordsPage({
      params: Promise.resolve({ platform: "salesforce", slug: "sf-app" }),
    });
    render(page);
    expect(screen.getByText("Keywords for sf-app")).toBeInTheDocument();
    expect(mockGetApp).toHaveBeenCalledWith("sf-app", "salesforce");
  });

  it("does not redirect when isTrackedByAccount is true", async () => {
    mockGetApp.mockResolvedValue({
      slug: "my-app",
      name: "My App",
      isTrackedByAccount: true,
    });

    await KeywordsPage({
      params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
    });

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to correct platform-specific URL", async () => {
    mockGetApp.mockResolvedValue({
      slug: "sf-app",
      name: "SF App",
      isTrackedByAccount: false,
    });

    await expect(
      KeywordsPage({
        params: Promise.resolve({ platform: "salesforce", slug: "sf-app" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/salesforce/apps/sf-app");
  });
});
