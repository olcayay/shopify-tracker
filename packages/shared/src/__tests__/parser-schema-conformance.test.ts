/**
 * Parser → Schema conformance tests.
 * Verifies that the CommonAppDetails type contract is correct
 * by validating sample data against a Zod schema.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Zod schema matching CommonAppDetails interface
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

// Zod schema for AppDetails (full detail page result)
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

describe("Parser schema conformance", () => {
  it("CommonAppDetails schema validates a correct object", () => {
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

  it("CommonAppDetails rejects missing required fields", () => {
    const invalid = { name: "Test", slug: "test" }; // missing all nullable fields
    expect(() => CommonAppDetailsSchema.parse(invalid)).toThrow();
  });

  it("CommonAppDetails allows null values for nullable fields", () => {
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

  it("AppDetails schema validates a full detail object", () => {
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

  it("AppDetails rejects empty slug", () => {
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
