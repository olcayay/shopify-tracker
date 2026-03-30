import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";

const mockFetchWithAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ platform: "shopify", slug: "jotform" }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
    user: { id: "1", role: "owner", isSystemAdmin: false },
    account: { id: "a1", enabledPlatforms: ["shopify", "salesforce"] },
  }),
}));

vi.mock("@/components/skeletons", () => ({
  TableSkeleton: () => <div data-testid="table-skeleton">Loading...</div>,
}));

import PlatformDeveloperPage from "@/app/(dashboard)/[platform]/developers/[slug]/page";

const mockDeveloperData = {
  developer: { id: 1, slug: "jotform", name: "Jotform", website: "https://jotform.com" },
  platforms: [
    { id: 1, platform: "shopify", name: "Jotform", appCount: 2 },
    { id: 2, platform: "salesforce", name: "Jotform Inc.", appCount: 1 },
  ],
  apps: [
    { id: 1, platform: "shopify", slug: "jotform-app", name: "Jotform", iconUrl: null, averageRating: 4.5, ratingCount: 100, pricingHint: "Free", isTracked: true, activeInstalls: null },
    { id: 2, platform: "shopify", slug: "jotform-forms", name: "Jotform Forms", iconUrl: null, averageRating: 4.0, ratingCount: 50, pricingHint: "$10/mo", isTracked: false, activeInstalls: null },
    { id: 3, platform: "salesforce", slug: "jotform-sf", name: "Jotform SF", iconUrl: null, averageRating: 4.2, ratingCount: 30, pricingHint: "Free", isTracked: false, activeInstalls: null },
  ],
  totalApps: 3,
  isStarred: false,
};

describe("PlatformDeveloperPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders developer name and platform apps after loading", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDeveloperData),
    });
    render(<PlatformDeveloperPage />);
    await waitFor(() => {
      // Developer name appears in heading (h1)
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Jotform");
    });
    // Should show only shopify apps (2 out of 3)
    expect(screen.getByText("Jotform Forms")).toBeInTheDocument();
    // Salesforce app should NOT be in the table
    expect(screen.queryByText("Jotform SF")).not.toBeInTheDocument();
  });

  it("shows cross-platform banner when developer has apps on other platforms", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDeveloperData),
    });
    render(<PlatformDeveloperPage />);
    await waitFor(() => {
      expect(screen.getByText("3 apps")).toBeInTheDocument();
      expect(screen.getByText("2 platforms")).toBeInTheDocument();
    });
    expect(screen.getByText("View cross-platform profile")).toBeInTheDocument();
  });

  it("shows breadcrumb with Developers link", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDeveloperData),
    });
    render(<PlatformDeveloperPage />);
    await waitFor(() => {
      const devLink = screen.getByText("Developers");
      expect(devLink.closest("a")).toHaveAttribute("href", "/shopify/developers");
    });
  });

  it("shows error when developer not found", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Not found" }),
    });
    render(<PlatformDeveloperPage />);
    await waitFor(() => {
      expect(screen.getByText("Developer Not Found")).toBeInTheDocument();
    });
  });

  it("renders loading skeleton initially", () => {
    mockFetchWithAuth.mockReturnValue(new Promise(() => {})); // never resolves
    render(<PlatformDeveloperPage />);
    expect(screen.getByTestId("table-skeleton")).toBeInTheDocument();
  });

  it("renders star button in header", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDeveloperData),
    });
    render(<PlatformDeveloperPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Bookmark developer")).toBeInTheDocument();
    });
  });

  it("shows filled bookmark when developer is starred", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...mockDeveloperData, isStarred: true }),
    });
    render(<PlatformDeveloperPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Remove bookmark")).toBeInTheDocument();
    });
  });

  it("toggles bookmark on click with optimistic update", async () => {
    mockFetchWithAuth.mockImplementation((url: string, opts?: any) => {
      if (url.includes("/api/developers/")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDeveloperData) });
      }
      if (url.includes("/api/account/starred-developers/")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ message: "ok" }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
    });
    render(<PlatformDeveloperPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Bookmark developer")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Bookmark developer"));
    await waitFor(() => {
      expect(screen.getByLabelText("Remove bookmark")).toBeInTheDocument();
    });
  });
});
