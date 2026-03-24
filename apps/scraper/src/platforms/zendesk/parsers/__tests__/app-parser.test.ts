import { describe, it, expect } from "vitest";
import { parseZendeskAppDetails } from "../app-parser.js";

/** Build a minimal HTML page with JSON-LD structured data. */
function makeJsonLdHtml(data: Record<string, any>, extras = ""): string {
  return `
    <html><head>
      <script type="application/ld+json">${JSON.stringify(data)}</script>
    </head><body>
      <h1>${data.name || "App"}</h1>
      ${extras}
    </body></html>
  `;
}

/** Build a minimal HTML page with __NEXT_DATA__ embedded JSON. */
function makeNextDataHtml(pageProps: Record<string, any>, extras = ""): string {
  const nextData = { props: { pageProps } };
  return `
    <html><head></head><body>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>
      ${extras}
    </body></html>
  `;
}

/** Build a minimal DOM-only HTML page (no JSON-LD, no __NEXT_DATA__). */
function makeDomHtml(overrides: Partial<{
  name: string;
  rating: string;
  reviewCount: string;
  iconSrc: string;
  developerName: string;
  developerUrl: string;
  pricing: string;
  shortDescription: string;
  longDescription: string;
  categories: Array<{ slug: string; name: string }>;
  products: string[];
}> = {}): string {
  const catLinks = (overrides.categories ?? [])
    .map((c) => `<a href="?category=${encodeURIComponent(c.slug)}">${c.name}</a>`)
    .join("");

  const productDivs = (overrides.products ?? [])
    .map((p) => `<span class="product">${p}</span>`)
    .join("");

  return `
    <html><body>
      <h1>${overrides.name ?? "DOM App"}</h1>
      <div class="app-icon"><img src="${overrides.iconSrc ?? ""}" /></div>
      <div class="rating-value" data-rating="${overrides.rating ?? ""}">${overrides.rating ?? ""}</div>
      <div class="review-count">${overrides.reviewCount ?? ""}</div>
      <div class="developer"><a href="${overrides.developerUrl ?? ""}">${overrides.developerName ?? ""}</a></div>
      <div class="pricing">${overrides.pricing ?? ""}</div>
      <div class="subtitle">${overrides.shortDescription ?? ""}</div>
      <div class="description">${overrides.longDescription ?? ""}</div>
      ${catLinks}
      ${productDivs}
    </body></html>
  `;
}

