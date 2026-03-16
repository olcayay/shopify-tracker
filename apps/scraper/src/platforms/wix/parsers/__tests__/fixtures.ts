/**
 * Shared test fixtures for Wix parser tests.
 * Builds minimal HTML pages with embedded __REACT_QUERY_STATE__ base64 JSON.
 */

/** Encode a React Query state object into a Wix-style HTML page */
export function buildWixHtml(state: { queries: any[] }): string {
  const json = JSON.stringify(state);
  const b64 = Buffer.from(json).toString("base64");
  return `<html><head><script>window.__REACT_QUERY_STATE__ = JSON.parse(__decodeBase64('${b64}'))</script></head><body></body></html>`;
}

/** Build an app detail page HTML with full JSON data */
export function buildAppDetailHtml(overrides: {
  slug?: string;
  name?: string;
  shortDescription?: string;
  icon?: string;
  rating?: number;
  reviewCount?: number;
  pricingType?: string;
  developerName?: string;
  developerSlug?: string;
  developerWebsite?: string;
  developerEmail?: string;
  description?: string;
  benefits?: string[];
  demoUrl?: string;
  categories?: any[];
  collections?: any[];
  screenshots?: any[];
  pricingPlans?: any[];
  languages?: string[];
  isAvailableWorldwide?: boolean;
  reviews?: any[];
  badges?: any[];
  ratingHistogram?: any;
  trialDays?: number;
  currency?: string;
  isFreeApp?: boolean;
} = {}): string {
  const slug = overrides.slug ?? "test-app";
  const state = {
    queries: [
      {
        queryKey: [`app-page-${slug}-en`],
        state: {
          data: {
            app: {
              name: overrides.name ?? "Test App",
              slug,
              shortDescription: overrides.shortDescription ?? "A test app",
              icon: overrides.icon ?? "https://cdn.wix.com/icon.png",
              reviews: {
                averageRating: overrides.rating ?? 4.5,
                totalCount: overrides.reviewCount ?? 100,
              },
              pricing: {
                label: { type: overrides.pricingType ?? "FREE_PLAN_AVAILABLE" },
              },
              appBadges: (overrides.badges ?? []).map((b: string) => ({ badge: b })),
              promotionalImage: null,
            },
            overview: {
              description: overrides.description ?? "Full description of the app.\nWith multiple lines.",
              benefits: (overrides.benefits ?? ["Easy setup", "Free plan"]).map((b) => ({ title: b })),
              demoUrl: overrides.demoUrl ?? "https://demo.example.com",
            },
            companyInfo: overrides.developerName
              ? {
                  name: overrides.developerName,
                  slug: overrides.developerSlug ?? "test-dev",
                  websiteUrl: overrides.developerWebsite ?? "https://testdev.com",
                  contactUs: overrides.developerEmail ?? "dev@test.com",
                  privacyPolicyUrl: "https://testdev.com/privacy",
                }
              : null,
            reviews: {
              reviewsSummary: {
                ratingHistogram: overrides.ratingHistogram ?? {
                  rating5: 60,
                  rating4: 20,
                  rating3: 10,
                  rating2: 5,
                  rating1: 5,
                },
              },
              reviews: overrides.reviews ?? [
                {
                  createdAt: "2026-01-15",
                  description: "Great app!",
                  title: "Love it",
                  userName: "JohnDoe",
                  rate: 5,
                  replies: [
                    {
                      createdAt: "2026-01-16",
                      description: "Thanks for the review!",
                    },
                  ],
                },
                {
                  createdAt: "2026-01-10",
                  description: "Needs improvement",
                  title: "",
                  userName: "JaneDoe",
                  rate: 3,
                  replies: [],
                },
              ],
            },
            quickInfo: {
              subCategories: overrides.categories ?? [
                {
                  slug: "forms",
                  name: "Forms",
                  parentSlug: "communication",
                  parentName: "Communication",
                },
              ],
              media: overrides.screenshots ?? [
                { type: "IMAGE", url: "https://cdn.wix.com/ss1.png" },
                { type: "IMAGE", url: "https://cdn.wix.com/ss2.png" },
                { type: "VIDEO", url: "https://cdn.wix.com/video.mp4" },
              ],
            },
            properties: {
              appCollections: overrides.collections ?? [
                { slug: "collect-leads", name: "Collect Leads" },
                { slug: "enterprise-apps", name: "Enterprise Apps" },
              ],
              supportedLanguages: overrides.languages ?? ["English", "French", "Spanish"],
              geoAvailability: {
                isAvailableWorldwide: overrides.isAvailableWorldwide ?? true,
              },
            },
            pricingPlans: {
              plans: overrides.pricingPlans ?? [
                {
                  name: "Free",
                  isFree: true,
                  monthlyPrice: null,
                  yearlyPrice: null,
                  oneTimePrice: null,
                  type: "FREE",
                  description: { benefits: ["Up to 5 forms", "100 submissions/month"] },
                },
                {
                  name: "Starter",
                  isFree: false,
                  monthlyPrice: { price: 24.99 },
                  yearlyPrice: { price: 19.99 },
                  oneTimePrice: null,
                  type: "RECURRING",
                  description: { benefits: ["Unlimited forms", "5,000 submissions/month", "File uploads"] },
                },
              ],
              currencySettings: { code: overrides.currency ?? "USD" },
              trialDays: overrides.trialDays ?? 14,
              isFreeApp: overrides.isFreeApp ?? false,
            },
          },
        },
      },
    ],
  };

  return buildWixHtml(state);
}

