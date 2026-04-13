import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SalesforceModule } from "../index.js";
import { SALESFORCE_CONSTANTS } from "../constants.js";
import type { HttpClient } from "../../../http-client.js";
import type { BrowserClient } from "../../../browser-client.js";

const listingJson = JSON.parse(
  readFileSync(
    resolve(__dirname, "../__fixtures__/partners-listing-detail.json"),
    "utf8",
  ),
);
const SLUG = "a0N300000024XvyEAE";

function makeHttp(impl: (url: string) => Promise<string>): HttpClient {
  return { fetchPage: vi.fn(impl) } as unknown as HttpClient;
}
function makeBrowser(impl?: (url: string) => Promise<string>): BrowserClient {
  return { fetchPage: vi.fn(impl ?? (async () => "<html><body>no stores</body></html>")) } as unknown as BrowserClient;
}

// Restore constants after each test (we flip the mode in some cases).
const originalMode = SALESFORCE_CONSTANTS.appDetailFetchMode;
beforeEach(() => {
  (SALESFORCE_CONSTANTS as any).appDetailFetchMode = originalMode;
});

describe("SalesforceModule.fetchAppPage — mode=http (default)", () => {
  it("uses the HTTP detail endpoint as primary", async () => {
    const http = makeHttp(async (url) => {
      expect(url).toContain("/partners/experience/listings/");
      return JSON.stringify(listingJson);
    });
    const browser = makeBrowser(async () => {
      throw new Error("browser should not be called");
    });
    const mod = new SalesforceModule(http, browser);
    const out = await mod.fetchAppPage(SLUG);
    const envelope = JSON.parse(out);
    expect(envelope._fromJsonApi).toBe(true);
    expect(envelope._parsed.slug).toBe(SLUG);
  });

  it("falls back to browser on HTTP error", async () => {
    const http = makeHttp(async (url) => {
      if (url.includes("partners/experience")) throw new Error("404");
      // search API fallback shouldn't fire here
      throw new Error(`unexpected http url ${url}`);
    });
    const browserHtml = `<html><script>window.stores = ${JSON.stringify({ LISTING: { listing: listingJson } })};</script></html>`;
    const browser = makeBrowser(async () => browserHtml);
    const mod = new SalesforceModule(http, browser);
    const out = await mod.fetchAppPage(SLUG);
    // Browser returns HTML (no envelope), parseAppDetails handles it downstream.
    expect(out.startsWith("<html>")).toBe(true);
  });

  it("falls back to search API when both HTTP and browser fail", async () => {
    const http = vi.fn(async (url: string) => {
      if (url.includes("partners/experience")) throw new Error("partners down");
      if (url.includes("/listings?") && url.includes("keyword=")) {
        return JSON.stringify({
          items: [{ oafId: SLUG, title: "X", description: "Y", publisher: "Z", rating: 0, numberOfUserReviews: 0, listingCategories: [] }],
        });
      }
      throw new Error(`unexpected ${url}`);
    });
    const browser = makeBrowser(async () => {
      throw new Error("browser down");
    });
    const mod = new SalesforceModule({ fetchPage: http } as any, browser);
    const out = await mod.fetchAppPage(SLUG);
    const envelope = JSON.parse(out);
    expect(envelope._fromSearch).toBe(true);
    expect(envelope._parsed.slug).toBe(SLUG);
  });
});

describe("SalesforceModule.fetchAppPage — mode=browser (rollback)", () => {
  beforeEach(() => {
    (SALESFORCE_CONSTANTS as any).appDetailFetchMode = "browser";
  });

  it("uses browser as primary when mode flipped", async () => {
    const http = makeHttp(async () => {
      throw new Error("http should not be called");
    });
    const browserHtml = `<html><script>window.stores = ${JSON.stringify({ LISTING: { listing: listingJson } })};</script></html>`;
    const browser = makeBrowser(async () => browserHtml);
    const mod = new SalesforceModule(http, browser);
    const out = await mod.fetchAppPage(SLUG);
    expect(out.startsWith("<html>")).toBe(true);
  });

  it("falls back to HTTP when browser fails in browser mode", async () => {
    const http = makeHttp(async (url) => {
      expect(url).toContain("/partners/experience/listings/");
      return JSON.stringify(listingJson);
    });
    const browser = makeBrowser(async () => {
      throw new Error("browser crashed");
    });
    const mod = new SalesforceModule(http, browser);
    const out = await mod.fetchAppPage(SLUG);
    const envelope = JSON.parse(out);
    expect(envelope._fromJsonApi).toBe(true);
  });
});

describe("parseAppDetails envelope handling", () => {
  it("unwraps _fromJsonApi envelope directly", () => {
    const mod = new SalesforceModule(makeHttp(async () => ""), makeBrowser());
    const envelope = JSON.stringify({
      _fromJsonApi: true,
      _parsed: { slug: SLUG, name: "X", averageRating: null, ratingCount: null, pricingHint: null, pricingModel: null, iconUrl: null, developer: null, badges: [], platformData: {} },
    });
    const out = mod.parseAppDetails(envelope, SLUG);
    expect(out.name).toBe("X");
  });
});
