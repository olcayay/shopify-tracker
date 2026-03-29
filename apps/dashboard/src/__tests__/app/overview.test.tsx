import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const mockFetchWithAuth = vi.fn();

vi.mock("@/components/platform-request-dialog", () => ({
  PlatformRequestDialog: () => null,
}));

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
    if (url.includes("/api/account/stats")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            shopify: { apps: 2, keywords: 1, competitors: 1 },
            salesforce: { apps: 2, keywords: 1, competitors: 1 },
          }),
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

  it("shows loading skeletons initially", () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    // During loading, skeletons should be rendered (no platform data yet)
    expect(document.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders multi-platform view when both platforms have apps", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      // Multi-platform: cross-platform summary shows "2 platforms"
      expect(screen.getByText("2 platforms")).toBeInTheDocument();
    });
  });

  it("renders platform cards for enabled platforms", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Shopify App Store")).toBeInTheDocument();
    });
    expect(screen.getByText("Salesforce AppExchange")).toBeInTheDocument();
  });

  it("renders clickable platform cards linking to overview", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Shopify App Store")).toBeInTheDocument();
    });
    // The whole card is wrapped in a link to platform overview
    const shopifyCard = screen.getByText("Shopify App Store").closest("a");
    expect(shopifyCard).toHaveAttribute("href", "/shopify");
  });

  it("renders clickable stat sections in platform cards", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Shopify App Store")).toBeInTheDocument();
    });
    // Apps stat should link to /shopify/apps
    const appsLinks = screen.getAllByText("Apps").map((el) => el.closest("a")).filter(Boolean);
    expect(appsLinks.some((a) => a?.getAttribute("href") === "/shopify/apps")).toBe(true);
  });

  it("renders tracked counts per platform", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      const twos = screen.getAllByText("2");
      expect(twos.length).toBeGreaterThan(0);
    });
  });

  it("renders account usage stats", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      // Shared AccountUsageCards renders value and /limit in separate elements
      expect(screen.getByText("My Apps")).toBeInTheDocument();
      expect(screen.getByText("Tracked Keywords")).toBeInTheDocument();
      expect(screen.getByText("Competitor Apps")).toBeInTheDocument();
    });
  });

  it("calls fetchWithAuth for stats endpoint", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/account/stats"
      );
    });
  });

  it("shows Request a Platform CTA", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Don't see your platform?")).toBeInTheDocument();
    });
  });

  it("renders cross-platform summary with colored stat pills", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      // Globe icon container and stat pill labels
      expect(screen.getByText("2 platforms")).toBeInTheDocument();
      // Stat pills: Apps, Keywords, Competitors labels inside pills
      const appsLabels = screen.getAllByText("Apps");
      expect(appsLabels.length).toBeGreaterThan(0);
      const keywordsLabels = screen.getAllByText("Keywords");
      expect(keywordsLabels.length).toBeGreaterThan(0);
      const competitorsLabels = screen.getAllByText("Competitors");
      expect(competitorsLabels.length).toBeGreaterThan(0);
    });
  });

  it("does not show disabled platforms to regular users", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      // Regular users should NOT see non-enabled platforms
      expect(screen.queryByText("Canva Apps")).not.toBeInTheDocument();
      expect(screen.queryByText("Not enabled")).not.toBeInTheDocument();
    });
  });

  it("separates tracked platforms from available platforms in multi-platform view", async () => {
    // shopify has apps (tracked), salesforce has apps (tracked) — both tracked
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Your Platforms")).toBeInTheDocument();
    });
    // Both platforms have apps so they're in "Your Platforms"
    expect(screen.getByText("Shopify App Store")).toBeInTheDocument();
    expect(screen.getByText("Salesforce AppExchange")).toBeInTheDocument();
    // Active count badge
    expect(screen.getByText("2 active")).toBeInTheDocument();
  });

  it("renders stat cards with navigation links to cross-platform pages", async () => {
    setupDefaultMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("My Apps")).toBeInTheDocument();
    });
    // My Apps card should link to /apps
    const appsCard = screen.getByText("My Apps").closest("a");
    expect(appsCard).toHaveAttribute("href", "/apps");
    // Tracked Keywords card should link to /keywords
    const keywordsCard = screen.getByText("Tracked Keywords").closest("a");
    expect(keywordsCard).toHaveAttribute("href", "/keywords");
    // Competitor Apps card should link to /competitors
    const competitorsCard = screen.getByText("Competitor Apps").closest("a");
    expect(competitorsCard).toHaveAttribute("href", "/competitors");
    // Users card should link to /settings
    const usersCard = screen.getByText("Users").closest("a");
    expect(usersCard).toHaveAttribute("href", "/settings");
    // Research Projects should not be a link
    const researchCard = screen.getByText("Research Projects").closest("a");
    expect(researchCard).toBeNull();
  });

  it("shows available platforms section when some multi-platform platforms have zero stats", async () => {
    // shopify has apps, salesforce has apps but no keywords/competitors — both tracked
    // For available section test, we need new_user persona (all zeros) which shows all as available
    mockFetchWithAuth.mockImplementation((url: string) => {
      // All platforms return zero
      if (url.includes("/api/apps")) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.includes("/api/keywords")) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.includes("/api/account/competitors")) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    render(<OverviewPage />);
    await waitFor(() => {
      // new_user persona shows Available Platforms
      expect(screen.getByText("Available Platforms")).toBeInTheDocument();
    });
    expect(screen.getByText("Start tracking on any of these to see stats and rankings.")).toBeInTheDocument();
  });

  it("shows error banner with retry button when API calls fail", async () => {
    mockFetchWithAuth.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 500 })
    );
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("does not show onboarding when API fails but user has enabled platforms", async () => {
    // All API calls fail — should NOT show welcome/onboarding hero
    mockFetchWithAuth.mockImplementation(() =>
      Promise.reject(new Error("Network error"))
    );
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
    // OnboardingHero should not be rendered
    expect(screen.queryByText("Welcome to AppRanks")).not.toBeInTheDocument();
  });
});
