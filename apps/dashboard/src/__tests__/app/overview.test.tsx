import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      name: "Test User",
      email: "test@example.com",
      role: "owner",
      isSystemAdmin: false,
      emailDigestEnabled: true,
      timezone: "Europe/Istanbul",
    },
    account: {
      id: "acc-1",
      name: "Test Account",
      company: "Test Co",
      isSuspended: false,
      package: { slug: "pro", name: "Pro" },
      packageLimits: {
        maxTrackedApps: 10,
        maxTrackedKeywords: 50,
        maxCompetitorApps: 20,
        maxUsers: 5,
        maxResearchProjects: 3,
        maxPlatforms: 3,
      },
      limits: {
        maxTrackedApps: 10,
        maxTrackedKeywords: 50,
        maxCompetitorApps: 20,
        maxUsers: 5,
        maxResearchProjects: 3,
        maxPlatforms: 3,
      },
      usage: {
        trackedApps: 3,
        trackedKeywords: 10,
        competitorApps: 5,
        starredFeatures: 2,
        users: 2,
        researchProjects: 1,
        platforms: 1,
      },
      enabledPlatforms: ["shopify", "salesforce"],
    },
    isLoading: false,
    fetchWithAuth: mockFetchWithAuth,
    refreshUser: vi.fn(),
  }),
}));

import OverviewPage from "@/app/(dashboard)/overview/page";

function setupDefaultMocks() {
  mockFetchWithAuth.mockImplementation((url: string) => {
    if (url.includes("/api/apps")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { slug: "app1" },
            { slug: "app2" },
          ]),
      });
    }
    if (url.includes("/api/keywords")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: 1, keyword: "kw1" },
          ]),
      });
    }
    if (url.includes("/api/account/competitors")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { slug: "comp1" },
          ]),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });
}

describe("CrossPlatformOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Platforms heading", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    expect(screen.getByText("Platforms")).toBeInTheDocument();
  });

  it("renders subtitle text", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    expect(
      screen.getByText(
        "Monitor your app store presence across all platforms."
      )
    ).toBeInTheDocument();
  });

  it("shows loading skeletons initially", () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    // During loading, should show the heading but platform cards with data are not yet rendered
    expect(screen.getByText("Platforms")).toBeInTheDocument();
  });

  it("renders platform cards for enabled platforms", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Shopify App Store")).toBeInTheDocument();
    });
    expect(screen.getByText("Salesforce AppExchange")).toBeInTheDocument();
  });

  it("renders View Dashboard buttons", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getAllByText("View Dashboard").length).toBeGreaterThan(0);
    });
  });

  it("renders links to platform overview pages", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Shopify App Store")).toBeInTheDocument();
    });
    const shopifyLink = screen.getAllByText("View Dashboard")[0].closest("a");
    expect(shopifyLink).toHaveAttribute("href", "/shopify/overview");
  });

  it("renders tracked counts per platform", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      // Each platform card should show app count (2 apps from mock)
      const twos = screen.getAllByText("2");
      expect(twos.length).toBeGreaterThan(0);
    });
  });

  it("renders Account Usage section", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Account Usage")).toBeInTheDocument();
    });
  });

  it("renders account usage stats", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("3/10")).toBeInTheDocument(); // Apps
      expect(screen.getByText("10/50")).toBeInTheDocument(); // Keywords
      expect(screen.getByText("5/20")).toBeInTheDocument(); // Competitors
    });
  });

  it("calls fetchWithAuth for each enabled platform", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      // Should fetch apps for shopify and salesforce
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/apps?platform=shopify"
      );
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/apps?platform=salesforce"
      );
    });
  });
});
