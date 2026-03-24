import { describe, it, expect } from "vitest";
import {
  parseAddonDetails,
  parseSearchResults,
  parseVersionDetails,
  parseVendorDetails,
  parsePricingTiers,
} from "../api-parser.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADDON_JSON = {
  id: 12345,
  key: "com.example.test-addon",
  name: "Test Addon",
  tagLine: "A handy add-on",
  summary: "<p>Short summary of the addon</p>",
  description: "Full markdown description",
  lastModified: "2025-12-01T10:00:00Z",
  hosting: { visibility: "public" },
  programs: {
    cloudFortified: { status: "approved" },
    topVendor: { status: "not_approved" },
    bugBountyParticipant: { cloud: { status: "approved" } },
  },
  tags: {
    category: ["project-management"],
    keywords: ["automation", "workflow"],
  },
  vendorLinks: { documentation: "https://docs.example.com" },
  _embedded: {
    reviews: { averageStars: 4.2, count: 350 },
    logo: { _links: { image: { href: "https://cdn.atlassian.com/logo.png" } } },
    vendor: {
      name: "Example Vendor",
      programs: { topVendor: { status: "approved" } },
      _links: { self: { href: "https://marketplace.atlassian.com/rest/2/vendors/9876" } },
    },
    distribution: { totalInstalls: 50000, totalDownloads: 120000 },
    categories: [
      { key: "project-management", name: "Project Management" },
      { key: "admin-tools", name: "Admin Tools" },
    ],
  },
};

const VERSION_JSON = {
  name: "3.4.1",
  paymentModel: "paid",
  release: { date: "2025-11-15" },
  _links: { license: { href: "/licenseTypes/commercial" } },
  compatibilities: [
    { application: "jira", hosting: "cloud" },
    { application: "confluence", hosting: "server" },
  ],
  _embedded: {
    highlights: [
      { title: "Highlight One", body: "<b>Fast</b> and reliable" },
      { title: "Highlight Two", body: "Easy to use" },
    ],
  },
  text: { moreDetails: "<p>Detailed description here</p>" },
  vendorLinks: { documentation: "https://docs.example.com", eula: "https://eula.example.com" },
};

const VENDOR_JSON = {
  email: "contact@vendor.com",
  address: "123 Market St, SF",
  supportDetails: {
    supportOrg: {
      supportEmail: "support@vendor.com",
      supportUrl: "https://support.vendor.com",
      supportPhone: "+1-555-1234",
    },
  },
  vendorLinks: {
    homePage: "https://vendor.com",
    sla: "https://vendor.com/sla",
    trustCenterUrl: "https://vendor.com/trust",
  },
};

const PRICING_JSON = {
  items: [
    { monthsValid: 12, unitCount: 10, amount: 1000, editionDescription: "Starter" },
    { monthsValid: 12, unitCount: 25, amount: 2500, editionDescription: "Small Team" },
    { monthsValid: 12, unitCount: 100, amount: 8000, editionDescription: "Growing" },
    { monthsValid: 12, unitCount: 500, amount: 30000, editionDescription: "Enterprise" },
    { monthsValid: 1, unitCount: 10, amount: 100 }, // monthly — should be filtered out
  ],
};

