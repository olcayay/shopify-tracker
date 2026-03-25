/**
 * HTML fixture helpers for HubSpot parser tests.
 *
 * HubSpot is a pure SPA — parsers work on fully-rendered React DOM.
 * These helpers produce realistic HTML matching the selector patterns used by parsers.
 */

// ---------------------------------------------------------------------------
// App detail page fixtures
// ---------------------------------------------------------------------------

interface JsonLdOverrides {
  name?: string;
  description?: string;
  image?: string;
  softwareVersion?: string;
  author?: { name: string; url?: string } | string;
  aggregateRating?: { ratingValue: number; ratingCount: number } | null;
  "@type"?: string;
}

export function makeJsonLdAppHtml(overrides: JsonLdOverrides = {}): string {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": overrides["@type"] ?? "SoftwareApplication",
    name: overrides.name ?? "Mailchimp",
    description: overrides.description ?? "Email marketing and automation platform",
    image: overrides.image ?? "https://cdn.hubspot.com/mailchimp-icon.png",
    softwareVersion: overrides.softwareVersion ?? "2.4.1",
    author: overrides.author ?? { name: "Mailchimp Inc.", url: "https://mailchimp.com" },
  };

  if (overrides.aggregateRating !== null) {
    jsonLd.aggregateRating = overrides.aggregateRating ?? {
      "@type": "AggregateRating",
      ratingValue: 4.3,
      ratingCount: 187,
    };
  }

  return `
    <html><head>
      <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    </head><body>
      <h1>${jsonLd.name}</h1>
      <div class="app-icon"><img src="${jsonLd.image}" alt="logo" /></div>
      <div class="subtitle">${jsonLd.description}</div>
      <div class="description">Full description of the integration with HubSpot CRM.</div>
      <div class="pricing">Free plan available</div>
      <div class="developer"><a href="https://mailchimp.com">Mailchimp Inc.</a></div>
      <a href="/marketplace/apps/marketing">Marketing</a>
      <a href="/marketplace/apps/marketing/email">Email Marketing</a>
    </body></html>
  `;
}

interface DomAppOverrides {
  name?: string;
  shortDescription?: string;
  longDescription?: string;
  ratingValue?: string;
  ratingCount?: string;
  iconUrl?: string;
  developerName?: string;
  developerUrl?: string;
  pricing?: string;
  categories?: Array<{ slug: string; name: string }>;
}

export function makeDomAppHtml(overrides: DomAppOverrides = {}): string {
  const cats = overrides.categories ?? [{ slug: "sales", name: "Sales" }];
  const catLinks = cats.map((c) => `<a href="/marketplace/apps/${c.slug}">${c.name}</a>`).join("\n");

  return `
    <html><body>
      <h1>${overrides.name ?? "HubSpot Sales Extension"}</h1>
      <div class="app-icon"><img src="${overrides.iconUrl ?? "https://cdn.hubspot.com/sales-ext.png"}" alt="logo" /></div>
      <div class="tagline">${overrides.shortDescription ?? "Boost your sales productivity"}</div>
      <div class="long-description">${overrides.longDescription ?? "A detailed description of the sales extension tool."}</div>
      <div class="rating">
        <span class="average">${overrides.ratingValue ?? ""}</span>
      </div>
      <div class="review-count">${overrides.ratingCount ?? ""}</div>
      <div class="pricing">${overrides.pricing ?? "Starting at $50/mo"}</div>
      <div class="developer"><a href="${overrides.developerUrl ?? "https://hubspot.com"}">${overrides.developerName ?? "HubSpot"}</a></div>
      ${catLinks}
    </body></html>
  `;
}

// ---------------------------------------------------------------------------
// Category page fixtures
// ---------------------------------------------------------------------------

interface CategoryApp {
  slug: string;
  name: string;
  description?: string;
  rating?: string;
  ratingCount?: string;
  iconUrl?: string;
}

