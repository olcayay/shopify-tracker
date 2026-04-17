import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/shopify/apps/my-app/details",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ platform: "shopify", slug: "my-app" }),
  redirect: vi.fn(),
}));

// Mock API
const mockGetApp = vi.fn();

vi.mock("@/lib/api", () => ({
  getEnabledFeatures: vi.fn().mockResolvedValue([]),
  getApp: (...args: any[]) => mockGetApp(...args),
}));

// Mock auth-server
const mockIsSystemAdmin = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/auth-server", () => ({
  isSystemAdminServer: () => mockIsSystemAdmin(),
}));

// Mock score-features-server
const mockHasServerFeature = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/score-features-server", () => ({
  hasServerFeature: () => mockHasServerFeature(),
}));

import DetailsPage from "@/app/(dashboard)/[platform]/apps/[slug]/details/page";

function buildAppData(overrides: any = {}) {
  return {
    slug: "my-app",
    name: "My App",
    isTrackedByAccount: true,
    currentVersion: null,
    activeInstalls: null,
    lastUpdatedAt: null,
    latestSnapshot: {
      appIntroduction: "A great app for email marketing",
      appDetails: "This app helps you manage your email campaigns with ease.",
      features: ["Feature One", "Feature Two", "Feature Three"],
      pricingPlans: [
        {
          name: "Free Plan",
          price: null,
          features: ["100 emails/month", "Basic templates"],
        },
        {
          name: "Pro Plan",
          price: "9.99",
          currency_code: "USD",
          period: "month",
          features: ["Unlimited emails", "Advanced analytics"],
        },
      ],
      categories: [
        {
          title: "Email",
          type: "primary",
          url: "/categories/email",
          subcategories: [],
        },
      ],
      support: {
        email: "support@myapp.com",
        portal_url: "https://support.myapp.com",
        phone: null,
      },
      languages: ["English", "French"],
      integrations: ["Klaviyo", "Mailchimp"],
      seoTitle: "My App - Best Email Marketing",
      seoMetaDescription: "Boost your email campaigns",
      scrapedAt: new Date(Date.now() - 3600_000).toISOString(),
      platformData: {},
      ...overrides.snapshot,
    },
    ...overrides,
  };
}

function setupDefaultMocks(overrides: any = {}) {
  const appData = buildAppData(overrides);
  mockGetApp.mockResolvedValue(appData);
  return appData;
}

