import { describe, it, expect } from "vitest";
import { parseGoogleWorkspaceAppPage } from "../app-parser.js";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Build a 35-field raw app entry for AF_initDataCallback ds:1. */
function buildRawAppEntry(overrides: Partial<{
  appId: number;
  name: string;
  shortDescription: string;
  detailedDescription: string;
  iconUrl: string;
  bannerUrl: string;
  slug: string;
  developerName: string;
  developerWebsite: string;
  developerAddress: string;
  reviewCount: number;
  rating: number;
  installCountDisplay: string;
  installCountExact: number | null;
  termsOfServiceUrl: string;
  privacyPolicyUrl: string;
  supportUrl: string;
  homepageUrl: string;
  pricingRaw: number[][];
  worksWithCodes: number[];
  lastUpdatedTimestamp: number | null;
}> = {}): unknown[] {
  const o = {
    appId: 123456789,
    name: "Lucidchart Diagrams",
    shortDescription: "Create diagrams and flowcharts",
    detailedDescription: "Lucidchart is the intelligent diagramming application...",
    iconUrl: "https://lh3.googleusercontent.com/icon-lucid.png",
    bannerUrl: "https://lh3.googleusercontent.com/banner-lucid.png",
    slug: "lucidchart-diagrams",
    developerName: "Lucid Software",
    developerWebsite: "https://www.lucidchart.com",
    developerAddress: "South Jordan, UT",
    reviewCount: 8500,
    rating: 4.3,
    installCountDisplay: "50,000,000+",
    installCountExact: 50000000,
    termsOfServiceUrl: "https://www.lucidchart.com/pages/tos",
    privacyPolicyUrl: "https://www.lucidchart.com/pages/privacy",
    supportUrl: "https://www.lucidchart.com/support",
    homepageUrl: "https://www.lucidchart.com",
    pricingRaw: [[4, "Free"], [8, "Paid"]],
    worksWithCodes: [2, 5, 6, 9],
    lastUpdatedTimestamp: 1700000000,
    ...overrides,
  };

  const entry: unknown[] = new Array(22).fill(null);
  entry[0] = o.appId;
  entry[3] = [o.name, o.shortDescription, o.detailedDescription, o.iconUrl, o.bannerUrl, o.slug];
  entry[4] = [o.developerName, o.developerWebsite, null, o.developerAddress];
  entry[5] = [o.reviewCount, o.rating, o.installCountDisplay, o.installCountExact];
  entry[8] = [null, o.termsOfServiceUrl, o.privacyPolicyUrl, o.supportUrl, o.homepageUrl];
  entry[12] = o.worksWithCodes;
  entry[15] = o.pricingRaw;
  entry[21] = [o.lastUpdatedTimestamp];
  return entry;
}

/** Build HTML with AF_initDataCallback ds:1 containing a single app entry. */
function buildAppHtml(entry: unknown[], extras?: {
  pricing?: string;
  screenshots?: string[];
  categoryHref?: string;
  casaCertified?: boolean;
  listingUpdated?: string;
}): string {
  const ds1Json = JSON.stringify(entry);
  const e = extras || {};

  // Build DOM extras
  const pricingDom = e.pricing
    ? `<span class="Fejld">Pricing</span><span class="P0vMD">${e.pricing}</span>`
    : "";

  const screenshotsDom = (e.screenshots || [])
    .map((src) => `<img class="ec1OGc" src="${src}">`)
    .join("");

  const categoryDom = e.categoryHref
    ? `<a class="G3sBi Qh16y" href="${e.categoryHref}">Category</a>`
    : "";

  const casaDom = e.casaCertified ? `<span>Cloud Application Security Assessment</span>` : "";

  const listingDom = e.listingUpdated
    ? `<div class="bVxKXd">Listing updated: ${e.listingUpdated}</div>`
    : "";

  return `<html><head>
    <script>AF_initDataCallback({key: 'ds:1', hash: '1', data:${ds1Json}, sideChannel: {}});</script>
  </head><body>
    ${pricingDom}
    ${screenshotsDom}
    ${categoryDom}
    ${casaDom}
    ${listingDom}
  </body></html>`;
}

