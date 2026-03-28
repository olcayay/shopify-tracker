import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// backfill-categories.ts extracts category slugs from platform-specific URL
// patterns. The slug extraction logic is the core pure computation inside the
// otherwise DB-heavy job. We test every platform's regex pattern directly.
// ---------------------------------------------------------------------------

// Helper that replicates the slug extraction switch from backfill-categories.ts
function extractCategorySlug(platform: string, url: string): string | null {
  let catSlug: string | null = null;

  if (platform === "shopify") {
    const slugMatch = url.match(/\/categories\/([^/]+)/);
    catSlug = slugMatch?.[1] ?? null;
  } else if (platform === "salesforce") {
    const slugMatch = url.match(/\/collection\/([^/]+)/);
    catSlug = slugMatch?.[1] ?? null;
  } else if (platform === "canva") {
    const slugMatch = url.match(/\/apps\/collection\/([^/]+)/);
    catSlug = slugMatch?.[1] ?? null;
  } else if (platform === "wix") {
    const slugMatch = url.match(/\/category\/([^/?]+)(?:\/([^/?]+))?/);
    catSlug = slugMatch?.[2] ? `${slugMatch[1]}--${slugMatch[2]}` : slugMatch?.[1] ?? null;
  } else if (platform === "wordpress") {
    const tagMatch = url.match(/\/tags\/([^/?]+)/);
    catSlug = tagMatch?.[1] ?? null;
  } else if (platform === "google_workspace") {
    const gwMatch = url.match(/\/marketplace\/category\/([^/?]+)(?:\/([^/?]+))?/);
    catSlug = gwMatch?.[2] ? `${gwMatch[1]}--${gwMatch[2]}` : gwMatch?.[1] ?? null;
  } else if (platform === "zoom") {
    const zoomMatch = url.match(/[?&]category=([^&]+)/);
    catSlug = zoomMatch?.[1] ? decodeURIComponent(zoomMatch[1]) : null;
  } else if (platform === "zoho") {
    const zohoMatch = url.match(/\/app\/([^/?#]+)$/);
    catSlug = zohoMatch?.[1] ?? null;
  } else if (platform === "zendesk") {
    const zendeskMatch = url.match(/[?&]categories\.name=([^&]+)/);
    catSlug = zendeskMatch?.[1] ? decodeURIComponent(zendeskMatch[1]) : null;
  } else if (platform === "hubspot") {
    const hubspotMatch = url.match(/\/marketplace\/apps\/([^?#]+)/);
    catSlug = hubspotMatch?.[1]?.replace(/\/$/, "").replace("/", "--") ?? null;
  } else if (platform === "atlassian") {
    const atlassianMatch = url.match(/\/categories\/([^/?#]+)/);
    catSlug = atlassianMatch?.[1] ?? null;
  }

  return catSlug;
}

// ---------------------------------------------------------------------------
// Shopify
// ---------------------------------------------------------------------------
describe("Shopify slug extraction", () => {
  it("extracts slug from standard category URL", () => {
    expect(
      extractCategorySlug("shopify", "https://apps.shopify.com/categories/store-design")
    ).toBe("store-design");
  });

  it("extracts slug from multi-word category URL", () => {
    expect(
      extractCategorySlug("shopify", "https://apps.shopify.com/categories/marketing-and-conversion")
    ).toBe("marketing-and-conversion");
  });

  it("extracts slug with trailing path segments", () => {
    expect(
      extractCategorySlug("shopify", "https://apps.shopify.com/categories/store-design/sub")
    ).toBe("store-design");
  });

  it("returns null for non-matching URL", () => {
    expect(
      extractCategorySlug("shopify", "https://apps.shopify.com/some-app")
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Salesforce
// ---------------------------------------------------------------------------
describe("Salesforce slug extraction", () => {
  it("extracts slug from collection URL", () => {
    expect(
      extractCategorySlug("salesforce", "https://appexchange.salesforce.com/collection/analytics")
    ).toBe("analytics");
  });

  it("extracts slug from relative URL", () => {
    expect(
      extractCategorySlug("salesforce", "/collection/sales-tools")
    ).toBe("sales-tools");
  });

  it("returns null for non-collection URL", () => {
    expect(
      extractCategorySlug("salesforce", "/appxListingDetail?listingId=abc")
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Canva
// ---------------------------------------------------------------------------
describe("Canva slug extraction", () => {
  it("extracts slug from apps collection URL", () => {
    expect(
      extractCategorySlug("canva", "https://www.canva.com/apps/collection/productivity")
    ).toBe("productivity");
  });

  it("extracts slug from relative URL", () => {
    expect(
      extractCategorySlug("canva", "/apps/collection/social-media")
    ).toBe("social-media");
  });

  it("returns null for non-collection URL", () => {
    expect(
      extractCategorySlug("canva", "/apps/some-app-name")
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Wix
// ---------------------------------------------------------------------------
describe("Wix slug extraction", () => {
  it("extracts top-level category slug", () => {
    expect(
      extractCategorySlug("wix", "https://www.wix.com/app-market/category/marketing")
    ).toBe("marketing");
  });

  it("extracts nested category slug with parent--child format", () => {
    expect(
      extractCategorySlug("wix", "https://www.wix.com/app-market/category/marketing/email-marketing")
    ).toBe("marketing--email-marketing");
  });

  it("handles query parameters after slug", () => {
    expect(
      extractCategorySlug("wix", "/category/analytics?page=1")
    ).toBe("analytics");
  });

  it("returns null for non-category URL", () => {
    expect(
      extractCategorySlug("wix", "/app-market/some-app")
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// WordPress
// ---------------------------------------------------------------------------
describe("WordPress slug extraction", () => {
  it("extracts tag slug from URL", () => {
    expect(
      extractCategorySlug("wordpress", "https://wordpress.org/plugins/tags/seo")
    ).toBe("seo");
  });

  it("extracts multi-word tag slug", () => {
    expect(
      extractCategorySlug("wordpress", "/tags/contact-form")
    ).toBe("contact-form");
  });

  it("handles query parameters", () => {
    expect(
      extractCategorySlug("wordpress", "/tags/ecommerce?page=2")
    ).toBe("ecommerce");
  });

  it("returns null for non-tags URL", () => {
    expect(
      extractCategorySlug("wordpress", "/plugins/woocommerce")
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Google Workspace
// ---------------------------------------------------------------------------
describe("Google Workspace slug extraction", () => {
  it("extracts top-level category slug", () => {
    expect(
      extractCategorySlug("google_workspace", "https://workspace.google.com/marketplace/category/business-tools")
    ).toBe("business-tools");
  });

  it("extracts nested category with parent--child format", () => {
    expect(
      extractCategorySlug("google_workspace", "/marketplace/category/education/classroom-tools")
    ).toBe("education--classroom-tools");
  });

  it("handles query parameters on top-level category", () => {
    expect(
      extractCategorySlug("google_workspace", "/marketplace/category/utilities?hl=en")
    ).toBe("utilities");
  });

  it("returns null for non-category URL", () => {
    expect(
      extractCategorySlug("google_workspace", "/marketplace/app/some-app")
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Zoom
// ---------------------------------------------------------------------------
describe("Zoom slug extraction", () => {
  it("extracts category from query parameter", () => {
    expect(
      extractCategorySlug("zoom", "https://marketplace.zoom.us/apps?category=collaboration")
    ).toBe("collaboration");
  });

  it("decodes URL-encoded category names", () => {
    expect(
      extractCategorySlug("zoom", "/apps?category=Project%20Management")
    ).toBe("Project Management");
  });

  it("extracts category when other query params exist", () => {
    expect(
      extractCategorySlug("zoom", "/apps?page=1&category=security")
    ).toBe("security");
  });

  it("returns null when no category parameter", () => {
    expect(
      extractCategorySlug("zoom", "/apps?page=1")
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Zoho
// ---------------------------------------------------------------------------
describe("Zoho slug extraction", () => {
  it("extracts app category slug from URL", () => {
    expect(
      extractCategorySlug("zoho", "https://marketplace.zoho.com/app/crm")
    ).toBe("crm");
  });

  it("extracts slug from relative URL", () => {
    expect(
      extractCategorySlug("zoho", "/app/analytics")
    ).toBe("analytics");
  });

  it("returns null when URL has query params (prevents false matches)", () => {
    expect(
      extractCategorySlug("zoho", "/app/crm?page=2")
    ).toBeNull();
  });

  it("returns null for non-app URL", () => {
    expect(
      extractCategorySlug("zoho", "/extensions/some-extension")
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Zendesk
// ---------------------------------------------------------------------------
describe("Zendesk slug extraction", () => {
  it("extracts category name from query parameter", () => {
    expect(
      extractCategorySlug("zendesk", "https://www.zendesk.com/marketplace/apps/?categories.name=Productivity")
    ).toBe("Productivity");
  });

  it("decodes URL-encoded category names", () => {
    expect(
      extractCategorySlug("zendesk", "/marketplace/apps/?categories.name=eComm%20and%20Payments")
    ).toBe("eComm and Payments");
  });

  it("extracts when other query params present", () => {
    expect(
      extractCategorySlug("zendesk", "/apps?page=1&categories.name=Analytics")
    ).toBe("Analytics");
  });

  it("returns null when no category parameter", () => {
    expect(
      extractCategorySlug("zendesk", "/marketplace/apps/")
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// HubSpot
// ---------------------------------------------------------------------------
describe("HubSpot slug extraction", () => {
  it("extracts simple slug", () => {
    expect(
      extractCategorySlug("hubspot", "https://ecosystem.hubspot.com/marketplace/apps/sales")
    ).toBe("sales");
  });

  it("extracts nested slug with parent--child format", () => {
    expect(
      extractCategorySlug("hubspot", "/marketplace/apps/marketing/analytics")
    ).toBe("marketing--analytics");
  });

  it("strips trailing slash before extracting", () => {
    expect(
      extractCategorySlug("hubspot", "/marketplace/apps/service/")
    ).toBe("service");
  });

  it("returns null for non-apps URL", () => {
    expect(
      extractCategorySlug("hubspot", "/marketplace/listing/gmail")
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Unknown platform
// ---------------------------------------------------------------------------
describe("Unknown platform", () => {
  it("returns null for unrecognized platform", () => {
    expect(
      extractCategorySlug("unknown_platform", "https://example.com/categories/foo")
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Atlassian
// ---------------------------------------------------------------------------
describe("Atlassian slug extraction", () => {
  it("extracts slug from categories URL", () => {
    expect(
      extractCategorySlug("atlassian", "https://marketplace.atlassian.com/categories/admin-tools")
    ).toBe("admin-tools");
  });

  it("extracts slug from relative categories URL", () => {
    expect(
      extractCategorySlug("atlassian", "/categories/testing-tools")
    ).toBe("testing-tools");
  });

  it("handles query parameters", () => {
    expect(
      extractCategorySlug("atlassian", "/categories/reporting?page=2")
    ).toBe("reporting");
  });

  it("returns null for non-categories URL", () => {
    expect(
      extractCategorySlug("atlassian", "https://marketplace.atlassian.com/apps/1234")
    ).toBeNull();
  });
});