describe("DetailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders app introduction section", async () => {
    setupDefaultMocks();
    const page = await DetailsPage({
      params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
    });
    render(page);
    expect(screen.getByText("App Introduction")).toBeInTheDocument();
    expect(screen.getByText("A great app for email marketing")).toBeInTheDocument();
  });

  it("renders app details section", async () => {
    setupDefaultMocks();
    const page = await DetailsPage({
      params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
    });
    render(page);
    expect(screen.getByText("App Details")).toBeInTheDocument();
    expect(
      screen.getByText("This app helps you manage your email campaigns with ease.")
    ).toBeInTheDocument();
  });

  it("shows 'App not found.' when API throws", async () => {
    mockGetApp.mockRejectedValue(new Error("Not found"));
    const page = await DetailsPage({
      params: Promise.resolve({ platform: "shopify", slug: "nonexistent" }),
    });
    render(page);
    expect(screen.getByText("App not found.")).toBeInTheDocument();
  });

  it("shows 'No details available.' when no snapshot", async () => {
    setupDefaultMocks({ latestSnapshot: null });
    const page = await DetailsPage({
      params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
    });
    render(page);
    expect(screen.getByText("No details available.")).toBeInTheDocument();
  });

  it("renders pricing plans", async () => {
    setupDefaultMocks();
    const page = await DetailsPage({
      params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
    });
    render(page);
    expect(screen.getByText("Pricing Plans")).toBeInTheDocument();
    expect(screen.getByText("Free Plan")).toBeInTheDocument();
    expect(screen.getByText("Pro Plan")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("$9.99 USD/month")).toBeInTheDocument();
  });

  it("renders features list", async () => {
    setupDefaultMocks();
    const page = await DetailsPage({
      params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
    });
    render(page);
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("Feature One")).toBeInTheDocument();
    expect(screen.getByText("Feature Two")).toBeInTheDocument();
    expect(screen.getByText("Feature Three")).toBeInTheDocument();
  });

  it("renders support section", async () => {
    setupDefaultMocks();
    const page = await DetailsPage({
      params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
    });
    render(page);
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getByText("support@myapp.com")).toBeInTheDocument();
  });

  it("renders categories and features section", async () => {
    setupDefaultMocks();
    const page = await DetailsPage({
      params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
    });
    render(page);
    expect(screen.getByText("Categories & Features")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("renders SEO/web search content section (seoTitle hidden for shopify)", async () => {
    setupDefaultMocks();
    const page = await DetailsPage({
      params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
    });
    render(page);
    expect(screen.getByText("Web Search Content")).toBeInTheDocument();
    // seoTitle hidden for shopify (limit=0), but seoMetaDescription still shown
    expect(screen.queryByText("My App - Best Email Marketing")).not.toBeInTheDocument();
    expect(screen.getByText("Boost your email campaigns")).toBeInTheDocument();
  });

  it("renders seoTitle on platforms that support it", async () => {
    setupDefaultMocks();
    const page = await DetailsPage({
      params: Promise.resolve({ platform: "wix", slug: "my-app" }),
    });
    render(page);
    expect(screen.getByText("My App - Best Email Marketing")).toBeInTheDocument();
  });

  it("renders languages and integrations", async () => {
    setupDefaultMocks();
    const page = await DetailsPage({
      params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
    });
    render(page);
    expect(screen.getByText("Languages")).toBeInTheDocument();
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Integrations")).toBeInTheDocument();
    expect(screen.getByText("Klaviyo")).toBeInTheDocument();
  });

  it("calls getApp with correct slug and platform", async () => {
    setupDefaultMocks();
    await DetailsPage({
      params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
    });
    expect(mockGetApp).toHaveBeenCalledWith("my-app", "shopify");
  });

  describe("DataFreshness feature flag", () => {
    it("hides DataFreshness when scrape-timestamps flag is off", async () => {
      mockHasServerFeature.mockResolvedValue(false);
      setupDefaultMocks();
      const page = await DetailsPage({
        params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
      });
      render(page);
      expect(screen.queryByText(/Data from/)).not.toBeInTheDocument();
    });

    it("shows DataFreshness when scrape-timestamps flag is on", async () => {
      mockHasServerFeature.mockResolvedValue(true);
      setupDefaultMocks();
      const page = await DetailsPage({
        params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
      });
      render(page);
      expect(screen.getByText(/Data from/)).toBeInTheDocument();
    });
  });

  describe("admin gating", () => {
    it("hides Support and Web Search Content for non-admin users", async () => {
      mockIsSystemAdmin.mockResolvedValue(false);
      setupDefaultMocks();
      const page = await DetailsPage({
        params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
      });
      render(page);
      expect(screen.queryByText("Support")).not.toBeInTheDocument();
      expect(screen.queryByText("Web Search Content")).not.toBeInTheDocument();
      // Other cards should still render
      expect(screen.getByText("App Introduction")).toBeInTheDocument();
      expect(screen.getByText("Features")).toBeInTheDocument();
      expect(screen.getByText("Pricing Plans")).toBeInTheDocument();
      expect(screen.getByText("Categories & Features")).toBeInTheDocument();
    });

    it("shows Support and Web Search Content for admin users", async () => {
      mockIsSystemAdmin.mockResolvedValue(true);
      setupDefaultMocks();
      const page = await DetailsPage({
        params: Promise.resolve({ platform: "shopify", slug: "my-app" }),
      });
      render(page);
      expect(screen.getByText("Support")).toBeInTheDocument();
      expect(screen.getByText("Web Search Content")).toBeInTheDocument();
    });
  });
});
