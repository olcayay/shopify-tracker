import { describe, it, expect } from "vitest";
import { extractPlatform, extractSection, isOnPlatformPage, isOnGlobalPage, getNavItems, systemAdminItems, globalNavItems } from "../../lib/nav-utils";

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

  describe("isOnPlatformPage", () => {
    it("returns true for platform paths", () => {
      expect(isOnPlatformPage("/shopify/overview")).toBe(true);
      expect(isOnPlatformPage("/salesforce/keywords/slug")).toBe(true);
      expect(isOnPlatformPage("/hubspot/apps")).toBe(true);
    });

    it("returns false for non-platform paths", () => {
      expect(isOnPlatformPage("/overview")).toBe(false);
      expect(isOnPlatformPage("/settings")).toBe(false);
      expect(isOnPlatformPage("/system-admin")).toBe(false);
      expect(isOnPlatformPage("/")).toBe(false);
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

    it("includes research only when market-research feature flag is enabled", () => {
      const withFlag = getNavItems("shopify", false, ["market-research"]);
      expect(withFlag.some((i) => i.label === "Research")).toBe(true);

      const withoutFlag = getNavItems("shopify", false, []);
      expect(withoutFlag.some((i) => i.label === "Research")).toBe(false);

      const noFeatures = getNavItems("shopify");
      expect(noFeatures.some((i) => i.label === "Research")).toBe(false);

      // Works for any platform, not just shopify
      const salesforceWithFlag = getNavItems("salesforce", false, ["market-research"]);
      expect(salesforceWithFlag.some((i) => i.label === "Research")).toBe(true);
    });

    it("includes developers for all users", () => {
      const regular = getNavItems("shopify", false);
      expect(regular.some((i) => i.label === "Developers")).toBe(true);

      const admin = getNavItems("shopify", true);
      expect(admin.some((i) => i.label === "Developers")).toBe(true);
    });
  });

  describe("isOnGlobalPage", () => {
    it("returns true for global pages", () => {
      expect(isOnGlobalPage("/overview")).toBe(true);
      expect(isOnGlobalPage("/apps")).toBe(true);
      expect(isOnGlobalPage("/apps/some-slug")).toBe(true);
      expect(isOnGlobalPage("/keywords")).toBe(true);
      expect(isOnGlobalPage("/competitors")).toBe(true);
      expect(isOnGlobalPage("/developers")).toBe(true);
      expect(isOnGlobalPage("/notifications")).toBe(true);
      expect(isOnGlobalPage("/settings")).toBe(true);
      expect(isOnGlobalPage("/settings/email-preferences")).toBe(true);
    });

    it("returns false for non-global pages", () => {
      expect(isOnGlobalPage("/system-admin")).toBe(false);
      expect(isOnGlobalPage("/shopify/apps")).toBe(false);
      expect(isOnGlobalPage("/")).toBe(false);
    });
  });

  describe("globalNavItems", () => {
    it("has correct items", () => {
      const labels = globalNavItems.map((i) => i.label);
      expect(labels).toEqual(["Overview", "All Apps", "All Keywords", "All Competitors", "Developers", "Notifications", "Support", "Organization", "Settings"]);
    });

    it("Overview is exact match", () => {
      const overview = globalNavItems.find((i) => i.label === "Overview");
      expect(overview?.exact).toBe(true);
    });
  });

  describe("systemAdminItems", () => {
    it("has correct number of items", () => {
      expect(systemAdminItems.length).toBe(26);
    });

    it("includes Feature Flags link", () => {
      const labels = systemAdminItems.map((i) => i.label);
      expect(labels).toContain("Feature Flags");
    });

    it("includes Notifications, Notification Templates, Emails, and Email Templates links", () => {
      const labels = systemAdminItems.map((i) => i.label);
      expect(labels).toContain("Notifications");
      expect(labels).toContain("Notification Templates");
      expect(labels).toContain("Emails");
      expect(labels).toContain("Email Templates");
    });

    it("Notification Templates comes right after Notifications", () => {
      const labels = systemAdminItems.map((i) => i.label);
      const notifIdx = labels.indexOf("Notifications");
      expect(labels[notifIdx + 1]).toBe("Notification Templates");
    });

    it("Email Templates comes right after Emails", () => {
      const labels = systemAdminItems.map((i) => i.label);
      const emailsIdx = labels.indexOf("Emails");
      expect(labels[emailsIdx + 1]).toBe("Email Templates");
    });

    it("all items have /system-admin prefix", () => {
      for (const item of systemAdminItems) {
        expect(item.href).toMatch(/^\/system-admin/);
      }
    });
  });
});