interface CategoryPageOverrides {
  categorySlug?: string;
  categoryTitle?: string;
  apps?: CategoryApp[];
  totalCount?: number;
  hasNextPage?: boolean;
  /** Use card-based layout (vs fallback link-based) */
  useCardLayout?: boolean;
}

export function makeCategoryPageHtml(overrides: CategoryPageOverrides = {}): string {
  const title = overrides.categoryTitle ?? "Sales";
  const apps = overrides.apps ?? [
    { slug: "mailchimp", name: "Mailchimp", description: "Email marketing", rating: "4.3", ratingCount: "187", iconUrl: "https://cdn.hubspot.com/mc.png" },
    { slug: "salesforce-hubspot", name: "Salesforce Integration", description: "Sync CRM data", rating: "4.1", ratingCount: "92", iconUrl: "https://cdn.hubspot.com/sf.png" },
    { slug: "zapier", name: "Zapier", description: "Automate workflows", rating: "4.5", ratingCount: "310", iconUrl: "https://cdn.hubspot.com/zap.png" },
  ];
  const totalCount = overrides.totalCount ?? apps.length;
  const useCards = overrides.useCardLayout !== false;

  let appHtml: string;
  if (useCards) {
    appHtml = apps.map((app) => `
      <div class="app-card">
        <a href="/marketplace/listing/${app.slug}">
          <img src="${app.iconUrl ?? ""}" alt="${app.name}" />
          <h3>${app.name}</h3>
        </a>
        <p>${app.description ?? ""}</p>
        <span class="rating">${app.rating ?? ""}</span>
        <span class="review-count">${app.ratingCount ?? ""}</span>
      </div>
    `).join("\n");
  } else {
    // Fallback: simple links (no card wrapper)
    appHtml = apps.map((app) => `
      <li>
        <a href="/marketplace/listing/${app.slug}">
          <img src="${app.iconUrl ?? ""}" />
          <h3>${app.name}</h3>
        </a>
        <p>${app.description ?? ""}</p>
      </li>
    `).join("\n");
  }

  const nextPageLink = overrides.hasNextPage ? `<a href="?page=2" class="next">Next</a>` : "";

  return `
    <html><body>
      <h1>${title}</h1>
      <div class="total-results">${totalCount} apps</div>
      ${useCards ? appHtml : `<ul>${appHtml}</ul>`}
      ${nextPageLink}
    </body></html>
  `;
}

// ---------------------------------------------------------------------------
// Search results fixtures
// ---------------------------------------------------------------------------

interface SearchApp {
  slug: string;
  name: string;
  description?: string;
  rating?: string;
  ratingCount?: string;
  iconUrl?: string;
}

interface SearchPageOverrides {
  apps?: SearchApp[];
  totalResults?: number;
  hasNextPage?: boolean;
  useCardLayout?: boolean;
}

export function makeSearchPageHtml(overrides: SearchPageOverrides = {}): string {
  const apps = overrides.apps ?? [
    { slug: "mailchimp", name: "Mailchimp", description: "Email marketing and automation", rating: "4.3", ratingCount: "187", iconUrl: "https://cdn.hubspot.com/mc.png" },
    { slug: "constant-contact", name: "Constant Contact", description: "Email campaigns", rating: "3.9", ratingCount: "45", iconUrl: "https://cdn.hubspot.com/cc.png" },
  ];
  const totalResults = overrides.totalResults ?? apps.length;
  const useCards = overrides.useCardLayout !== false;

  let appHtml: string;
  if (useCards) {
    appHtml = apps.map((app) => `
      <div class="ResultCard">
        <a href="/marketplace/listing/${app.slug}">
          <img src="${app.iconUrl ?? ""}" alt="${app.name}" />
          <h4 class="Name">${app.name}</h4>
        </a>
        <div class="Description">${app.description ?? ""}</div>
        <span class="Rating">${app.rating ?? ""}</span>
        <span class="ReviewCount">${app.ratingCount ?? ""}</span>
      </div>
    `).join("\n");
  } else {
    appHtml = apps.map((app) => `
      <article>
        <a href="/marketplace/listing/${app.slug}">${app.name}</a>
        <p>${app.description ?? ""}</p>
      </article>
    `).join("\n");
  }

  const nextPageLink = overrides.hasNextPage ? `<a href="?page=2">Next</a>` : "";

  return `
    <html><body>
      <div class="results-count">${totalResults} results</div>
      ${appHtml}
      ${nextPageLink}
    </body></html>
  `;
}

