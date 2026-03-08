import { describe, it, expect } from "vitest";
import {
  buildExternalAppUrl,
  buildExternalCategoryUrl,
  buildExternalSearchUrl,
  buildExternalKeywordUrl,
  getPlatformName,
  formatCategoryTitle,
} from "@/lib/platform-urls";

describe("buildExternalAppUrl", () => {
  it("shopify → apps.shopify.com/{slug}", () => {
    expect(buildExternalAppUrl("shopify", "my-app")).toBe(
      "https://apps.shopify.com/my-app"
    );
  });

  it("salesforce → appxListingDetail?listingId={slug}", () => {
    expect(buildExternalAppUrl("salesforce", "a0N4V00000JTeWyUAL")).toBe(
      "https://appexchange.salesforce.com/appxListingDetail?listingId=a0N4V00000JTeWyUAL"
    );
  });

  it("canva → canva.com/apps/{slug}", () => {
    expect(buildExternalAppUrl("canva", "some-app")).toBe(
      "https://www.canva.com/apps/some-app"
    );
  });
});

describe("buildExternalCategoryUrl", () => {
  it("shopify → apps.shopify.com/categories/{slug}", () => {
    expect(buildExternalCategoryUrl("shopify", "marketing")).toBe(
      "https://apps.shopify.com/categories/marketing"
    );
  });

  it("salesforce → explore/business-needs?category={slug}", () => {
    expect(buildExternalCategoryUrl("salesforce", "sales")).toBe(
      "https://appexchange.salesforce.com/explore/business-needs?category=sales"
    );
  });

  it("canva → canva.com/your-apps/{slug}", () => {
    expect(buildExternalCategoryUrl("canva", "design")).toBe(
      "https://www.canva.com/your-apps/design"
    );
  });

  it("canva compound slug → uses parent slug in URL", () => {
    expect(buildExternalCategoryUrl("canva", "project-management--forms")).toBe(
      "https://www.canva.com/your-apps/project-management"
    );
  });
});

describe("buildExternalSearchUrl", () => {
  it("shopify → search?q={query}", () => {
    expect(buildExternalSearchUrl("shopify", "email")).toBe(
      "https://apps.shopify.com/search?q=email"
    );
  });

  it("salesforce → appxSearchKeywordResults?keywords={query}", () => {
    expect(buildExternalSearchUrl("salesforce", "forms")).toBe(
      "https://appexchange.salesforce.com/appxSearchKeywordResults?keywords=forms"
    );
  });

  it("canva → your-apps?q={query}", () => {
    expect(buildExternalSearchUrl("canva", "photo")).toBe(
      "https://www.canva.com/your-apps?q=photo"
    );
  });

  it("encodes special characters (spaces → %20)", () => {
    expect(buildExternalSearchUrl("shopify", "email marketing")).toBe(
      "https://apps.shopify.com/search?q=email%20marketing"
    );
  });
});

describe("buildExternalKeywordUrl", () => {
  it("delegates to buildExternalSearchUrl", () => {
    expect(buildExternalKeywordUrl("shopify", "seo")).toBe(
      buildExternalSearchUrl("shopify", "seo")
    );
  });
});

describe("formatCategoryTitle", () => {
  it("returns title as-is for non-Canva platforms", () => {
    expect(formatCategoryTitle("shopify", "marketing", "Marketing")).toBe("Marketing");
  });

  it("returns title as-is for Canva simple slugs", () => {
    expect(formatCategoryTitle("canva", "project-management", "Project management")).toBe("Project management");
  });

  it("prepends parent for Canva compound slugs", () => {
    expect(formatCategoryTitle("canva", "project-management--forms", "Forms")).toBe("Project management › Forms");
  });

  it("handles multi-word parent slugs", () => {
    expect(formatCategoryTitle("canva", "video-and-animation--flipbooks", "Flipbooks")).toBe("Video and animation › Flipbooks");
  });
});

describe("getPlatformName", () => {
  it('shopify → "Shopify App Store"', () => {
    expect(getPlatformName("shopify")).toBe("Shopify App Store");
  });

  it('salesforce → "Salesforce AppExchange"', () => {
    expect(getPlatformName("salesforce")).toBe("Salesforce AppExchange");
  });

  it('canva → "Canva Apps"', () => {
    expect(getPlatformName("canva")).toBe("Canva Apps");
  });
});