/** Build a DOM-only HTML page (no AF_initDataCallback). */
function buildDomOnlyHtml(overrides: Partial<{
  name: string;
  iconUrl: string;
  rating: string;
  ratingCount: string;
  shortDescription: string;
  detailedDescription: string;
  pricing: string;
  developerName: string;
  developerWebsite: string;
  categoryHref: string;
  screenshots: string[];
  appId: string;
  installCount: string;
  casaCertified: boolean;
}> = {}): string {
  const o = {
    name: "DOM Test App",
    iconUrl: "https://lh3.googleusercontent.com/dom-icon.png",
    rating: "4.1",
    ratingCount: "200",
    shortDescription: "A DOM-parsed description",
    detailedDescription: "Detailed DOM description text",
    pricing: "Free",
    developerName: "DOM Dev",
    developerWebsite: "https://domdev.com",
    categoryHref: "/marketplace/category/business-tools",
    screenshots: ["https://lh3.googleusercontent.com/ss1.png"],
    appId: "987654",
    installCount: "",
    casaCertified: false,
    ...overrides,
  };

  const screenshotsDom = o.screenshots
    .map((src) => `<img class="ec1OGc" src="${src}">`)
    .join("");

  const casaDom = o.casaCertified ? "Cloud Application Security Assessment" : "";

  return `<html><body>
    <div class="oPwrAb" data-app-id="${o.appId}">
      <span class="BfHp9b" itemprop="name">${o.name}</span>
      <img class="TS9dEf" src="${o.iconUrl}">
      <meta itemprop="ratingValue" content="${o.rating}">
      <span itemprop="ratingCount">${o.ratingCount}</span>
      <div class="kmwdk">${o.shortDescription}</div>
      <pre class="nGA4ed">${o.detailedDescription}</pre>
      <span class="Fejld">Pricing</span><span class="P0vMD">${o.pricing}</span>
      <span class="Fejld">Developer</span><span class="nWIEC"><a class="DmgOFc" href="${o.developerWebsite}">${o.developerName}</a></span>
      <a class="G3sBi Qh16y" href="${o.categoryHref}">Business Tools</a>
      ${screenshotsDom}
      ${o.installCount ? `${o.installCount} users` : ""}
      ${casaDom}
    </div>
  </body></html>`;
}

// ── parseGoogleWorkspaceAppPage (embedded JSON path) ─────────────────────

