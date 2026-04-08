import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/system-admin/platform-access",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock auth
const mockFetchWithAuth = vi.fn();
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", name: "Admin", email: "admin@test.com", role: "owner", isSystemAdmin: true },
    account: { id: "a1", name: "Test", isSuspended: false, enabledPlatforms: [], enabledFeatures: [] },
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

import React from "react";
import PlatformAccessPage from "@/app/(dashboard)/system-admin/platform-access/page";

const mockPlatformFlags = [
  { id: "f1", slug: "platform-shopify", name: "Platform: Shopify", description: null, isEnabled: true, accountCount: 2, userCount: 1 },
  { id: "f2", slug: "platform-salesforce", name: "Platform: Salesforce", description: null, isEnabled: true, accountCount: 0, userCount: 0 },
  { id: "f3", slug: "platform-canva", name: "Platform: Canva", description: null, isEnabled: false, accountCount: 1, userCount: 0 },
  { id: "f4", slug: "platform-wix", name: "Platform: Wix", description: null, isEnabled: true, accountCount: 0, userCount: 0 },
  // Non-platform flags should be filtered out
  { id: "f5", slug: "market-research", name: "Market Research", description: null, isEnabled: true, accountCount: 3, userCount: 2 },
];

function setupMock() {
  mockFetchWithAuth.mockImplementation((url: string) => {
    if (url.includes("/api/system-admin/feature-flags")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockPlatformFlags }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

describe("PlatformAccessPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock();
  });

  it("renders page title", async () => {
    render(<PlatformAccessPage />);
    expect(screen.getByText("Platform Access")).toBeInTheDocument();
  });

  it("shows only platform flags (filters out non-platform flags)", async () => {
    render(<PlatformAccessPage />);
    await waitFor(() => {
      expect(screen.getByText("Shopify")).toBeInTheDocument();
    });
    expect(screen.getByText("Salesforce")).toBeInTheDocument();
    expect(screen.getByText("Canva")).toBeInTheDocument();
    expect(screen.getByText("Wix")).toBeInTheDocument();
    // market-research should NOT appear
    expect(screen.queryByText("Market Research")).not.toBeInTheDocument();
  });

  it("shows correct enabled/disabled badges", async () => {
    render(<PlatformAccessPage />);
    await waitFor(() => {
      expect(screen.getByText("Shopify")).toBeInTheDocument();
    });
    const badges = screen.getAllByText("On");
    expect(badges.length).toBe(3); // shopify, salesforce, wix
    expect(screen.getByText("Off")).toBeInTheDocument(); // canva
  });

  it("shows summary cards with correct counts", async () => {
    render(<PlatformAccessPage />);
    await waitFor(() => {
      expect(screen.getByText("3 / 4")).toBeInTheDocument(); // 3 enabled out of 4
    });
    expect(screen.getByText("Platforms Enabled")).toBeInTheDocument();
    expect(screen.getByText("Account Overrides")).toBeInTheDocument();
    expect(screen.getByText("User Overrides")).toBeInTheDocument();
  });

  it("shows account count per platform", async () => {
    render(<PlatformAccessPage />);
    await waitFor(() => {
      expect(screen.getByText("2 accounts")).toBeInTheDocument(); // shopify
    });
    expect(screen.getByText("1 account")).toBeInTheDocument(); // canva
  });

  it("toggles platform on click", async () => {
    const user = userEvent.setup();
    render(<PlatformAccessPage />);
    await waitFor(() => {
      expect(screen.getByText("Shopify")).toBeInTheDocument();
    });

    // Find the Disable button for Shopify (first one)
    const disableButtons = screen.getAllByText("Disable");
    mockFetchWithAuth.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await user.click(disableButtons[0]);

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/system-admin/feature-flags/platform-shopify",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("filters platforms by search", async () => {
    const user = userEvent.setup();
    render(<PlatformAccessPage />);
    await waitFor(() => {
      expect(screen.getByText("Shopify")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search platforms...");
    await user.type(searchInput, "shop");

    expect(screen.getByText("Shopify")).toBeInTheDocument();
    expect(screen.queryByText("Salesforce")).not.toBeInTheDocument();
    expect(screen.queryByText("Canva")).not.toBeInTheDocument();
  });

  it("shows Enable All and Disable All buttons", async () => {
    render(<PlatformAccessPage />);
    expect(screen.getByText("Enable All")).toBeInTheDocument();
    expect(screen.getByText("Disable All")).toBeInTheDocument();
  });
});
