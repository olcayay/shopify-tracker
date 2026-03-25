/**
 * JSON fixture helpers for HubSpot parser tests.
 *
 * HubSpot uses CHIRP RPC API — parsers work on JSON responses, not HTML.
 * These helpers produce realistic JSON matching the CHIRP API response formats.
 */

// ---------------------------------------------------------------------------
// App detail fixtures (MarketplaceListingDetailsRpc/getListingDetailsV3)
// ---------------------------------------------------------------------------

interface ChirpAppOverrides {
  name?: string;
  tagline?: string;
  overview?: string;
  companyName?: string;
  companyUrl?: string;
  iconUrl?: string;
  urlSlug?: string;
  installCount?: number;
  offeringId?: number;
  category?: string[];
  productType?: string;
  connectionType?: string;
  certifiedAt?: number | null;
  builtByHubSpot?: boolean;
  firstPublishedAt?: number | null;
  pricingPlans?: Array<{
    pricingName?: string;
    pricingModel?: string[];
    pricingMonthlyCenticents?: number;
    pricingFeatures?: string[];
  }>;
}

/** Wrap a value in CHIRP field value format. */
function chirpStr(val: string) {
  return { value: val, __typename: "com.hubspot.chirp.ext.models.StringFieldValue" };
}
function chirpInt(val: number) {
  return { value: val, __typename: "com.hubspot.chirp.ext.models.IntFieldValue" };
}
function chirpBool(val: boolean) {
  return { value: val, __typename: "com.hubspot.chirp.ext.models.BoolFieldValue" };
}
function chirpList(vals: any[]) {
  return { value: vals, __typename: "com.hubspot.chirp.ext.models.ListFieldValue" };
}
function chirpMap(val: Record<string, any>) {
  return { value: val, __typename: "com.hubspot.chirp.ext.models.MapFieldValue" };
}

export function makeChirpAppDetailResponse(overrides: ChirpAppOverrides = {}): string {
  const cats = (overrides.category ?? ["EMAIL"]).map(chirpStr);
  const pricingPlans = (overrides.pricingPlans ?? [
    { pricingName: "Free", pricingModel: ["FREE"], pricingFeatures: ["Basic features"] },
    { pricingName: "Pro", pricingModel: ["MONTHLY"], pricingMonthlyCenticents: 200000, pricingFeatures: ["All features", "Priority support"] },
  ]).map((p) =>
    chirpMap({
      pricingName: chirpStr(p.pricingName ?? ""),
      pricingModel: chirpList((p.pricingModel ?? []).map(chirpStr)),
      pricingMonthlyCenticents: p.pricingMonthlyCenticents ? chirpInt(p.pricingMonthlyCenticents) : chirpInt(0),
      pricingFeatures: chirpList((p.pricingFeatures ?? []).map(chirpStr)),
    }),
  );

  const listing: Record<string, any> = {
    name: chirpStr(overrides.name ?? "Mailchimp Campaign Sync"),
    tagline: chirpStr(overrides.tagline ?? "Sync email activity and contacts between HubSpot and Mailchimp."),
    overview: chirpStr(overrides.overview ?? "<p>Full description of the integration.</p>"),
    companyName: chirpStr(overrides.companyName ?? "HubSpot"),
    companyUrl: chirpStr(overrides.companyUrl ?? "https://hubspot.com"),
    urlSlug: chirpStr(overrides.urlSlug ?? "mailchimp-campaign-sync"),
    installCount: chirpInt(overrides.installCount ?? 37764),
    category: chirpList(cats),
    productType: chirpStr(overrides.productType ?? "APP"),
    connectionType: chirpStr(overrides.connectionType ?? "HOMEMADE_IFRAME"),
    builtByHubSpot: chirpBool(overrides.builtByHubSpot ?? true),
    pricingPlans: chirpList(pricingPlans),
    listingIcon: chirpMap({
      value: chirpStr(overrides.iconUrl ?? "https://cdn2.hubspot.net/hubfs/521324/App-Icon-mailchimp.png"),
      altText: chirpStr(""),
    }),
    listingId: chirpInt(30050903),
    offeringId: chirpInt(overrides.offeringId ?? 77),
  };

  if (overrides.certifiedAt !== null) {
    listing.certifiedAt = chirpInt(overrides.certifiedAt ?? 1713539903755);
  }
  if (overrides.firstPublishedAt !== null) {
    listing.firstPublishedAt = chirpInt(overrides.firstPublishedAt ?? 1473676354857);
  }

  return JSON.stringify({
    type: "data",
    data: {
      listing: chirpMap(listing),
    },
  });
}