describe("parseZendeskAppDetails", () => {
  describe("JSON-LD parsing", () => {
    it("should parse app details from JSON-LD SoftwareApplication", () => {
      const html = makeJsonLdHtml({
        "@type": "SoftwareApplication",
        name: "Slack",
        description: "Connect Slack with Zendesk",
        image: "https://cdn.example.com/slack.png",
        datePublished: "2020-01-15",
        softwareVersion: "3.2.1",
        author: { name: "Slack Technologies", url: "https://slack.com" },
        aggregateRating: { ratingValue: 4.3, ratingCount: 215 },
      });

      const result = parseZendeskAppDetails(html, "972305--slack");

      expect(result.name).toBe("Slack");
      expect(result.slug).toBe("972305--slack");
      expect(result.averageRating).toBe(4.3);
      expect(result.ratingCount).toBe(215);
      expect(result.iconUrl).toBe("https://cdn.example.com/slack.png");
      expect(result.developer).toEqual({ name: "Slack Technologies", url: "https://slack.com" });
      expect(result.badges).toEqual([]);
      expect(result.platformData).toMatchObject({
        shortDescription: "Connect Slack with Zendesk",
        datePublished: "2020-01-15",
        version: "3.2.1",
        source: "json-ld",
      });
    });

    it("should parse WebApplication type", () => {
      const html = makeJsonLdHtml({
        "@type": "WebApplication",
        name: "Web App",
        author: "Simple Author",
      });

      const result = parseZendeskAppDetails(html, "111--web-app");
      expect(result.name).toBe("Web App");
      expect(result.developer).toEqual({ name: "Simple Author" });
    });

    it("should handle missing aggregateRating", () => {
      const html = makeJsonLdHtml({
        "@type": "SoftwareApplication",
        name: "No Ratings App",
      });

      const result = parseZendeskAppDetails(html, "222--no-ratings");
      expect(result.averageRating).toBeNull();
      expect(result.ratingCount).toBeNull();
    });

    it("should handle missing author", () => {
      const html = makeJsonLdHtml({
        "@type": "SoftwareApplication",
        name: "No Author App",
      });

      const result = parseZendeskAppDetails(html, "333--no-author");
      // Should fall back to extractDeveloper from DOM, which finds nothing
      expect(result.developer).toBeNull();
    });
  });

  describe("__NEXT_DATA__ parsing", () => {
    it("should parse app from __NEXT_DATA__ pageProps.app", () => {
      const html = makeNextDataHtml({
        app: {
          name: "Zendesk App",
          rating: { average: 3.8, count: 42 },
          pricing: "Free",
          icon: "https://cdn.example.com/icon.png",
          author: { name: "DevCo", url: "https://devco.com", website: "https://devco.com/site" },
          shortDescription: "Short desc",
          longDescription: "Long description here",
          datePublished: "2023-06-01",
          version: "1.0.0",
          categories: [{ slug: "ai-and-bots", name: "AI and Bots" }],
          products: ["support", "chat"],
        },
      });

      const result = parseZendeskAppDetails(html, "444--zendesk-app");

      expect(result.name).toBe("Zendesk App");
      expect(result.slug).toBe("444--zendesk-app");
      expect(result.averageRating).toBe(3.8);
      expect(result.ratingCount).toBe(42);
      expect(result.pricingHint).toBe("Free");
      expect(result.iconUrl).toBe("https://cdn.example.com/icon.png");
      expect(result.developer).toEqual({
        name: "DevCo",
        url: "https://devco.com",
        website: "https://devco.com/site",
      });
      expect(result.platformData).toMatchObject({
        shortDescription: "Short desc",
        longDescription: "Long description here",
        pricing: "Free",
        datePublished: "2023-06-01",
        version: "1.0.0",
        source: "next-data",
      });
    });

    it("should handle missing app in __NEXT_DATA__", () => {
      const html = makeNextDataHtml({});

      const result = parseZendeskAppDetails(html, "555--empty-next");
      // Falls back to h1 text or slug
      expect(result.slug).toBe("555--empty-next");
    });
  });

  describe("DOM fallback parsing", () => {
    it("should parse basic DOM elements", () => {
      const html = makeDomHtml({
        name: "DOM Parsed App",
        rating: "4.1",
        reviewCount: "(123 reviews)",
        iconSrc: "https://cdn.example.com/dom-icon.png",
        developerName: "DOM Dev",
        developerUrl: "https://domdev.com",
        pricing: "$10/month",
        shortDescription: "A DOM subtitle",
        longDescription: "Full description from DOM",
        categories: [{ slug: "messaging", name: "Messaging" }],
        products: ["support", "chat"],
      });

      const result = parseZendeskAppDetails(html, "666--dom-app");

      expect(result.name).toBe("DOM Parsed App");
      expect(result.slug).toBe("666--dom-app");
      expect(result.averageRating).toBe(4.1);
      expect(result.ratingCount).toBe(123);
      expect(result.iconUrl).toBe("https://cdn.example.com/dom-icon.png");
      expect(result.pricingHint).toBe("$10/month");
      expect(result.developer).toEqual({ name: "DOM Dev", url: "https://domdev.com" });
      expect(result.platformData).toMatchObject({ source: "dom-fallback" });
    });

    it("should use slug as name when h1 is empty", () => {
      const html = "<html><body><h1></h1></body></html>";
      const result = parseZendeskAppDetails(html, "777--fallback-slug");

      expect(result.name).toBe("777--fallback-slug");
    });

    it("should handle completely empty HTML", () => {
      const result = parseZendeskAppDetails("<html><body></body></html>", "888--empty");

      expect(result.slug).toBe("888--empty");
      expect(result.averageRating).toBeNull();
      expect(result.ratingCount).toBeNull();
      expect(result.pricingHint).toBeNull();
      expect(result.iconUrl).toBeNull();
      expect(result.developer).toBeNull();
      expect(result.platformData).toMatchObject({ source: "dom-fallback" });
    });

    it("should extract categories from href with ?category= parameter", () => {
      const html = makeDomHtml({
        categories: [
          { slug: "ai-and-bots", name: "AI and Bots" },
          { slug: "messaging", name: "Messaging" },
        ],
      });

      const result = parseZendeskAppDetails(html, "999--cats");
      const cats = result.platformData.categories as Array<{ slug: string; name: string }>;
      expect(cats).toHaveLength(2);
      expect(cats[0].slug).toBe("ai-and-bots");
      expect(cats[0].name).toBe("AI and Bots");
    });

    it("should extract products from product class elements", () => {
      const html = makeDomHtml({ products: ["Support", "Chat"] });

      const result = parseZendeskAppDetails(html, "1000--prods");
      const products = result.platformData.products as string[];
      expect(products).toContain("support");
      expect(products).toContain("chat");
    });

    it("should deduplicate extracted products", () => {
      // Two elements both mentioning support
      const html = `<html><body>
        <h1>Duped</h1>
        <div class="product">Support</div>
        <div class="product-label">Support Version</div>
      </body></html>`;

      const result = parseZendeskAppDetails(html, "1001--dedup");
      const products = result.platformData.products as string[];
      const supportCount = products.filter((p) => p === "support").length;
      expect(supportCount).toBe(1);
    });
  });

  describe("JSON-LD type filtering", () => {
    it("should ignore non-SoftwareApplication/WebApplication JSON-LD types", () => {
      const html = `
        <html><head>
          <script type="application/ld+json">{"@type": "Organization", "name": "Acme"}</script>
        </head><body><h1>Org App</h1></body></html>
      `;

      const result = parseZendeskAppDetails(html, "1100--org-type");
      // Falls through to DOM fallback since Organization type is skipped
      expect(result.platformData).toMatchObject({ source: "dom-fallback" });
      expect(result.name).toBe("Org App");
    });
  });
});