/** Build an L1 category page HTML with grouped sections */
export function buildL1CategoryHtml(overrides: {
  slug?: string;
  name?: string;
  description?: string;
  sections?: Array<{
    tagSlug: string;
    title: string;
    apps: Array<{
      slug: string;
      name: string;
      shortDescription?: string;
      icon?: string;
      rating?: number;
      reviewCount?: number;
      pricingType?: string;
      badges?: string[];
    }>;
  }>;
  sidebarCategories?: any[];
} = {}): string {
  const slug = overrides.slug ?? "marketing";
  const sections = overrides.sections ?? [
    {
      tagSlug: "seo",
      title: "SEO",
      apps: [
        { slug: "seo-app-1", name: "SEO App 1", rating: 4.2, reviewCount: 50 },
        { slug: "seo-app-2", name: "SEO App 2", rating: 3.8, reviewCount: 20 },
      ],
    },
    {
      tagSlug: "analytics",
      title: "Analytics",
      apps: [
        { slug: "analytics-app", name: "Analytics App", rating: 4.7, reviewCount: 200 },
      ],
    },
  ];

  const appGroupSections = sections.map((sec) => ({
    tagSlug: sec.tagSlug,
    title: sec.title,
    apps: sec.apps.map((app) => ({
      slug: app.slug,
      name: app.name,
      shortDescription: app.shortDescription ?? `${app.name} description`,
      icon: app.icon ?? `https://cdn.wix.com/${app.slug}/icon.png`,
      reviews: {
        averageRating: app.rating ?? 0,
        totalCount: app.reviewCount ?? 0,
      },
      pricing: {
        label: { type: app.pricingType ?? "FREE" },
      },
      appBadges: (app.badges ?? []).map((b) => ({ badge: b })),
    })),
  }));

  const queries: any[] = [
    {
      queryKey: [`category-page-${slug}-en`],
      state: {
        data: {
          category: {
            name: overrides.name ?? "Marketing",
            description: overrides.description ?? "Marketing apps",
          },
          appGroupSections,
        },
      },
    },
  ];

  // Add sidebar data if provided
  if (overrides.sidebarCategories) {
    queries.push({
      queryKey: ["app-market-sidebar"],
      state: {
        data: [overrides.sidebarCategories],
      },
    });
  }

  return buildWixHtml({ queries });
}

