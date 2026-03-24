import { describe, it, expect } from "vitest";
import { atlassianUrls } from "../urls.js";

describe("atlassianUrls", () => {
  describe("base", () => {
    it("has correct base URL", () => {
      expect(atlassianUrls.base).toBe("https://marketplace.atlassian.com");
    });
  });

  describe("app", () => {
    it("builds human-readable app detail URL", () => {
      expect(atlassianUrls.app("com.example.addon")).toBe(
        "https://marketplace.atlassian.com/apps/com.example.addon",
      );
    });
  });

  describe("category", () => {
    it("builds category page URL", () => {
      expect(atlassianUrls.category("project-management")).toBe(
        "https://marketplace.atlassian.com/categories/project-management",
      );
    });
  });

  describe("search", () => {
    it("builds search URL with encoded keyword", () => {
      expect(atlassianUrls.search("time tracking")).toBe(
        "https://marketplace.atlassian.com/search?query=time%20tracking",
      );
    });

    it("encodes special characters in keyword", () => {
      expect(atlassianUrls.search("email & sms")).toBe(
        "https://marketplace.atlassian.com/search?query=email%20%26%20sms",
      );
    });
  });

  describe("apiAddon", () => {
    it("builds REST API addon URL", () => {
      expect(atlassianUrls.apiAddon("com.example.addon")).toBe(
        "https://marketplace.atlassian.com/rest/2/addons/com.example.addon",
      );
    });
  });

  describe("apiSearch", () => {
    it("builds API search URL with default offset and limit", () => {
      expect(atlassianUrls.apiSearch("jira")).toBe(
        "https://marketplace.atlassian.com/rest/2/addons?text=jira&offset=0&limit=50",
      );
    });

    it("builds API search URL with custom offset and limit", () => {
      expect(atlassianUrls.apiSearch("time", 100, 25)).toBe(
        "https://marketplace.atlassian.com/rest/2/addons?text=time&offset=100&limit=25",
      );
    });
  });

  describe("apiReviews", () => {
    it("builds API reviews URL with default offset and limit", () => {
      expect(atlassianUrls.apiReviews("com.example.addon")).toBe(
        "https://marketplace.atlassian.com/rest/2/addons/com.example.addon/reviews?offset=0&limit=50",
      );
    });

    it("builds API reviews URL with custom offset and limit", () => {
      expect(atlassianUrls.apiReviews("com.example.addon", 50, 20)).toBe(
        "https://marketplace.atlassian.com/rest/2/addons/com.example.addon/reviews?offset=50&limit=20",
      );
    });
  });

  describe("apiFeatured", () => {
    it("builds API featured URL with encoded marketing label", () => {
      expect(atlassianUrls.apiFeatured("Rising Star")).toBe(
        "https://marketplace.atlassian.com/rest/2/addons?marketingLabel=Rising%20Star&offset=0&limit=50",
      );
    });

    it("builds API featured URL with simple label", () => {
      expect(atlassianUrls.apiFeatured("Spotlight")).toBe(
        "https://marketplace.atlassian.com/rest/2/addons?marketingLabel=Spotlight&offset=0&limit=50",
      );
    });
  });

  describe("apiVersionLatest", () => {
    it("builds API version latest URL", () => {
      expect(atlassianUrls.apiVersionLatest("com.example.addon")).toBe(
        "https://marketplace.atlassian.com/rest/2/addons/com.example.addon/versions/latest",
      );
    });
  });

  describe("apiVendor", () => {
    it("builds API vendor URL with numeric ID", () => {
      expect(atlassianUrls.apiVendor(9876)).toBe(
        "https://marketplace.atlassian.com/rest/2/vendors/9876",
      );
    });

    it("builds API vendor URL with string ID", () => {
      expect(atlassianUrls.apiVendor("9876")).toBe(
        "https://marketplace.atlassian.com/rest/2/vendors/9876",
      );
    });
  });

  describe("apiPricing", () => {
    it("builds API pricing URL with default hosting (cloud)", () => {
      expect(atlassianUrls.apiPricing("com.example.addon")).toBe(
        "https://marketplace.atlassian.com/rest/2/addons/com.example.addon/pricing/cloud/live",
      );
    });

    it("builds API pricing URL with custom hosting", () => {
      expect(atlassianUrls.apiPricing("com.example.addon", "server")).toBe(
        "https://marketplace.atlassian.com/rest/2/addons/com.example.addon/pricing/server/live",
      );
    });
  });
});
