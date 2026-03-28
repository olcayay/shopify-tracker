import { describe, it, expect } from "vitest";
import {
  PLATFORMS,
  PLATFORM_IDS,
  isPlatformId,
  getPlatform,
  needsBrowser,
  buildExternalAppUrl,
  buildExternalCategoryUrl,
} from "../constants/platforms.js";

// ---------------------------------------------------------------------------
// PLATFORMS
// ---------------------------------------------------------------------------
describe("PLATFORMS", () => {
  it("has exactly 11 platforms", () => {
    expect(Object.keys(PLATFORMS)).toHaveLength(11);
  });

  it("each platform has required properties", () => {
    for (const [id, config] of Object.entries(PLATFORMS)) {
      expect(config.id).toBe(id);
      expect(typeof config.name).toBe("string");
      expect(config.name.length).toBeGreaterThan(0);
      expect(config.baseUrl).toMatch(/^https?:\/\//);
      expect(typeof config.hasKeywordSearch).toBe("boolean");
      expect(typeof config.hasReviews).toBe("boolean");
      expect(typeof config.hasFeaturedSections).toBe("boolean");
      expect(typeof config.hasAdTracking).toBe("boolean");
      expect(typeof config.hasSimilarApps).toBe("boolean");
      expect(typeof config.hasAutoSuggestions).toBe("boolean");
      expect(typeof config.hasFeatureTaxonomy).toBe("boolean");
      expect(typeof config.hasPricing).toBe("boolean");
      expect(typeof config.hasLaunchedDate).toBe("boolean");
      expect(typeof config.hasFlatCategories).toBe("boolean");
      expect(config.maxRatingStars).toBeGreaterThan(0);
      expect(config.pageSize).toBeGreaterThan(0);
    }
  });

  it("all platforms have keyword search", () => {
    for (const config of Object.values(PLATFORMS)) {
      expect(config.hasKeywordSearch).toBe(true);
    }
  });

  it("only Shopify has feature taxonomy", () => {
    expect(PLATFORMS.shopify.hasFeatureTaxonomy).toBe(true);
    for (const [id, config] of Object.entries(PLATFORMS)) {
      if (id !== "shopify") {
        expect(config.hasFeatureTaxonomy).toBe(false);
      }
    }
  });

  it("Atlassian has 4-star max rating", () => {
    expect(PLATFORMS.atlassian.maxRatingStars).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// PLATFORM_IDS
// ---------------------------------------------------------------------------
describe("PLATFORM_IDS", () => {
  it("matches PLATFORMS keys", () => {
    expect(new Set(PLATFORM_IDS)).toEqual(new Set(Object.keys(PLATFORMS)));
  });
});

// ---------------------------------------------------------------------------
// isPlatformId
// ---------------------------------------------------------------------------
describe("isPlatformId", () => {
  it("returns true for valid platform IDs", () => {
    for (const id of PLATFORM_IDS) {
      expect(isPlatformId(id)).toBe(true);
    }
  });

  it("returns false for invalid IDs", () => {
    expect(isPlatformId("unknown")).toBe(false);
    expect(isPlatformId("")).toBe(false);
    expect(isPlatformId("Shopify")).toBe(false); // case sensitive
  });
});

// ---------------------------------------------------------------------------
// getPlatform
// ---------------------------------------------------------------------------
describe("getPlatform", () => {
  it("returns config for each platform", () => {
    for (const id of PLATFORM_IDS) {
      const config = getPlatform(id);
      expect(config.id).toBe(id);
    }
  });
});

// ---------------------------------------------------------------------------
// buildExternalAppUrl
// ---------------------------------------------------------------------------
describe("buildExternalAppUrl", () => {
  it("builds Shopify app URL", () => {
    expect(buildExternalAppUrl("shopify", "tidio-live-chat"))
      .toBe("https://apps.shopify.com/tidio-live-chat");
  });

  it("builds Salesforce app URL", () => {
    expect(buildExternalAppUrl("salesforce", "abc123"))
      .toBe("https://appexchange.salesforce.com/appxListingDetail?listingId=abc123");
  });

  it("builds Canva app URL (replaces -- with /)", () => {
    expect(buildExternalAppUrl("canva", "photos--pexels"))
      .toBe("https://www.canva.com/apps/photos/pexels");
  });

  it("builds Wix app URL", () => {
    expect(buildExternalAppUrl("wix", "my-app"))
      .toBe("https://www.wix.com/app-market/web-solution/my-app");
  });

  it("builds WordPress app URL", () => {
    expect(buildExternalAppUrl("wordpress", "yoast-seo"))
      .toBe("https://wordpress.org/plugins/yoast-seo/");
  });

  it("builds Google Workspace app URL (replaces -- with /)", () => {
    expect(buildExternalAppUrl("google_workspace", "app-name--123"))
      .toBe("https://workspace.google.com/marketplace/app/app-name/123");
  });

  it("builds Atlassian app URL with externalId", () => {
    expect(buildExternalAppUrl("atlassian", "groovy-runner", "12345"))
      .toBe("https://marketplace.atlassian.com/apps/12345");
  });

  it("builds Atlassian app URL without externalId (falls back to slug)", () => {
    expect(buildExternalAppUrl("atlassian", "groovy-runner"))
      .toBe("https://marketplace.atlassian.com/apps/groovy-runner");
  });

  it("builds Zoom app URL", () => {
    expect(buildExternalAppUrl("zoom", "my-app"))
      .toBe("https://marketplace.zoom.us/apps/my-app");
  });

  it("builds Zoho app URL (replaces -- with /)", () => {
    expect(buildExternalAppUrl("zoho", "crm--my-extension"))
      .toBe("https://marketplace.zoho.com/app/crm/my-extension");
  });

  it("builds Zendesk app URL with externalId (product type)", () => {
    expect(buildExternalAppUrl("zendesk", "972305--slack", "support"))
      .toBe("https://www.zendesk.com/marketplace/apps/support/972305/slack/");
  });

  it("builds Zendesk app URL without externalId (defaults to support)", () => {
    expect(buildExternalAppUrl("zendesk", "972305--slack"))
      .toBe("https://www.zendesk.com/marketplace/apps/support/972305/slack/");
  });

  it("builds HubSpot app URL", () => {
    expect(buildExternalAppUrl("hubspot", "mailchimp"))
      .toBe("https://ecosystem.hubspot.com/marketplace/listing/mailchimp");
  });
});

// ---------------------------------------------------------------------------
// buildExternalCategoryUrl
// ---------------------------------------------------------------------------
describe("buildExternalCategoryUrl", () => {
  it("builds Shopify category URL", () => {
    expect(buildExternalCategoryUrl("shopify", "marketing"))
      .toBe("https://apps.shopify.com/categories/marketing");
  });

  it("builds Salesforce category URL", () => {
    expect(buildExternalCategoryUrl("salesforce", "sales"))
      .toBe("https://appexchange.salesforce.com/explore/business-needs?category=sales");
  });

  it("builds Canva category URL (uses parent slug for compound)", () => {
    expect(buildExternalCategoryUrl("canva", "photos--stock"))
      .toBe("https://www.canva.com/your-apps/photos");
    expect(buildExternalCategoryUrl("canva", "design"))
      .toBe("https://www.canva.com/your-apps/design");
  });

  it("builds Wix category URL (replaces -- with /)", () => {
    expect(buildExternalCategoryUrl("wix", "marketing--email"))
      .toBe("https://www.wix.com/app-market/category/marketing/email");
  });

  it("builds WordPress tag URL", () => {
    expect(buildExternalCategoryUrl("wordpress", "seo"))
      .toBe("https://wordpress.org/plugins/tags/seo/");
  });

  it("builds WordPress browse URL for _browse_ prefixed slugs", () => {
    expect(buildExternalCategoryUrl("wordpress", "_browse_popular"))
      .toBe("https://wordpress.org/plugins/browse/popular/");
  });

  it("builds Google Workspace category URL", () => {
    expect(buildExternalCategoryUrl("google_workspace", "project-management--tools"))
      .toBe("https://workspace.google.com/marketplace/category/project-management/tools");
  });

  it("builds Atlassian category URL", () => {
    expect(buildExternalCategoryUrl("atlassian", "dev-tools"))
      .toBe("https://marketplace.atlassian.com/categories/dev-tools");
  });

  it("builds Zoom category URL", () => {
    expect(buildExternalCategoryUrl("zoom", "collaboration"))
      .toBe("https://marketplace.zoom.us/apps?category=collaboration");
  });

  it("builds Zoho category URL", () => {
    expect(buildExternalCategoryUrl("zoho", "crm"))
      .toBe("https://marketplace.zoho.com/app/crm");
  });

  it("builds Zendesk category URL", () => {
    expect(buildExternalCategoryUrl("zendesk", "Communication"))
      .toBe("https://www.zendesk.com/marketplace/apps/?categories.name=Communication");
  });

  it("builds HubSpot category URL (replaces -- with /)", () => {
    expect(buildExternalCategoryUrl("hubspot", "sales"))
      .toBe("https://ecosystem.hubspot.com/marketplace/apps/sales");
    expect(buildExternalCategoryUrl("hubspot", "marketing--email"))
      .toBe("https://ecosystem.hubspot.com/marketplace/apps/marketing/email");
  });
});

// ---------------------------------------------------------------------------
// needsBrowser
// ---------------------------------------------------------------------------
describe("needsBrowser", () => {
  it("returns true for always-browser platforms", () => {
    expect(needsBrowser("canva")).toBe(true);
    expect(needsBrowser("google_workspace")).toBe(true);
    expect(needsBrowser("zoho")).toBe(true);
    expect(needsBrowser("zendesk")).toBe(true);
  });

  it("returns false for HTTP-only platforms", () => {
    expect(needsBrowser("shopify")).toBe(false);
    expect(needsBrowser("wix")).toBe(false);
    expect(needsBrowser("wordpress")).toBe(false);
    expect(needsBrowser("atlassian")).toBe(false);
    expect(needsBrowser("zoom")).toBe(false);
    expect(needsBrowser("hubspot")).toBe(false);
  });

  it("supports per-scraper-type granularity for salesforce", () => {
    expect(needsBrowser("salesforce", "app_details")).toBe(true);
    expect(needsBrowser("salesforce", "category")).toBe(false);
    expect(needsBrowser("salesforce")).toBe(true); // any type needs browser
  });
});