// ---------------------------------------------------------------------------
// Search / Category page fixtures (PersonalizationPublicRpc/search)
// ---------------------------------------------------------------------------

interface SearchCard {
  slug: string;
  listingName: string;
  description?: string;
  companyName?: string;
  iconUrl?: string;
  installCount?: number;
  displayTag?: string;
  certified?: boolean;
  builtByHubSpot?: boolean;
}

interface SearchResponseOverrides {
  total?: number;
  cards?: SearchCard[];
}

export function makeChirpSearchResponse(overrides: SearchResponseOverrides = {}): string {
  const cards = overrides.cards ?? [
    { slug: "gmail", listingName: "Gmail", description: "Bring HubSpot to your inbox", companyName: "HubSpot", iconUrl: "https://cdn.hubspot.com/gmail.png", installCount: 525735, displayTag: "APP", certified: true, builtByHubSpot: true },
    { slug: "google-calendar", listingName: "Google Calendar", description: "Book meetings quickly", companyName: "HubSpot", iconUrl: "https://cdn.hubspot.com/gcal.png", installCount: 256399, displayTag: "APP", certified: true, builtByHubSpot: true },
    { slug: "zapier", listingName: "Zapier", description: "Automate and connect HubSpot to 8,000+ apps", companyName: "HubSpot", iconUrl: "https://cdn.hubspot.com/zapier.png", installCount: 176847, displayTag: "APP", certified: true, builtByHubSpot: true },
  ];
  const total = overrides.total ?? cards.length;

  return JSON.stringify({
    type: "data",
    data: {
      total,
      cards: cards.map((c) => ({
        listingId: Math.floor(Math.random() * 10000000),
        listingName: c.listingName,
        providerName: c.companyName ?? "Unknown",
        companyName: c.companyName ?? "Unknown",
        description: c.description ?? "",
        iconUrl: c.iconUrl ?? "",
        slug: c.slug,
        installCount: c.installCount ?? 0,
        displayTag: c.displayTag ?? "APP",
        displayTagLabel: c.displayTag ?? "App",
        products: [
          {
            productId: Math.floor(Math.random() * 1000000),
            sourceId: String(Math.floor(Math.random() * 100000)),
            productType: "APP",
            connectionType: "HOMEMADE_EXTERNAL",
            certified: c.certified ?? false,
            builtByHubSpot: c.builtByHubSpot ?? false,
            workflowActions: [],
            productFeatures: [],
            worksWithBreeze: false,
          },
        ],
        recommendationSources: [],
        highlights: [],
      })),
    },
  });
}

// ---------------------------------------------------------------------------
// Featured collections fixtures (CollectionsPublicRpc/getCollections +
// PersonalizationPublicRpc/getSuggestionSections)
// ---------------------------------------------------------------------------

interface CollectionFixture {
  id?: number;
  title?: string;
  name?: string;
  slug?: string;
  previewItems?: Array<{ slug: string; name: string; iconUrl?: string }>;
}

interface SuggestionSectionFixture {
  title?: string;
  cards?: Array<{ slug: string; listingName: string; iconUrl?: string }>;
}

interface FeaturedOverrides {
  collections?: CollectionFixture[];
  suggestions?: SuggestionSectionFixture[];
}

