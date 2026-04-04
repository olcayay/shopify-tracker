/**
 * Parser → Schema conformance tests (PLA-651).
 *
 * Part 1: CommonAppDetails and AppDetails schema conformance (existing)
 * Part 2: Per-platform platformData → Zod schema conformance
 *
 * Catches bugs where parser returns null but schema expects undefined,
 * or a field has the wrong type (e.g. extensionId: number vs string).
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validatePlatformData } from "../types/platform-data/schemas.js";
import type { PlatformId } from "../constants/platforms.js";

// ── Helpers ────────────────────────────────────────────────────────

function expectValid(platform: PlatformId, data: Record<string, unknown>) {
  const result = validatePlatformData(platform, data);
  if (!result.success) {
    const errors = result.errors.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`
    );
    throw new Error(
      `Validation failed for ${platform}:\n${errors.join("\n")}`
    );
  }
  expect(result.success).toBe(true);
}

function expectInvalid(platform: PlatformId, data: Record<string, unknown>) {
  const result = validatePlatformData(platform, data);
  expect(result.success).toBe(false);
}

/**
 * Ensure no field is `null` unless the schema explicitly allows it
 * via `.nullable()`. Catches the most common parser→schema mismatch.
 */
function assertNoUnexpectedNulls(
  platform: PlatformId,
  data: Record<string, unknown>,
  allowedNullFields: string[] = []
) {
  for (const [key, value] of Object.entries(data)) {
    if (value === null && !allowedNullFields.includes(key)) {
      const testData = { [key]: null };
      const result = validatePlatformData(platform, testData);
      if (!result.success) {
        throw new Error(
          `${platform}.${key} is null but schema rejects null. ` +
            `Use undefined instead, or add .nullable() to the schema.`
        );
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// Part 1: CommonAppDetails / AppDetails (existing tests preserved)
// ══════════════════════════════════════════════════════════════════

const CommonAppDetailsSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  iconUrl: z.string().nullable(),
  averageRating: z.number().nullable(),
  ratingCount: z.number().nullable(),
  pricingHint: z.string().nullable(),
  developer: z.object({
    name: z.string(),
    url: z.string().optional(),
    website: z.string().optional(),
  }).nullable(),
  badges: z.array(z.string()),
});

const AppDetailsSchema = z.object({
  app_slug: z.string().min(1),
  app_name: z.string().min(1),
  icon_url: z.string().nullable(),
  app_introduction: z.string(),
  app_details: z.string(),
  seo_title: z.string(),
  seo_meta_description: z.string(),
  features: z.array(z.string()),
  pricing: z.string(),
  average_rating: z.number().nullable(),
  rating_count: z.number().nullable(),
  developer: z.object({
    name: z.string(),
    url: z.string().optional(),
    website: z.string().optional(),
    email: z.string().optional(),
  }),
  launched_date: z.date().nullable(),
  demo_store_url: z.string().nullable(),
  languages: z.array(z.string()),
  integrations: z.array(z.string()),
  categories: z.array(z.object({
    title: z.string(),
    url: z.string(),
  })),
  pricing_plans: z.array(z.object({
    name: z.string(),
    price: z.string().nullable(),
  }).passthrough()),
  support: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    docs_url: z.string().optional(),
  }).nullable().optional(),
  screenshots: z.array(z.string()).optional(),
});

describe("CommonAppDetails schema conformance", () => {
  it("validates a correct object", () => {
    const valid = {
      name: "Test App",
      slug: "test-app",
      iconUrl: "https://cdn.example.com/icon.png",
      averageRating: 4.5,
      ratingCount: 123,
      pricingHint: "Free plan available",
      developer: { name: "Test Dev", url: "https://testdev.com" },
      badges: ["verified"],
    };
    expect(() => CommonAppDetailsSchema.parse(valid)).not.toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() => CommonAppDetailsSchema.parse({ name: "Test", slug: "test" })).toThrow();
  });

  it("allows null values for nullable fields", () => {
    const withNulls = {
      name: "Test App",
      slug: "test-app",
      iconUrl: null,
      averageRating: null,
      ratingCount: null,
      pricingHint: null,
      developer: null,
      badges: [],
    };
    expect(() => CommonAppDetailsSchema.parse(withNulls)).not.toThrow();
  });
});

