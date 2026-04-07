import { describe, it, expect } from "vitest";
import { zendeskUrls } from "../urls.js";

describe("zendeskUrls", () => {
  describe("base", () => {
    it("has correct base URL", () => {
      expect(zendeskUrls.base).toBe("https://www.zendesk.com/marketplace");
    });
  });

  describe("app", () => {
    it("builds app detail URL with default product (support)", () => {
      expect(zendeskUrls.app("972305--slack")).toBe(
        "https://www.zendesk.com/marketplace/apps/support/972305/slack/",
      );
    });

    it("builds app detail URL with specified product", () => {
      expect(zendeskUrls.app("972305--slack", "chat")).toBe(
        "https://www.zendesk.com/marketplace/apps/chat/972305/slack/",
      );
    });

    it("builds app detail URL for sell product", () => {
      expect(zendeskUrls.app("123--sell-app", "sell")).toBe(
        "https://www.zendesk.com/marketplace/apps/sell/123/sell-app/",
      );
    });

    it("handles slug with multiple dashes in text part", () => {
      expect(zendeskUrls.app("849231--stylo-assist")).toBe(
        "https://www.zendesk.com/marketplace/apps/support/849231/stylo-assist/",
      );
    });

    it("handles slug where text part contains --", () => {
      // Slug format: {numericId}--{text-slug}
      // split("--") on "100--some--thing" gives ["100", "some", "thing"]
      // rest.join("-") gives "some-thing"
      expect(zendeskUrls.app("100--some--thing")).toBe(
        "https://www.zendesk.com/marketplace/apps/support/100/some-thing/",
      );
    });
  });

  describe("category", () => {
    it("builds category URL with display name encoding", () => {
      expect(zendeskUrls.category("ai-and-bots")).toBe(
        "https://www.zendesk.com/marketplace/apps/?categories.name=AI+and+Bots",
      );
    });

    it("builds category URL for ecommerce with quirky display name", () => {
      expect(zendeskUrls.category("ecommerce-and-payments")).toBe(
        "https://www.zendesk.com/marketplace/apps/?categories.name=eComm+and+Payments",
      );
    });

    it("builds category URL for WEM", () => {
      expect(zendeskUrls.category("wem")).toBe(
        "https://www.zendesk.com/marketplace/apps/?categories.name=WEM",
      );
    });

    it("builds category URL with page parameter", () => {
      expect(zendeskUrls.category("messaging", 2)).toBe(
        "https://www.zendesk.com/marketplace/apps/?page=2&categories.name=Messaging",
      );
    });

    it("does not add page parameter for page 1", () => {
      expect(zendeskUrls.category("messaging", 1)).toBe(
        "https://www.zendesk.com/marketplace/apps/?categories.name=Messaging",
      );
    });

    it("does not add page parameter when page is undefined", () => {
      expect(zendeskUrls.category("messaging")).toBe(
        "https://www.zendesk.com/marketplace/apps/?categories.name=Messaging",
      );
    });

    it("falls back to slug as display name for unknown categories", () => {
      expect(zendeskUrls.category("unknown-slug")).toBe(
        "https://www.zendesk.com/marketplace/apps/?categories.name=unknown-slug",
      );
    });

    it("encodes special characters in category names", () => {
      // "Security, Risk and Compliance" contains a comma
      expect(zendeskUrls.category("security-risk-and-compliance")).toBe(
        "https://www.zendesk.com/marketplace/apps/?categories.name=Security%2C+Risk+and+Compliance",
      );
    });
  });

  describe("search", () => {
    it("builds search URL with encoded keyword", () => {
      expect(zendeskUrls.search("chat bot")).toBe(
        "https://www.zendesk.com/marketplace/apps/?query=chat%20bot",
      );
    });

    it("builds search URL with single word", () => {
      expect(zendeskUrls.search("slack")).toBe(
        "https://www.zendesk.com/marketplace/apps/?query=slack",
      );
    });

    it("encodes special characters", () => {
      expect(zendeskUrls.search("email & sms")).toBe(
        "https://www.zendesk.com/marketplace/apps/?query=email%20%26%20sms",
      );
    });
  });

  describe("homepage", () => {
    it("returns the marketplace apps page URL", () => {
      expect(zendeskUrls.homepage()).toBe(
        "https://www.zendesk.com/marketplace/apps/",
      );
    });
  });

  describe("reviews", () => {
    it("builds REST API review URL from slug", () => {
      expect(zendeskUrls.reviews("972305--slack")).toBe(
        "https://marketplace.zendesk.com/api/v2/apps/972305/reviews.json",
      );
    });

    it("extracts numeric ID from slug for API URL", () => {
      expect(zendeskUrls.reviews("849231--stylo-assist")).toBe(
        "https://marketplace.zendesk.com/api/v2/apps/849231/reviews.json",
      );
    });

    it("ignores product parameter (API is product-agnostic)", () => {
      expect(zendeskUrls.reviews("972305--slack", "chat")).toBe(
        "https://marketplace.zendesk.com/api/v2/apps/972305/reviews.json",
      );
    });
  });
});
