import { describe, it, expect } from "vitest";
import { hubspotUrls } from "../urls.js";

describe("hubspotUrls", () => {
  describe("base", () => {
    it("is the HubSpot marketplace root", () => {
      expect(hubspotUrls.base).toBe("https://ecosystem.hubspot.com/marketplace");
    });
  });

  describe("app", () => {
    it("builds app detail URL", () => {
      expect(hubspotUrls.app("mailchimp"))
        .toBe("https://ecosystem.hubspot.com/marketplace/listing/mailchimp");
    });

    it("builds URL for slug with hyphens", () => {
      expect(hubspotUrls.app("salesforce-hubspot"))
        .toBe("https://ecosystem.hubspot.com/marketplace/listing/salesforce-hubspot");
    });
  });

  describe("category", () => {
    it("builds category URL without page", () => {
      expect(hubspotUrls.category("sales"))
        .toBe("https://ecosystem.hubspot.com/marketplace/apps/sales");
    });

    it("builds category URL for page 1 (no param)", () => {
      expect(hubspotUrls.category("sales", 1))
        .toBe("https://ecosystem.hubspot.com/marketplace/apps/sales");
    });

    it("builds category URL with page > 1", () => {
      expect(hubspotUrls.category("marketing", 3))
        .toBe("https://ecosystem.hubspot.com/marketplace/apps/marketing?page=3");
    });
  });

  describe("search", () => {
    it("builds search URL", () => {
      expect(hubspotUrls.search("email marketing"))
        .toBe("https://ecosystem.hubspot.com/marketplace/explore?query=email%20marketing");
    });

    it("encodes special characters", () => {
      expect(hubspotUrls.search("CRM & sales"))
        .toBe("https://ecosystem.hubspot.com/marketplace/explore?query=CRM%20%26%20sales");
    });
  });

  describe("homepage", () => {
    it("returns marketplace root", () => {
      expect(hubspotUrls.homepage())
        .toBe("https://ecosystem.hubspot.com/marketplace");
    });
  });

  describe("reviews", () => {
    it("returns same URL as app (reviews on detail page)", () => {
      expect(hubspotUrls.reviews("mailchimp"))
        .toBe(hubspotUrls.app("mailchimp"));
    });
  });

  describe("featured", () => {
    it("builds featured collection URL", () => {
      expect(hubspotUrls.featured("top-rated"))
        .toBe("https://ecosystem.hubspot.com/marketplace/featured/top-rated");
    });
  });
});
