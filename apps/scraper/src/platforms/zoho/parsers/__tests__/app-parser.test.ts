import { describe, it, expect } from "vitest";
import { parseZohoAppDetails } from "../app-parser.js";
import { validatePlatformData } from "@appranks/shared";

/**
 * Build a minimal HTML page with detailsObject embedded in a <script> tag.
 */
function buildHtml(detailsObj: Record<string, unknown>): string {
  return `<html><head><script>var detailsObject = ${JSON.stringify(detailsObj)};</script></head><body></body></html>`;
}

const SAMPLE_DETAILS_OBJECT = {
  extensionDetails: {
    extensionId: 123456,           // numeric — must be coerced to string
    ext_uuid: "abc-def-ghi",
    namespace: "com.example.crm",
    title: "360 SMS for Zoho CRM",
    tagline: "Send SMS from Zoho CRM",
    about: "Full description of the extension",
    description: "Fallback description",
    pricing: "Free",
    publishedDate: "2023-01-15",
    version: "2.1.0",
    deploymentname: "cloud",
    logo: "/view/logo/123456",
    onestar: 2,
    twostar: 1,
    threestar: 5,
    fourstar: 10,
    fivestar: 30,
    avgrating: 4.35,
  },
  partnerDetails: [
    {
      companyName: "360 SMS App",
      supportEmail: "support@360sms.com",
      partner_uuid: "p-uuid-123",
      websiteUrl: "https://360sms.com",
    },
  ],
  categories: [
    { slug: "telephony" },
    { slug: "crm" },
  ],
};

describe("parseZohoAppDetails", () => {
  it("parses basic app data from detailsObject", () => {
    const html = buildHtml(SAMPLE_DETAILS_OBJECT);
    const result = parseZohoAppDetails(html, "crm--360-sms-for-zoho-crm");

    expect(result.name).toBe("360 SMS for Zoho CRM");
    expect(result.slug).toBe("crm--360-sms-for-zoho-crm");
    expect(result.averageRating).toBe(4.35);
    expect(result.ratingCount).toBe(48); // 2+1+5+10+30
    expect(result.pricingHint).toBe("Free");
  });

  it("coerces numeric extensionId to string", () => {
    const html = buildHtml(SAMPLE_DETAILS_OBJECT);
    const result = parseZohoAppDetails(html, "test-app");

    expect(result.platformData.extensionId).toBe("123456");
    expect(typeof result.platformData.extensionId).toBe("string");
  });

  it("passes Zod validation when extensionId is numeric", () => {
    const html = buildHtml(SAMPLE_DETAILS_OBJECT);
    const result = parseZohoAppDetails(html, "test-app");
    const validation = validatePlatformData("zoho", result.platformData);

    expect(validation.success).toBe(true);
  });

  it("uses undefined (not null) for missing optional fields", () => {
    const detailsObj = {
      extensionDetails: {
        title: "Minimal App",
        // all optional fields missing
      },
      categories: [],
    };
    const html = buildHtml(detailsObj);
    const result = parseZohoAppDetails(html, "minimal-app");

    // These should be undefined, NOT null
    expect(result.platformData.extensionId).toBeUndefined();
    expect(result.platformData.namespace).toBeUndefined();
    expect(result.platformData.tagline).toBeUndefined();
    expect(result.platformData.about).toBeUndefined();
    expect(result.platformData.pricing).toBeUndefined();
    expect(result.platformData.publishedDate).toBeUndefined();
    expect(result.platformData.version).toBeUndefined();
    expect(result.platformData.deploymentType).toBeUndefined();
  });

  it("passes Zod validation when all optional fields are missing", () => {
    const detailsObj = {
      extensionDetails: { title: "Minimal App" },
      categories: [],
    };
    const html = buildHtml(detailsObj);
    const result = parseZohoAppDetails(html, "minimal-app");
    const validation = validatePlatformData("zoho", result.platformData);

    expect(validation.success).toBe(true);
  });

  it("falls back about to description field", () => {
    const detailsObj = {
      extensionDetails: {
        title: "App With Description",
        about: null,
        description: "Fallback description text",
      },
      categories: [],
    };
    const html = buildHtml(detailsObj);
    const result = parseZohoAppDetails(html, "desc-app");

    expect(result.platformData.about).toBe("Fallback description text");
  });

  it("falls back extensionId to ext_uuid when extensionId is missing", () => {
    const detailsObj = {
      extensionDetails: {
        title: "UUID App",
        ext_uuid: "abc-def-ghi",
      },
      categories: [],
    };
    const html = buildHtml(detailsObj);
    const result = parseZohoAppDetails(html, "uuid-app");

    expect(result.platformData.extensionId).toBe("abc-def-ghi");
  });

  it("builds correct icon URL from logo path", () => {
    const html = buildHtml(SAMPLE_DETAILS_OBJECT);
    const result = parseZohoAppDetails(html, "test-app");

    expect(result.iconUrl).toBe("https://marketplace.zoho.com/view/logo/123456");
  });

  it("parses developer info from partnerDetails", () => {
    const html = buildHtml(SAMPLE_DETAILS_OBJECT);
    const result = parseZohoAppDetails(html, "test-app");

    expect(result.developer).toEqual({
      name: "360 SMS App",
      url: "mailto:support@360sms.com",
      website: "https://360sms.com",
    });
  });

  it("extracts category slugs into platformData", () => {
    const html = buildHtml(SAMPLE_DETAILS_OBJECT);
    const result = parseZohoAppDetails(html, "test-app");

    expect(result.platformData.categories).toEqual([
      { slug: "telephony" },
      { slug: "crm" },
    ]);
  });

  it("falls back to DOM parsing when detailsObject is absent", () => {
    const html = `<html><body>
      <h1>Simple App</h1>
      <div class="rating-value">4.2</div>
      <div class="developer-name">Acme Inc</div>
    </body></html>`;
    const result = parseZohoAppDetails(html, "simple-app");

    expect(result.name).toBe("Simple App");
    expect(result.developer).toEqual({ name: "Acme Inc" });
    expect(result.platformData.source).toBe("dom-fallback");
  });

  it("DOM fallback passes Zod validation", () => {
    const html = `<html><body><h1>Test</h1></body></html>`;
    const result = parseZohoAppDetails(html, "test");
    const validation = validatePlatformData("zoho", result.platformData);

    expect(validation.success).toBe(true);
  });
});