// ---------------------------------------------------------------------------
// Review fixtures
// ---------------------------------------------------------------------------

interface ReviewOverrides {
  reviews?: Array<{
    author?: string;
    rating?: string;
    content?: string;
    date?: string;
    replyText?: string;
    replyDate?: string;
  }>;
}

export function makeReviewHtml(overrides: ReviewOverrides = {}): string {
  const reviews = overrides.reviews ?? [
    { author: "John Smith", rating: "5", content: "Excellent integration, works seamlessly!", date: "2025-01-15" },
    { author: "Jane Doe", rating: "4", content: "Good app, could use better docs.", date: "2025-02-01", replyText: "Thanks for the feedback!", replyDate: "2025-02-03" },
    { author: "Bob Wilson", rating: "3", content: "Does the job but UX needs work.", date: "2025-03-10" },
  ];

  const reviewHtml = reviews.map((r) => {
    const replyHtml = r.replyText
      ? `<div class="reply"><div class="response-text">${r.replyText}</div><time class="date">${r.replyDate ?? ""}</time></div>`
      : "";
    return `
      <div class="review-item" data-review="true">
        <div class="reviewer">${r.author ?? "Anonymous"}</div>
        <span class="rating" data-rating="${r.rating ?? "0"}">${r.rating ?? "0"} stars</span>
        <div class="content">${r.content ?? ""}</div>
        <time class="date">${r.date ?? ""}</time>
        ${replyHtml}
      </div>
    `;
  }).join("\n");

  return `
    <html><body>
      <div class="reviews-section">
        ${reviewHtml}
      </div>
    </body></html>
  `;
}

// ---------------------------------------------------------------------------
// Featured sections fixtures
// ---------------------------------------------------------------------------

interface FeaturedSectionFixture {
  title: string;
  apps: Array<{ slug: string; name: string; iconUrl?: string }>;
}

interface FeaturedPageOverrides {
  sections?: FeaturedSectionFixture[];
}

export function makeFeaturedPageHtml(overrides: FeaturedPageOverrides = {}): string {
  const sections = overrides.sections ?? [
    {
      title: "Top Rated Apps",
      apps: [
        { slug: "mailchimp", name: "Mailchimp", iconUrl: "https://cdn.hubspot.com/mc.png" },
        { slug: "zapier", name: "Zapier", iconUrl: "https://cdn.hubspot.com/zap.png" },
      ],
    },
    {
      title: "New & Noteworthy",
      apps: [
        { slug: "drift", name: "Drift", iconUrl: "https://cdn.hubspot.com/drift.png" },
        { slug: "vidyard", name: "Vidyard", iconUrl: "https://cdn.hubspot.com/vy.png" },
        { slug: "databox", name: "Databox", iconUrl: "https://cdn.hubspot.com/db.png" },
      ],
    },
  ];

  const sectionHtml = sections.map((section) => {
    const appCards = section.apps.map((app) => `
      <div class="card">
        <a href="/marketplace/listing/${app.slug}">
          <img src="${app.iconUrl ?? ""}" alt="${app.name}" />
          <h4 class="title">${app.name}</h4>
        </a>
      </div>
    `).join("\n");

    return `
      <h2>${section.title}</h2>
      <div class="grid">
        ${appCards}
      </div>
    `;
  }).join("\n");

  return `
    <html><body>
      ${sectionHtml}
    </body></html>
  `;
}