export function makeChirpFeaturedResponse(overrides: FeaturedOverrides = {}): string {
  const collections = overrides.collections ?? [
    {
      id: 501009,
      title: "Workflow Integrations",
      name: "Workflow Integrations",
      slug: "workflow",
      previewItems: [
        { slug: "slack", name: "Slack", iconUrl: "https://cdn.hubspot.com/slack.png" },
        { slug: "asana", name: "Asana", iconUrl: "https://cdn.hubspot.com/asana.png" },
      ],
    },
    {
      id: 502002,
      title: "Data Sync Apps by HubSpot",
      name: "Data Sync Apps by HubSpot",
      slug: "apps-for-operations-teams",
      previewItems: [
        { slug: "google-contacts-sync-232794", name: "Google Contacts", iconUrl: "https://cdn.hubspot.com/gc.png" },
      ],
    },
  ];

  const suggestions = overrides.suggestions ?? [
    {
      title: "Most popular",
      cards: [
        { slug: "gmail", listingName: "Gmail", iconUrl: "https://cdn.hubspot.com/gmail.png" },
        { slug: "google-calendar", listingName: "Google Calendar", iconUrl: "https://cdn.hubspot.com/gcal.png" },
      ],
    },
    {
      title: "New arrivals",
      cards: [
        { slug: "containertracker", listingName: "Container Tracker", iconUrl: "https://cdn.hubspot.com/ct.png" },
      ],
    },
  ];

  return JSON.stringify({
    collections: collections.map((c) => ({
      id: c.id ?? Math.floor(Math.random() * 1000000),
      title: c.title ?? "Collection",
      name: c.name ?? c.title ?? "Collection",
      ...(c.slug != null ? { slug: c.slug } : {}),
      itemCount: c.previewItems?.length ?? 0,
      displayed: true,
      previewItems: (c.previewItems ?? []).map((item) => ({
        listingId: Math.floor(Math.random() * 10000000),
        slug: item.slug,
        iconUrl: item.iconUrl ?? "",
        name: item.name,
      })),
      updatedAt: Date.now(),
    })),
    suggestions: suggestions.map((s) => ({
      title: s.title ?? "Section",
      cards: (s.cards ?? []).map((card) => ({
        listingId: Math.floor(Math.random() * 10000000),
        listingName: card.listingName,
        slug: card.slug,
        iconUrl: card.iconUrl ?? "",
        description: "",
        installCount: 0,
      })),
    })),
  });
}

// ---------------------------------------------------------------------------
// Review fixtures (Ecosystem public API: /reviews/search)
// ---------------------------------------------------------------------------

interface ReviewFixture {
  id?: number;
  createdAt?: number;
  reviewerDisplayName?: string;
  companyName?: string;
  overallRating?: number;
  title?: string;
  review?: string;
  pros?: string;
  cons?: string;
  reply?: { repliedAt: number; reply: string } | null;
}

interface ReviewResponseOverrides {
  total?: number;
  reviews?: ReviewFixture[];
}

export function makeEcosystemReviewResponse(overrides: ReviewResponseOverrides = {}): string {
  const reviews = overrides.reviews ?? [
    {
      id: 713725,
      createdAt: 1706705331353,
      reviewerDisplayName: "Mueller, S.",
      companyName: "Acme Corp",
      overallRating: 5,
      title: "Great integration",
      review: "Works perfectly with our workflow",
      pros: "Easy to set up",
      cons: "None so far",
      reply: { repliedAt: 1707000000000, reply: "Thank you for your feedback!" },
    },
    {
      id: 705133,
      createdAt: 1704067200000,
      reviewerDisplayName: "Smith, J.",
      companyName: "Tech Inc",
      overallRating: 4,
      title: "Solid app",
      review: "Does what it says on the tin",
      pros: "Reliable",
      cons: "Could use more features",
      reply: null,
    },
    {
      id: 698001,
      createdAt: 1701388800000,
      reviewerDisplayName: "Garcia, M.",
      companyName: "StartupXYZ",
      overallRating: 3,
      title: "",
      review: "Average experience",
    },
  ];
  const total = overrides.total ?? reviews.length;

  return JSON.stringify({
    reviews: reviews.map((r) => ({
      id: r.id ?? Math.floor(Math.random() * 1000000),
      createdAt: r.createdAt ?? Date.now(),
      reviewerData: {
        userId: Math.floor(Math.random() * 100000),
        portalId: Math.floor(Math.random() * 100000),
        companyName: r.companyName ?? "Unknown",
        employees: null,
        industry: null,
        showAvatar: true,
      },
      ratings: { OVERALL: r.overallRating ?? 5 },
      answers: {
        ...(r.title != null ? { TITLE: r.title } : {}),
        ...(r.review != null ? { REVIEW: r.review } : {}),
        ...(r.pros != null ? { PROS: r.pros } : {}),
        ...(r.cons != null ? { CONS: r.cons } : {}),
      },
      tags: {},
      attributes: [],
      reply: r.reply ?? null,
      replies: [],
      reviewerDisplayName: r.reviewerDisplayName ?? "Anonymous",
      avatarUrl: null,
      entityVersion: null,
      original: null,
      untranslated: { answers: {}, reply: null, replies: [], translated: false },
      lastEditedAt: null,
      translated: false,
      originalLanguage: "en",
      employees: null,
      companyName: r.companyName ?? "Unknown",
      showAvatar: true,
      content: null,
      offeringVersion: null,
    })),
    total,
  });
}