const SEARCH_JSON = {
  count: 125,
  _embedded: {
    addons: [
      {
        id: 1001,
        key: "com.example.first-app",
        name: "First App",
        summary: "<b>First</b> app summary",
        programs: { cloudFortified: { status: "approved" } },
        _embedded: {
          reviews: { averageStars: 4.5, count: 200 },
          logo: { _links: { image: { href: "https://cdn.atlassian.com/first.png" } } },
          vendor: { name: "Vendor A", programs: { topVendor: { status: "not_approved" } } },
          distribution: { totalInstalls: 30000 },
        },
      },
      {
        id: 1002,
        key: "com.example.second-app",
        name: "Second App",
        summary: "Second app summary",
        programs: {},
        _embedded: {
          reviews: { averageStars: 3.8, count: 42 },
          logo: { _links: { image: { href: "https://cdn.atlassian.com/second.png" } } },
          vendor: { name: "Vendor B", programs: { topVendor: { status: "approved" } } },
          distribution: { totalInstalls: 5000 },
        },
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// parseAddonDetails
// ---------------------------------------------------------------------------

describe("parseAddonDetails", () => {
  it("parses basic addon fields (name, slug, rating)", () => {
    const result = parseAddonDetails(ADDON_JSON);
    expect(result.name).toBe("Test Addon");
    expect(result.slug).toBe("com.example.test-addon");
    expect(result.averageRating).toBe(4.2);
    expect(result.ratingCount).toBe(350);
  });

  it("parses icon URL from embedded logo", () => {
    const result = parseAddonDetails(ADDON_JSON);
    expect(result.iconUrl).toBe("https://cdn.atlassian.com/logo.png");
  });

  it("detects Cloud Fortified badge", () => {
    const result = parseAddonDetails(ADDON_JSON);
    expect(result.badges).toContain("cloud_fortified");
  });

  it("detects Top Vendor badge from embedded vendor programs", () => {
    const result = parseAddonDetails(ADDON_JSON);
    expect(result.badges).toContain("top_vendor");
  });

  it("parses developer / vendor details", () => {
    const result = parseAddonDetails(ADDON_JSON);
    expect(result.developer).not.toBeNull();
    expect(result.developer!.name).toBe("Example Vendor");
    expect(result.developer!.url).toContain("/vendors/9876");
  });

  it("populates platformData with categories", () => {
    const result = parseAddonDetails(ADDON_JSON);
    const pd = result.platformData;
    expect(pd.categories).toEqual([
      { slug: "project-management", name: "Project Management" },
      { slug: "admin-tools", name: "Admin Tools" },
    ]);
  });

  it("populates platformData with distribution numbers", () => {
    const result = parseAddonDetails(ADDON_JSON);
    const pd = result.platformData;
    expect(pd.totalInstalls).toBe(50000);
    expect(pd.downloads).toBe(120000);
  });

  it("enriches with version data when provided", () => {
    const result = parseAddonDetails(ADDON_JSON, VERSION_JSON);
    const pd = result.platformData;
    expect(pd.version).toBe("3.4.1");
    expect(pd.paymentModel).toBe("paid");
    expect(pd.releaseDate).toBe("2025-11-15");
    expect(pd.licenseType).toBe("Commercial");
  });

  it("enriches with vendor data when provided", () => {
    const result = parseAddonDetails(ADDON_JSON, null, VENDOR_JSON);
    const pd = result.platformData;
    expect(pd.supportEmail).toBe("support@vendor.com");
    expect(pd.supportUrl).toBe("https://support.vendor.com");
    expect(pd.contactEmail).toBe("contact@vendor.com");
    expect(pd.vendorHomePage).toBe("https://vendor.com");
  });

  it("enriches with pricing data and builds pricingHint", () => {
    const result = parseAddonDetails(ADDON_JSON, VERSION_JSON, null, PRICING_JSON);
    const pd = result.platformData;
    const plans = pd.pricingPlans as any[];
    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0].price).toBe("10"); // 1000 / 100
    expect(plans[0].period).toBe("yr");
    expect(result.pricingHint).toBe("From $10/yr");
  });

  it("sets pricingHint to Free when paymentModel is free", () => {
    const freeVersion = { ...VERSION_JSON, paymentModel: "free" };
    const result = parseAddonDetails(ADDON_JSON, freeVersion, null, null);
    expect(result.pricingHint).toBe("Free");
  });

  it("handles missing optional fields gracefully", () => {
    const minimal = { key: "com.minimal.app", name: "Minimal" };
    const result = parseAddonDetails(minimal);
    expect(result.name).toBe("Minimal");
    expect(result.slug).toBe("com.minimal.app");
    expect(result.averageRating).toBeNull();
    expect(result.ratingCount).toBeNull();
    expect(result.iconUrl).toBeNull();
    expect(result.developer).toBeNull();
    expect(result.badges).toEqual([]);
    expect(result.pricingHint).toBeNull();
  });

  it("strips HTML from summary in platformData", () => {
    const result = parseAddonDetails(ADDON_JSON);
    const pd = result.platformData;
    expect(pd.summary).toBe("Short summary of the addon");
  });

  it("extracts vendorId from vendor self link", () => {
    const result = parseAddonDetails(ADDON_JSON);
    expect(result.platformData.vendorId).toBe("9876");
  });

  it("detects bugBountyParticipant from programs", () => {
    const result = parseAddonDetails(ADDON_JSON);
    expect(result.platformData.bugBountyParticipant).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseVersionDetails
// ---------------------------------------------------------------------------

describe("parseVersionDetails", () => {
  it("parses version, paymentModel, and releaseDate", () => {
    const result = parseVersionDetails(VERSION_JSON);
    expect(result.version).toBe("3.4.1");
    expect(result.paymentModel).toBe("paid");
    expect(result.releaseDate).toBe("2025-11-15");
  });

  it("parses licenseType from _links.license.href", () => {
    const result = parseVersionDetails(VERSION_JSON);
    expect(result.licenseType).toBe("Commercial");
  });

  it("parses compatibilities with hosting type flags", () => {
    const result = parseVersionDetails(VERSION_JSON);
    expect(result.compatibilities).toHaveLength(2);
    expect(result.compatibilities[0]).toEqual({
      application: "jira",
      cloud: true,
      server: false,
      dataCenter: false,
    });
    expect(result.compatibilities[1]).toEqual({
      application: "confluence",
      cloud: false,
      server: true,
      dataCenter: false,
    });
  });

  it("strips HTML from highlight bodies", () => {
    const result = parseVersionDetails(VERSION_JSON);
    expect(result.highlights).toHaveLength(2);
    expect(result.highlights[0].body).toBe("Fast and reliable");
  });

  it("strips HTML from fullDescription", () => {
    const result = parseVersionDetails(VERSION_JSON);
    expect(result.fullDescription).toBe("Detailed description here");
  });

  it("returns null licenseType when license link is missing", () => {
    const result = parseVersionDetails({});
    expect(result.licenseType).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseVendorDetails
// ---------------------------------------------------------------------------

describe("parseVendorDetails", () => {
  it("parses all vendor support and contact fields", () => {
    const result = parseVendorDetails(VENDOR_JSON);
    expect(result.supportEmail).toBe("support@vendor.com");
    expect(result.supportUrl).toBe("https://support.vendor.com");
    expect(result.supportPhone).toBe("+1-555-1234");
    expect(result.contactEmail).toBe("contact@vendor.com");
    expect(result.address).toBe("123 Market St, SF");
    expect(result.homePage).toBe("https://vendor.com");
    expect(result.slaUrl).toBe("https://vendor.com/sla");
    expect(result.trustCenterUrl).toBe("https://vendor.com/trust");
  });

  it("returns null for missing support details", () => {
    const result = parseVendorDetails({});
    expect(result.supportEmail).toBeNull();
    expect(result.supportUrl).toBeNull();
    expect(result.contactEmail).toBeNull();
    expect(result.homePage).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parsePricingTiers
// ---------------------------------------------------------------------------

describe("parsePricingTiers", () => {
  it("filters to annual items only", () => {
    const result = parsePricingTiers(PRICING_JSON);
    // Monthly item (monthsValid=1) should be excluded
    result.forEach((tier) => {
      expect(tier.period).toBe("yr");
    });
  });

  it("selects target unit counts (10, 25, 100, 500)", () => {
    const result = parsePricingTiers(PRICING_JSON);
    expect(result).toHaveLength(4);
    expect(result[0].units).toBe("10 users");
    expect(result[1].units).toBe("25 users");
  });

  it("converts amount from cents to dollars", () => {
    const result = parsePricingTiers(PRICING_JSON);
    expect(result[0].price).toBe("10");   // 1000 / 100
    expect(result[1].price).toBe("25");   // 2500 / 100
  });

  it("uses editionDescription as name when available", () => {
    const result = parsePricingTiers(PRICING_JSON);
    expect(result[0].name).toBe("Starter");
  });

  it("returns empty array for missing items", () => {
    expect(parsePricingTiers({})).toEqual([]);
    expect(parsePricingTiers({ items: [] })).toEqual([]);
  });

  it("falls back to first 6 tiers when no target units match", () => {
    const oddPricing = {
      items: [
        { monthsValid: 12, unitCount: 7, amount: 700 },
        { monthsValid: 12, unitCount: 15, amount: 1500 },
        { monthsValid: 12, unitCount: 30, amount: 3000 },
      ],
    };
    const result = parsePricingTiers(oddPricing);
    expect(result).toHaveLength(3);
    expect(result[0].units).toBe("7 users");
  });
});

// ---------------------------------------------------------------------------
// parseSearchResults
// ---------------------------------------------------------------------------

describe("parseSearchResults", () => {
  it("parses apps from search response", () => {
    const result = parseSearchResults(SEARCH_JSON, "test", 1, 0);
    expect(result.apps).toHaveLength(2);
    expect(result.keyword).toBe("test");
    expect(result.currentPage).toBe(1);
  });

  it("calculates correct position based on offset", () => {
    const result = parseSearchResults(SEARCH_JSON, "test", 3, 100);
    expect(result.apps[0].position).toBe(101);
    expect(result.apps[1].position).toBe(102);
  });

  it("parses totalResults from count field", () => {
    const result = parseSearchResults(SEARCH_JSON, "test", 1, 0);
    expect(result.totalResults).toBe(125);
  });

  it("determines hasNextPage correctly", () => {
    const result = parseSearchResults(SEARCH_JSON, "test", 1, 0);
    // 2 apps fetched, 125 total => more pages
    expect(result.hasNextPage).toBe(true);
  });

  it("sets hasNextPage to false when all results fit on page", () => {
    const smallJson = {
      count: 2,
      _embedded: { addons: SEARCH_JSON._embedded.addons },
    };
    const result = parseSearchResults(smallJson, "test", 1, 0);
    expect(result.hasNextPage).toBe(false);
  });

  it("strips HTML from shortDescription", () => {
    const result = parseSearchResults(SEARCH_JSON, "test", 1, 0);
    expect(result.apps[0].shortDescription).toBe("First app summary");
  });

  it("parses badges for each search result app", () => {
    const result = parseSearchResults(SEARCH_JSON, "test", 1, 0);
    expect(result.apps[0].badges).toContain("cloud_fortified");
    expect(result.apps[0].badges).not.toContain("top_vendor");
    expect(result.apps[1].badges).toContain("top_vendor");
  });

  it("includes vendorName and externalId in extra", () => {
    const result = parseSearchResults(SEARCH_JSON, "test", 1, 0);
    expect(result.apps[0].extra?.vendorName).toBe("Vendor A");
    expect(result.apps[0].extra?.externalId).toBe("1001");
    expect(result.apps[0].extra?.totalInstalls).toBe(30000);
  });

  it("handles empty search results", () => {
    const emptyJson = { count: 0, _embedded: { addons: [] } };
    const result = parseSearchResults(emptyJson, "nothing", 1, 0);
    expect(result.apps).toHaveLength(0);
    expect(result.totalResults).toBe(0);
    expect(result.hasNextPage).toBe(false);
  });

  it("handles missing _embedded gracefully", () => {
    const noEmbedded = { count: 0 };
    const result = parseSearchResults(noEmbedded, "test", 1, 0);
    expect(result.apps).toHaveLength(0);
  });
});