describe("AppDetails schema conformance", () => {
  it("validates a full detail object", () => {
    const valid = {
      app_slug: "test-app",
      app_name: "Test App",
      icon_url: null,
      app_introduction: "A test app",
      app_details: "Detailed description",
      seo_title: "Test App",
      seo_meta_description: "A great test app",
      features: ["Feature 1"],
      pricing: "Free",
      average_rating: 4.2,
      rating_count: 50,
      developer: { name: "Dev Co" },
      launched_date: null,
      demo_store_url: null,
      languages: ["en"],
      integrations: [],
      categories: [{ title: "Tools", url: "/categories/tools" }],
      pricing_plans: [{ name: "Free", price: "$0" }],
      support: null,
    };
    expect(() => AppDetailsSchema.parse(valid)).not.toThrow();
  });

  it("rejects empty slug", () => {
    const invalid = {
      app_slug: "",
      app_name: "Test",
      icon_url: null,
      app_introduction: "",
      app_details: "",
      seo_title: "",
      seo_meta_description: "",
      features: [],
      pricing: "",
      average_rating: null,
      rating_count: null,
      developer: { name: "Dev" },
      launched_date: null,
      demo_store_url: null,
      languages: [],
      integrations: [],
      categories: [],
      pricing_plans: [],
      support: null,
    };
    expect(() => AppDetailsSchema.parse(invalid)).toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// Part 2: Per-platform platformData conformance (PLA-651)
// ══════════════════════════════════════════════════════════════════

describe("shopify platformData conformance", () => {
  const fullData = {
    appIntroduction: "Track your store's performance.",
    appDetails: "<h2>Features</h2>",
    seoTitle: "Analytics Pro - Shopify App Store",
    seoMetaDescription: "Best analytics app.",
    languages: ["en", "de", "fr"],
    demoStoreUrl: "https://demo.myshopify.com",
    similarApps: [
      { slug: "analytics-buddy", name: "Analytics Buddy" },
    ],
  };

  it("validates full output", () => expectValid("shopify", fullData));
  it("validates minimal output", () => expectValid("shopify", {}));
  it("validates extra fields (passthrough)", () => expectValid("shopify", { ...fullData, custom: "x" }));
  it("rejects wrong types", () => {
    expectInvalid("shopify", { languages: "not-array" });
    expectInvalid("shopify", { similarApps: [{ slug: 123 }] });
  });
  it("no unexpected nulls", () => assertNoUnexpectedNulls("shopify", fullData));
});

describe("salesforce platformData conformance", () => {
  const fullData = {
    description: "CRM solution.",
    fullDescription: "Complete CRM platform.",
    highlights: ["Easy setup", "AI insights"],
    publishedDate: "2023-06-15",
    languages: ["en", "es"],
    productsSupported: ["Sales Cloud"],
    productsRequired: ["Salesforce Platform"],
    pricingModelType: "SUBSCRIPTION",
    supportedIndustries: ["Technology"],
    targetUserPersona: ["Sales Manager"],
    businessNeeds: ["Lead Management"],
  };

  it("validates full output", () => expectValid("salesforce", fullData));
  it("validates minimal output", () => expectValid("salesforce", {}));
  it("allows null publishedDate", () => expectValid("salesforce", { publishedDate: null }));
  it("allows null pricingModelType", () => expectValid("salesforce", { pricingModelType: null }));
  it("rejects null in non-nullable", () => {
    expectInvalid("salesforce", { description: null });
    expectInvalid("salesforce", { highlights: null });
  });
  it("no unexpected nulls", () => assertNoUnexpectedNulls("salesforce", fullData, ["publishedDate", "pricingModelType"]));
});

describe("canva platformData conformance", () => {
  const fullData = {
    canvaAppId: "AAF_8lkU9VE",
    canvaAppType: "SDK_APP",
    description: "Create presentations.",
    tagline: "Design made easy",
    fullDescription: "Comprehensive design tool.",
    topics: ["marketplace_topic.ai_audio"],
    urlSlug: "design-pro",
    screenshots: ["https://cdn.canva.com/ss1.png"],
    languages: ["en", "fr"],
    promoCardUrl: "https://cdn.canva.com/promo.png",
    developerEmail: "dev@example.com",
    developerPhone: "+1234567890",
    developerAddress: { street: "123 Main", city: "SF", country: "US", state: "CA", zip: "94105" },
    termsUrl: "https://example.com/terms",
    privacyUrl: "https://example.com/privacy",
    permissions: [{ scope: "read_design", type: "MANDATORY" }],
  };

  it("validates full output", () => expectValid("canva", fullData));
  it("validates minimal output", () => expectValid("canva", {}));
  it("allows null developerAddress", () => expectValid("canva", { developerAddress: null }));
  it("rejects null in non-nullable", () => {
    expectInvalid("canva", { description: null });
    expectInvalid("canva", { screenshots: null });
  });
  it("no unexpected nulls", () => assertNoUnexpectedNulls("canva", fullData, ["developerAddress"]));
});

describe("wix platformData conformance", () => {
  const fullData = {
    tagline: "Build your store.",
    description: "E-commerce for Wix.",
    benefits: ["Easy setup", "Mobile responsive"],
    demoUrl: "https://demo.wix.com/store",
    isFreeApp: false,
    trialDays: 14,
    languages: ["en", "es"],
    isAvailableWorldwide: true,
  };

  it("validates full output", () => expectValid("wix", fullData));
  it("validates minimal output", () => expectValid("wix", {}));
  it("rejects null in non-nullable", () => {
    expectInvalid("wix", { demoUrl: null });
    expectInvalid("wix", { benefits: null });
    expectInvalid("wix", { isFreeApp: null });
  });
  it("accepts undefined demoUrl", () => expectValid("wix", { ...fullData, demoUrl: undefined }));
  it("no unexpected nulls", () => assertNoUnexpectedNulls("wix", fullData));
});

describe("wordpress platformData conformance", () => {
  const fullData = {
    shortDescription: "SEO plugin for WordPress.",
    version: "7.5.2",
    testedUpTo: "6.5",
    requiresWP: "5.6",
    requiresPHP: "7.4",
    activeInstalls: 5000000,
    downloaded: 250000000,
    lastUpdated: "2024-03-15",
    added: "2010-07-15",
    businessModel: "freemium",
  };

  it("validates full output", () => expectValid("wordpress", fullData));
  it("validates minimal output", () => expectValid("wordpress", {}));
  it("rejects wrong types", () => {
    expectInvalid("wordpress", { activeInstalls: "5000000" });
    expectInvalid("wordpress", { version: 7.5 });
  });
  it("rejects null", () => {
    expectInvalid("wordpress", { shortDescription: null });
    expectInvalid("wordpress", { activeInstalls: null });
  });
  it("no unexpected nulls", () => assertNoUnexpectedNulls("wordpress", fullData));
});

describe("google_workspace platformData conformance", () => {
  const fullData = {
    googleWorkspaceAppId: "123456789",
    shortDescription: "Gmail CRM integration.",
    detailedDescription: "Full integration.",
    category: "CRM",
    pricingModel: "FREE",
    screenshots: ["https://lh3.googleusercontent.com/ss1.png"],
    worksWithApps: ["Gmail", "Calendar"],
    casaCertified: true,
    installCount: 50000,
  };

  it("validates full output", () => expectValid("google_workspace", fullData));
  it("validates minimal output", () => expectValid("google_workspace", {}));
  it("allows null installCount", () => expectValid("google_workspace", { installCount: null }));
  it("rejects null in non-nullable", () => {
    expectInvalid("google_workspace", { shortDescription: null });
    expectInvalid("google_workspace", { casaCertified: null });
  });
  it("no unexpected nulls", () => assertNoUnexpectedNulls("google_workspace", fullData, ["installCount"]));
});

describe("atlassian platformData conformance", () => {
  const fullData = {
    appId: 12345,
    tagLine: "Project management.",
    summary: "Lightweight tracker.",
    description: "<p>Plugin description.</p>",
    totalInstalls: 15000,
    cloudFortified: true,
    topVendor: false,
    bugBountyParticipant: true,
    version: "3.2.1",
    paymentModel: "PAID_VIA_ATLASSIAN",
    releaseDate: "2021-04-10",
    licenseType: "COMMERCIAL",
  };

  it("validates full output", () => expectValid("atlassian", fullData));
  it("validates minimal output", () => expectValid("atlassian", {}));
  it("rejects wrong types", () => {
    expectInvalid("atlassian", { appId: "12345" });
    expectInvalid("atlassian", { cloudFortified: "yes" });
    expectInvalid("atlassian", { totalInstalls: "15000" });
  });
  it("rejects null", () => {
    expectInvalid("atlassian", { tagLine: null });
    expectInvalid("atlassian", { cloudFortified: null });
  });
  it("no unexpected nulls", () => assertNoUnexpectedNulls("atlassian", fullData));
});

describe("zoom platformData conformance", () => {
  const fullData = {
    description: "Schedule Zoom meetings.",
    companyName: "Calendly LLC",
    worksWith: ["ZOOM_MEETING", "ZOOM_WEBINAR"],
    usage: "USER_OPERATION",
    fedRampAuthorized: false,
    essentialApp: true,
  };

  it("validates full output", () => expectValid("zoom", fullData));
  it("validates minimal output", () => expectValid("zoom", {}));
  it("rejects null", () => {
    expectInvalid("zoom", { description: null });
    expectInvalid("zoom", { worksWith: null });
  });
  it("no unexpected nulls", () => assertNoUnexpectedNulls("zoom", fullData));
});

describe("zoho platformData conformance", () => {
  const fullData = {
    extensionId: "12345",
    namespace: "com.zoho.crm.plugin",
    tagline: "CRM automation.",
    about: "Automation tool.",
    pricing: "FREE",
    publishedDate: "2023-01-15",
    version: "2.1.0",
    deploymentType: "Cloud",
  };

  it("validates full output", () => expectValid("zoho", fullData));
  it("validates minimal output", () => expectValid("zoho", {}));
  it("rejects extensionId as number (PLA-646 regression)", () => {
    expectInvalid("zoho", { extensionId: 12345 });
  });
  it("rejects null", () => {
    expectInvalid("zoho", { extensionId: null });
    expectInvalid("zoho", { tagline: null });
  });
  it("no unexpected nulls", () => assertNoUnexpectedNulls("zoho", fullData));
});

describe("zendesk platformData conformance", () => {
  const fullData = {
    shortDescription: "Live chat widget.",
    longDescription: "Full-featured live chat.",
    installationInstructions: "1. Install\n2. Configure",
    pricing: "PAID",
    datePublished: "2022-09-01",
    version: "4.0.0",
    products: ["support", "chat"],
    source: "zendesk",
  };

  it("validates full output", () => expectValid("zendesk", fullData));
  it("validates minimal output", () => expectValid("zendesk", {}));
  it("rejects null", () => {
    expectInvalid("zendesk", { shortDescription: null });
    expectInvalid("zendesk", { products: null });
  });
  it("no unexpected nulls", () => assertNoUnexpectedNulls("zendesk", fullData));
});

describe("hubspot platformData conformance", () => {
  const fullData = {
    shortDescription: "Sync contacts.",
    longDescription: "Two-way sync.",
    pricing: "FREE",
    installCount: 25000,
    launchedDate: "2020-05-10",
    offeringId: 98765,
    certified: true,
    builtByHubSpot: false,
    source: "hubspot",
  };

  it("validates full output", () => expectValid("hubspot", fullData));
  it("validates minimal output", () => expectValid("hubspot", {}));
  it("rejects wrong types", () => {
    expectInvalid("hubspot", { installCount: "25000" });
    expectInvalid("hubspot", { certified: "yes" });
    expectInvalid("hubspot", { offeringId: "98765" });
  });
  it("rejects null", () => {
    expectInvalid("hubspot", { shortDescription: null });
    expectInvalid("hubspot", { certified: null });
  });
  it("no unexpected nulls", () => assertNoUnexpectedNulls("hubspot", fullData));
});

// ── Cross-platform null/undefined guard ────────────────────────────

describe("cross-platform null/undefined normalization", () => {
  const platforms: PlatformId[] = [
    "shopify", "salesforce", "canva", "wix", "wordpress",
    "google_workspace", "atlassian", "zoom", "zoho", "zendesk", "hubspot",
  ];

  for (const platform of platforms) {
    it(`${platform}: empty object passes`, () => expectValid(platform, {}));
    it(`${platform}: null input passes`, () => {
      expect(validatePlatformData(platform, null).success).toBe(true);
    });
    it(`${platform}: undefined input passes`, () => {
      expect(validatePlatformData(platform, undefined).success).toBe(true);
    });
  }
});