/** Build an L2 subcategory page HTML with a flat app list */
export function buildL2CategoryHtml(overrides: {
  parentSlug?: string;
  childSlug?: string;
  title?: string;
  apps?: Array<{
    slug: string;
    name: string;
    shortDescription?: string;
    rating?: number;
    reviewCount?: number;
    pricingType?: string;
  }>;
  total?: number;
  hasNext?: boolean;
  sidebarCategories?: any[];
} = {}): string {
  const childSlug = overrides.childSlug ?? "seo";
  const parentSlug = overrides.parentSlug ?? "marketing";
  const apps = overrides.apps ?? [
    { slug: "seo-tool-1", name: "SEO Tool 1", rating: 4.5, reviewCount: 100 },
    { slug: "seo-tool-2", name: "SEO Tool 2", rating: 4.0, reviewCount: 50 },
  ];

  const queries: any[] = [
    {
      queryKey: [`initial-apps-fetch-en-0-${childSlug}-false`],
      state: {
        data: {
          appGroup: {
            title: overrides.title ?? "SEO",
            apps: apps.map((app) => ({
              slug: app.slug,
              name: app.name,
              shortDescription: app.shortDescription ?? `${app.name} desc`,
              icon: `https://cdn.wix.com/${app.slug}/icon.png`,
              reviews: {
                averageRating: app.rating ?? 0,
                totalCount: app.reviewCount ?? 0,
              },
              pricing: {
                label: { type: app.pricingType ?? "FREE" },
              },
              appBadges: [],
            })),
          },
          paging: {
            total: overrides.total ?? apps.length,
            hasNext: overrides.hasNext ?? false,
          },
        },
      },
    },
    {
      queryKey: [`sub-category-header-en-${childSlug}-${parentSlug}`],
      state: {
        data: {
          primaryTitle: overrides.title ?? "SEO",
        },
      },
    },
  ];

  // Add sidebar data if provided
  if (overrides.sidebarCategories) {
    queries.push({
      queryKey: ["app-market-sidebar"],
      state: {
        data: [overrides.sidebarCategories],
      },
    });
  }

  return buildWixHtml({ queries });
}

/** Build a search results page HTML */
export function buildSearchHtml(overrides: {
  apps?: Array<{
    slug: string;
    name: string;
    shortDescription?: string;
    icon?: string;
    rating?: number;
    reviewCount?: number;
    pricingType?: string;
    badges?: string[];
  }>;
  total?: number;
  hasNext?: boolean;
} = {}): string {
  const apps = overrides.apps ?? [
    { slug: "form-app-1", name: "Form Builder", rating: 4.5, reviewCount: 1000, pricingType: "FREE_PLAN_AVAILABLE" },
    { slug: "form-app-2", name: "JotForm", rating: 4.3, reviewCount: 500, pricingType: "FREE" },
  ];

  const state = {
    queries: [
      {
        queryKey: ["initial-apps-fetch-en-0-search-false"],
        state: {
          data: {
            appGroup: {
              apps: apps.map((app) => ({
                slug: app.slug,
                name: app.name,
                shortDescription: app.shortDescription ?? `${app.name} description`,
                icon: app.icon ?? `https://cdn.wix.com/${app.slug}/icon.png`,
                reviews: {
                  averageRating: app.rating ?? 0,
                  totalCount: app.reviewCount ?? 0,
                },
                pricing: {
                  label: { type: app.pricingType ?? "FREE" },
                },
                appBadges: (app.badges ?? []).map((b: string) => ({ badge: b })),
              })),
            },
            paging: {
              total: overrides.total ?? apps.length,
              hasNext: overrides.hasNext ?? false,
            },
          },
        },
      },
    ],
  };

  return buildWixHtml(state);
}

/** Build a sidebar category entry */
export function buildSidebarCategoryLink(slug: string, label: string, subCategories: { slug: string; label: string }[] = [], parentSlug?: string) {
  return {
    type: "CATEGORY_LINK",
    categoryLink: {
      slug,
      label,
      parentCategorySlug: parentSlug ?? null,
      subCategoryLinks: subCategories.map((sub) => ({
        slug: sub.slug,
        label: sub.label,
        parentCategorySlug: slug,
      })),
    },
  };
}
