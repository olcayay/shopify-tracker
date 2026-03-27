import { describe, it, expect } from "vitest";
import { extractPlatform, extractSection, getNavItems, systemAdminItems } from "../../lib/nav-utils";

describe("nav-utils", () => {
  describe("extractPlatform", () => {
    it("extracts shopify from /shopify/overview", () => {
      expect(extractPlatform("/shopify/overview")).toBe("shopify");
    });

    it("extracts salesforce from /salesforce/keywords/slug", () => {
      expect(extractPlatform("/salesforce/keywords/slug")).toBe("salesforce");
    });

    it("extracts hubspot from /hubspot/apps", () => {
      expect(extractPlatform("/hubspot/apps")).toBe("hubspot");
    });

    it("defaults to shopify for non-platform paths", () => {
      expect(extractPlatform("/overview")).toBe("shopify");
      expect(extractPlatform("/settings")).toBe("shopify");
      expect(extractPlatform("/system-admin")).toBe("shopify");
    });
  });

  describe("extractSection", () => {
    it("extracts keywords from /shopify/keywords", () => {
      expect(extractSection("/shopify/keywords")).toBe("keywords");
    });

    it("extracts overview from /salesforce/overview", () => {
      expect(extractSection("/salesforce/overview")).toBe("overview");
    });

    it("extracts apps from /hubspot/apps/some-slug", () => {
      expect(extractSection("/hubspot/apps/some-slug")).toBe("apps");
    });

    it("returns null for non-platform paths", () => {
      expect(extractSection("/overview")).toBeNull();
      expect(extractSection("/settings")).toBeNull();
    });
  });

  describe("getNavItems", () => {
    it("always includes overview, apps, competitors", () => {
      const items = getNavItems("shopify");
      const labels = items.map((i) => i.label);
      expect(labels).toContain("Overview");
      expect(labels).toContain("Apps");
      expect(labels).toContain("Competitors");
    });

    it("includes keywords for platforms with hasKeywordSearch", () => {
      const shopifyItems = getNavItems("shopify");
      expect(shopifyItems.some((i) => i.label === "Keywords")).toBe(true);
    });

    it("includes featured for platforms with hasFeaturedSections", () => {
      const shopifyItems = getNavItems("shopify");
      expect(shopifyItems.some((i) => i.label === "Featured")).toBe(true);
    });

    it("shows Tags instead of Categories for wordpress", () => {
      const items = getNavItems("wordpress");
      expect(items.some((i) => i.label === "Tags")).toBe(true);
      expect(items.some((i) => i.label === "Categories")).toBe(false);
    });

    it("includes research only for shopify", () => {
      const shopifyItems = getNavItems("shopify");
      expect(shopifyItems.some((i) => i.label === "Research")).toBe(true);

      const salesforceItems = getNavItems("salesforce");
      expect(salesforceItems.some((i) => i.label === "Research")).toBe(false);
    });

    it("includes developers only for admin", () => {
      const regular = getNavItems("shopify", false);
      expect(regular.some((i) => i.label === "Developers")).toBe(false);

      const admin = getNavItems("shopify", true);
      expect(admin.some((i) => i.label === "Developers")).toBe(true);
    });
  });

  describe("systemAdminItems", () => {
    it("has correct number of items", () => {
      expect(systemAdminItems.length).toBe(13);
    });

    it("all items have /system-admin prefix", () => {
      for (const item of systemAdminItems) {
        expect(item.href).toMatch(/^\/system-admin/);
      }
    });
  });
});