describe("parseGoogleWorkspaceAppPage", () => {
  describe("embedded JSON parsing (primary path)", () => {
    it("parses app name, slug, and icon from embedded JSON", () => {
      const entry = buildRawAppEntry();
      const html = buildAppHtml(entry);
      const result = parseGoogleWorkspaceAppPage(html, "lucidchart-diagrams--123456789");

      expect(result.name).toBe("Lucidchart Diagrams");
      expect(result.slug).toBe("lucidchart-diagrams--123456789");
      expect(result.iconUrl).toBe("https://lh3.googleusercontent.com/icon-lucid.png");
    });

    it("parses rating and review count", () => {
      const entry = buildRawAppEntry({ rating: 4.3, reviewCount: 8500 });
      const html = buildAppHtml(entry);
      const result = parseGoogleWorkspaceAppPage(html, "test--123456789");

      expect(result.averageRating).toBe(4.3);
      expect(result.ratingCount).toBe(8500);
    });

    it("parses developer info", () => {
      const entry = buildRawAppEntry({
        developerName: "Lucid Software",
        developerWebsite: "https://www.lucidchart.com",
      });
      const html = buildAppHtml(entry);
      const result = parseGoogleWorkspaceAppPage(html, "test--123456789");

      expect(result.developer).not.toBeNull();
      expect(result.developer!.name).toBe("Lucid Software");
      expect(result.developer!.url).toBe("https://www.lucidchart.com");
      expect(result.developer!.website).toBe("https://www.lucidchart.com");
    });

    it("returns null developer when developer name is empty", () => {
      const entry = buildRawAppEntry({ developerName: "" });
      const html = buildAppHtml(entry);
      const result = parseGoogleWorkspaceAppPage(html, "test--123456789");

      expect(result.developer).toBeNull();
    });

    it("parses platformData with works-with apps", () => {
      const entry = buildRawAppEntry({ worksWithCodes: [5, 6, 13] });
      const html = buildAppHtml(entry);
      const result = parseGoogleWorkspaceAppPage(html, "test--123456789");
      const pd = result.platformData as Record<string, unknown>;

      expect(pd.worksWithApps).toEqual(["Google Sheets", "Google Docs", "Gmail"]);
    });

    it("parses platformData.googleWorkspaceAppId", () => {
      const entry = buildRawAppEntry({ appId: 555666777 });
      const html = buildAppHtml(entry);
      const result = parseGoogleWorkspaceAppPage(html, "test--555666777");
      const pd = result.platformData as Record<string, unknown>;

      expect(pd.googleWorkspaceAppId).toBe("555666777");
    });

    it("parses platformData descriptions", () => {
      const entry = buildRawAppEntry({
        shortDescription: "Short desc",
        detailedDescription: "Detailed desc",
      });
      const html = buildAppHtml(entry);
      const result = parseGoogleWorkspaceAppPage(html, "test--123456789");
      const pd = result.platformData as Record<string, unknown>;

      expect(pd.shortDescription).toBe("Short desc");
      expect(pd.detailedDescription).toBe("Detailed desc");
    });

    it("parses platformData URL fields", () => {
      const entry = buildRawAppEntry({
        termsOfServiceUrl: "https://example.com/tos",
        privacyPolicyUrl: "https://example.com/privacy",
        supportUrl: "https://example.com/support",
      });
      const html = buildAppHtml(entry);
      const result = parseGoogleWorkspaceAppPage(html, "test--123456789");
      const pd = result.platformData as Record<string, unknown>;

      expect(pd.termsOfServiceUrl).toBe("https://example.com/tos");
      expect(pd.privacyPolicyUrl).toBe("https://example.com/privacy");
      expect(pd.supportUrl).toBe("https://example.com/support");
    });

    it("parses DOM-only fields: pricing hint", () => {
      const entry = buildRawAppEntry();
      const html = buildAppHtml(entry, { pricing: "Free with paid features" });
      const result = parseGoogleWorkspaceAppPage(html, "test--123456789");

      expect(result.pricingHint).toBe("Free with paid features");
      const pd = result.platformData as Record<string, unknown>;
      expect(pd.pricingModel).toBe("freemium");
    });

    it("parses DOM-only fields: screenshots", () => {
      const entry = buildRawAppEntry();
      const html = buildAppHtml(entry, {
        screenshots: [
          "https://lh3.googleusercontent.com/ss1.png",
          "https://lh3.googleusercontent.com/ss2.png",
        ],
      });
      const result = parseGoogleWorkspaceAppPage(html, "test--123456789");
      const pd = result.platformData as Record<string, unknown>;

      expect(pd.screenshots).toEqual([
        "https://lh3.googleusercontent.com/ss1.png",
        "https://lh3.googleusercontent.com/ss2.png",
      ]);
    });

    it("parses DOM-only fields: category from sidebar", () => {
      const entry = buildRawAppEntry();
      const html = buildAppHtml(entry, {
        categoryHref: "/marketplace/category/business-tools/sales-and-crm",
      });
      const result = parseGoogleWorkspaceAppPage(html, "test--123456789");
      const pd = result.platformData as Record<string, unknown>;

      expect(pd.category).toBe("business-tools/sales-and-crm");
    });

    it("parses DOM-only fields: CASA certification badge", () => {
      const entry = buildRawAppEntry();
      const html = buildAppHtml(entry, { casaCertified: true });
      const result = parseGoogleWorkspaceAppPage(html, "test--123456789");

      expect(result.badges).toContain("casa_certified");
      const pd = result.platformData as Record<string, unknown>;
      expect(pd.casaCertified).toBe(true);
    });

    it("parses DOM-only fields: listing updated date", () => {
      const entry = buildRawAppEntry();
      const html = buildAppHtml(entry, { listingUpdated: "January 15, 2026" });
      const result = parseGoogleWorkspaceAppPage(html, "test--123456789");
      const pd = result.platformData as Record<string, unknown>;

      expect(pd.listingUpdated).toBe("January 15, 2026");
    });

    it("handles zero rating and reviewCount as null", () => {
      const entry = buildRawAppEntry({ rating: 0, reviewCount: 0 });
      const html = buildAppHtml(entry);
      const result = parseGoogleWorkspaceAppPage(html, "test--123456789");

      expect(result.averageRating).toBeNull();
      expect(result.ratingCount).toBeNull();
    });

    it("handles wrapped ds:1 format [[entry]]", () => {
      const entry = buildRawAppEntry({ name: "Wrapped App" });
      const wrapped = [entry]; // [[entry]] — wrapped format
      const ds1Json = JSON.stringify(wrapped);
      const html = `<html><head>
        <script>AF_initDataCallback({key: 'ds:1', hash: '1', data:${ds1Json}, sideChannel: {}});</script>
      </head><body></body></html>`;

      const result = parseGoogleWorkspaceAppPage(html, "wrapped--123456789");
      expect(result.name).toBe("Wrapped App");
    });
  });

  describe("DOM fallback parsing", () => {
    it("falls back to DOM when no AF_initDataCallback data exists", () => {
      const html = buildDomOnlyHtml({ name: "DOM App" });
      const result = parseGoogleWorkspaceAppPage(html, "dom-app--987654");

      expect(result.name).toBe("DOM App");
      expect(result.slug).toBe("dom-app--987654");
    });

    it("parses rating from DOM meta tag", () => {
      const html = buildDomOnlyHtml({ rating: "4.1", ratingCount: "200" });
      const result = parseGoogleWorkspaceAppPage(html, "test--123");

      expect(result.averageRating).toBe(4.1);
      expect(result.ratingCount).toBe(200);
    });

    it("parses developer from DOM", () => {
      const html = buildDomOnlyHtml({
        developerName: "DOM Dev",
        developerWebsite: "https://domdev.com",
      });
      const result = parseGoogleWorkspaceAppPage(html, "test--123");

      expect(result.developer?.name).toBe("DOM Dev");
      expect(result.developer?.url).toBe("https://domdev.com");
    });

    it("parses icon URL from DOM (img.TS9dEf)", () => {
      const html = buildDomOnlyHtml({ iconUrl: "https://cdn.example.com/icon.png" });
      const result = parseGoogleWorkspaceAppPage(html, "test--123");

      expect(result.iconUrl).toBe("https://cdn.example.com/icon.png");
    });

    it("parses pricing hint from DOM", () => {
      const html = buildDomOnlyHtml({ pricing: "Free trial" });
      const result = parseGoogleWorkspaceAppPage(html, "test--123");

      expect(result.pricingHint).toBe("Free trial");
      const pd = result.platformData as Record<string, unknown>;
      expect(pd.pricingModel).toBe("free_trial");
    });

    it("parses category from sidebar link", () => {
      const html = buildDomOnlyHtml({ categoryHref: "/marketplace/category/education" });
      const result = parseGoogleWorkspaceAppPage(html, "test--123");
      const pd = result.platformData as Record<string, unknown>;

      expect(pd.category).toBe("education");
    });

    it("parses screenshots from DOM (img.ec1OGc)", () => {
      const html = buildDomOnlyHtml({
        screenshots: [
          "https://lh3.googleusercontent.com/ss1.png",
          "https://lh3.googleusercontent.com/ss2.png",
        ],
      });
      const result = parseGoogleWorkspaceAppPage(html, "test--123");
      const pd = result.platformData as Record<string, unknown>;

      expect(pd.screenshots).toEqual([
        "https://lh3.googleusercontent.com/ss1.png",
        "https://lh3.googleusercontent.com/ss2.png",
      ]);
    });

    it("extracts app ID from data-app-id attribute", () => {
      const html = buildDomOnlyHtml({ appId: "777888" });
      const result = parseGoogleWorkspaceAppPage(html, "test--777888");
      const pd = result.platformData as Record<string, unknown>;

      expect(pd.googleWorkspaceAppId).toBe("777888");
    });

    it("handles CASA badge in DOM fallback", () => {
      const html = buildDomOnlyHtml({ casaCertified: true });
      const result = parseGoogleWorkspaceAppPage(html, "test--123");

      expect(result.badges).toContain("casa_certified");
    });

    it("handles empty DOM gracefully", () => {
      const html = "<html><body></body></html>";
      const result = parseGoogleWorkspaceAppPage(html, "empty--123");

      expect(result.name).toBe("");
      expect(result.slug).toBe("empty--123");
      expect(result.averageRating).toBeNull();
      expect(result.ratingCount).toBeNull();
      expect(result.developer).toBeNull();
    });

    it("extracts install count from body text (e.g., '5,000,000+ users')", () => {
      const html = buildDomOnlyHtml({ installCount: "5,000,000+" });
      const result = parseGoogleWorkspaceAppPage(html, "test--123");
      const pd = result.platformData as Record<string, unknown>;

      expect(pd.installCount).toBe(5000000);
    });
  });
});
