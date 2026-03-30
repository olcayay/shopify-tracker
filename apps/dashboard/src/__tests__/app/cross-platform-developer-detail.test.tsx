import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";

const mockFetchWithAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "jotform" }),
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

import CrossPlatformDeveloperPage from "@/app/(dashboard)/developer/[slug]/page";

const mockData = {
  developer: { id: 1, slug: "jotform", name: "Jotform", website: "https://jotform.com" },
  isStarred: false,
  platforms: [
    { id: 1, platform: "shopify", name: "Jotform", appCount: 2 },
    { id: 2, platform: "salesforce", name: "Jotform Inc.", appCount: 1 },
  ],
  apps: [
    { id: 1, platform: "shopify", slug: "jotform-app", name: "Jotform App", iconUrl: null, averageRating: 4.5, ratingCount: 100, pricingHint: "Free", isTracked: true, activeInstalls: null },
    { id: 2, platform: "shopify", slug: "jotform-forms", name: "Jotform Forms", iconUrl: null, averageRating: 4.0, ratingCount: 50, pricingHint: "$10/mo", isTracked: false, activeInstalls: null },
    { id: 3, platform: "salesforce", slug: "jotform-sf", name: "Jotform SF", iconUrl: null, averageRating: 4.2, ratingCount: 30, pricingHint: "Free", isTracked: false, activeInstalls: null },
  ],
  totalApps: 3,
};

describe("CrossPlatformDeveloperPage (/developers/[slug])", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders developer name and all platform apps", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });
    render(<CrossPlatformDeveloperPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Jotform");
    });
    // All apps should be visible (not filtered by platform)
    expect(screen.getByText("Jotform App")).toBeInTheDocument();
    expect(screen.getByText("Jotform Forms")).toBeInTheDocument();
    expect(screen.getByText("Jotform SF")).toBeInTheDocument();
  });

  it("groups apps by platform in separate cards", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });
    render(<CrossPlatformDeveloperPage />);
    await waitFor(() => {
      expect(screen.getByText("Jotform App")).toBeInTheDocument();
    });
    // Both platform labels should appear as card headers
    expect(screen.getByText("Shopify")).toBeInTheDocument();
    expect(screen.getByText("Salesforce")).toBeInTheDocument();
  });

  it("shows breadcrumb with Developers link", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });
    render(<CrossPlatformDeveloperPage />);
    await waitFor(() => {
      const devLink = screen.getByText("Developers");
      expect(devLink.closest("a")).toHaveAttribute("href", "/developers");
    });
  });

  it("renders star button in header", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });
    render(<CrossPlatformDeveloperPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Star developer")).toBeInTheDocument();
    });
  });

  it("shows filled star when developer is starred", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...mockData, isStarred: true }),
    });
    render(<CrossPlatformDeveloperPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Unstar developer")).toBeInTheDocument();
    });
  });

  it("toggles star on click", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/api/developers/")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockData) });
      }
      if (url.includes("/api/account/starred-developers/")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ message: "ok" }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
    });
    render(<CrossPlatformDeveloperPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Star developer")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Star developer"));
    await waitFor(() => {
      expect(screen.getByLabelText("Unstar developer")).toBeInTheDocument();
    });
  });

  it("shows error when developer not found", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Not found" }),
    });
    render(<CrossPlatformDeveloperPage />);
    await waitFor(() => {
      expect(screen.getByText("Developer Not Found")).toBeInTheDocument();
    });
  });

  it("shows website link", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });
    render(<CrossPlatformDeveloperPage />);
    await waitFor(() => {
      const link = document.querySelector('a[href="https://jotform.com"]');
      expect(link).toBeInTheDocument();
    });
  });
});
