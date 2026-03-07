import { describe, it, expect } from "vitest";
import {
  buildExternalAppUrl,
  buildExternalCategoryUrl,
  buildExternalSearchUrl,
  buildExternalKeywordUrl,
  getPlatformName,
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

  it("canva → canva.com/apps/collections/{slug}", () => {
    expect(buildExternalCategoryUrl("canva", "design")).toBe(
      "https://www.canva.com/apps/collections/design"
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

  it("canva → apps/search?q={query}", () => {
    expect(buildExternalSearchUrl("canva", "photo")).toBe(
      "https://www.canva.com/apps/search?q=photo"
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
