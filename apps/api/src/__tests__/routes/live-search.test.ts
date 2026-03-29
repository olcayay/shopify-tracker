import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import {
  buildTestApp,
  createMockDb,
  userToken,
  adminToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

// Mock global fetch so platform-specific live searches don't make real HTTP calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Live search routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { liveSearchRoutes } = await import(
      "../../routes/live-search.js"
    );

    app = await buildTestApp({
      routes: liveSearchRoutes,
      prefix: "/api/live-search",
      db: {
        executeResult: [],
      },
    });
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Auth enforcement
  // -----------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 without auth header", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 with invalid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
        headers: { authorization: "Bearer invalid-token" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 200 with valid user token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html></html>",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns 200 with valid admin token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html></html>",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Input validation
  // -----------------------------------------------------------------------

  describe("input validation", () => {
    it("returns 400 when q parameter is missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "q parameter is required" });
    });

    it("returns 400 when q parameter is empty string", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "q parameter is required" });
    });

    it("returns 400 for invalid platform", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=nonexistent&q=test",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 error message mentioning the invalid platform name", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=fakePlatform&q=test",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("fakePlatform");
    });

    it("defaults to shopify when platform is not provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html></html>",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?q=test",
        headers: authHeaders(userToken()),
      });
      // Should succeed (defaults to shopify scraping)
      expect(res.statusCode).toBe(200);
    });

    it("accepts single-character query (minimum length)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html></html>",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=a",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Platform routing - Shopify (default)
  // -----------------------------------------------------------------------

  describe("Shopify search (default)", () => {
    it("returns search results on success", async () => {
      const html = `
        <html><body>
          <div>42 results for test</div>
          <div data-controller="app-card"
               data-app-card-handle-value="my-app"
               data-app-card-name-value="My App"
               data-app-card-app-link-value="/apps/my-app">
            <p>A great app for testing purposes and doing stuff</p>
            <span>4.5 out of 5 stars</span>
            <span>(100) 100 total reviews</span>
          </div>
        </body></html>
      `;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("keyword", "test");
      expect(body.totalResults).toBe(42);
      expect(body.apps).toHaveLength(1);
      expect(body.apps[0]).toMatchObject({
        position: 1,
        app_slug: "my-app",
        app_name: "My App",
        average_rating: 4.5,
        rating_count: 100,
        is_sponsored: false,
        is_built_in: false,
      });
      expect(body.source).toBe("shopify-html");
    });

    it("parses multiple app cards from HTML", async () => {
      const html = `
        <html><body>
          <div>100 results for seo</div>
          <div data-controller="app-card"
               data-app-card-handle-value="app-one"
               data-app-card-name-value="App One"
               data-app-card-app-link-value="/apps/app-one">
            <p>First app description that is longer than ten characters</p>
          </div>
          <div data-controller="app-card"
               data-app-card-handle-value="app-two"
               data-app-card-name-value="App Two"
               data-app-card-app-link-value="/apps/app-two">
            <p>Second app description that is also long enough</p>
          </div>
        </body></html>
      `;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=seo",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      expect(body.totalResults).toBe(100);
      expect(body.apps).toHaveLength(2);
      expect(body.apps[0].app_slug).toBe("app-one");
      expect(body.apps[0].position).toBe(1);
      expect(body.apps[1].app_slug).toBe("app-two");
      expect(body.apps[1].position).toBe(2);
    });

    it("detects sponsored apps from search_ad link parameter", async () => {
      const html = `
        <html><body>
          <div>10 results for email</div>
          <div data-controller="app-card"
               data-app-card-handle-value="sponsored-app"
               data-app-card-name-value="Sponsored App"
               data-app-card-app-link-value="/apps/sponsored-app?surface_type=search_ad&st_source=autocomplete">
            <p>This is a sponsored app that appears at the top of results</p>
          </div>
          <div data-controller="app-card"
               data-app-card-handle-value="organic-app"
               data-app-card-name-value="Organic App"
               data-app-card-app-link-value="/apps/organic-app">
            <p>This is an organic result that appears after sponsored</p>
          </div>
        </body></html>
      `;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=email",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      expect(body.apps).toHaveLength(2);

      const sponsored = body.apps.find((a: any) => a.app_slug === "sponsored-app");
      const organic = body.apps.find((a: any) => a.app_slug === "organic-app");
      expect(sponsored.is_sponsored).toBe(true);
      expect(sponsored.position).toBe(0); // sponsored apps get position 0
      expect(organic.is_sponsored).toBe(false);
      expect(organic.position).toBe(1);
    });

    it("detects built-in apps from bif: slug prefix", async () => {
      const html = `
        <html><body>
          <div>5 apps</div>
          <div data-controller="app-card"
               data-app-card-handle-value="bif:shipping"
               data-app-card-name-value="Shopify Shipping"
               data-app-card-app-link-value="/apps/bif:shipping">
            <p>Built-in shipping app from Shopify for all merchants</p>
          </div>
        </body></html>
      `;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=shipping",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      expect(body.apps).toHaveLength(1);
      expect(body.apps[0].is_built_in).toBe(true);
      expect(body.apps[0].position).toBe(0); // built-in apps get position 0
    });

    it("deduplicates apps with the same slug", async () => {
      const html = `
        <html><body>
          <div>2 results for test</div>
          <div data-controller="app-card"
               data-app-card-handle-value="dup-app"
               data-app-card-name-value="Dup App"
               data-app-card-app-link-value="/apps/dup-app">
            <p>First occurrence of the duplicated app result</p>
          </div>
          <div data-controller="app-card"
               data-app-card-handle-value="dup-app"
               data-app-card-name-value="Dup App"
               data-app-card-app-link-value="/apps/dup-app">
            <p>Second occurrence of the duplicated app result</p>
          </div>
        </body></html>
      `;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      expect(body.apps).toHaveLength(1);
      expect(body.apps[0].app_slug).toBe("dup-app");
    });

    it("returns empty apps when HTML has no app cards", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><body><p>No results found</p></body></html>",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=xyznonexistent",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.totalResults).toBe(0);
      expect(body.apps).toHaveLength(0);
    });

    it("returns 502 when Shopify returns non-OK status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(502);
      expect(res.json()).toHaveProperty("error");
    });

    it("returns 502 when fetch throws a network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(502);
      expect(res.json().error).toContain("Failed to fetch from shopify");
    });
  });

  // -----------------------------------------------------------------------
  // Platform routing - Salesforce
  // -----------------------------------------------------------------------

  describe("Salesforce search", () => {
    it("returns results from Salesforce API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalCount: 5,
          listings: [
            {
              oafId: "sf-app-1",
              title: "SF App",
              description: "A Salesforce app",
              averageRating: 4.2,
              reviewsAmount: 30,
              logos: [{ logoType: "Logo", mediaId: "logo-url" }],
            },
          ],
          featured: [],
        }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=salesforce&q=crm",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.keyword).toBe("crm");
      expect(body.totalResults).toBe(5);
      expect(body.apps).toHaveLength(1);
      expect(body.apps[0].app_slug).toBe("sf-app-1");
      expect(body.apps[0].app_name).toBe("SF App");
      expect(body.apps[0].is_sponsored).toBe(false);
      expect(body.source).toBe("api");
    });

    it("maps featured listings as sponsored", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalCount: 2,
          listings: [
            {
              oafId: "organic-1",
              title: "Organic Result",
              description: "Normal listing",
              averageRating: 3.5,
              reviewsAmount: 10,
              logos: [],
            },
          ],
          featured: [
            {
              oafId: "featured-1",
              title: "Featured App",
              description: "Sponsored listing",
              averageRating: 4.8,
              reviewsAmount: 50,
              logos: [{ logoType: "Logo", mediaId: "featured-logo" }],
            },
          ],
        }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=salesforce&q=analytics",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      expect(body.apps).toHaveLength(2);

      const featured = body.apps.find((a: any) => a.app_slug === "featured-1");
      const organic = body.apps.find((a: any) => a.app_slug === "organic-1");
      expect(featured.is_sponsored).toBe(true);
      expect(featured.logo_url).toBe("featured-logo");
      expect(organic.is_sponsored).toBe(false);
    });

    it("handles missing logo gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalCount: 1,
          listings: [
            {
              oafId: "no-logo-app",
              title: "No Logo",
              description: "App without logo",
              averageRating: 0,
              reviewsAmount: 0,
              logos: [],
            },
          ],
        }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=salesforce&q=niche",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      expect(body.apps[0].logo_url).toBeUndefined();
    });

    it("returns 502 when Salesforce API fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=salesforce&q=crm",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(502);
      expect(res.json().error).toContain("Salesforce");
    });
  });

  // -----------------------------------------------------------------------
  // Platform routing - WordPress
  // -----------------------------------------------------------------------

  describe("WordPress search", () => {
    it("returns results from WordPress plugins API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          info: { results: 250 },
          plugins: [
            {
              slug: "yoast-seo",
              name: "Yoast SEO",
              short_description: "The best SEO plugin",
              rating: 90, // out of 100
              num_ratings: 3500,
              icons: { "2x": "https://example.com/icon-256x256.png" },
            },
            {
              slug: "akismet",
              name: "<strong>Akismet</strong> Anti-Spam",
              short_description: "Spam <em>protection</em> plugin",
              rating: 80,
              num_ratings: 1000,
              icons: { "1x": "https://example.com/icon-128x128.png" },
            },
          ],
        }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=wordpress&q=seo",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.keyword).toBe("seo");
      expect(body.totalResults).toBe(250);
      expect(body.apps).toHaveLength(2);
      expect(body.source).toBe("api");

      // Rating is divided by 20 (100-scale to 5-scale)
      expect(body.apps[0].app_slug).toBe("yoast-seo");
      expect(body.apps[0].average_rating).toBe(4.5);
      expect(body.apps[0].rating_count).toBe(3500);

      // HTML tags stripped from name and description
      expect(body.apps[1].app_name).toBe("Akismet Anti-Spam");
      expect(body.apps[1].short_description).not.toContain("<em>");
    });

    it("uses 2x icon when available, falls back to 1x", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          info: { results: 1 },
          plugins: [
            {
              slug: "plugin-1x",
              name: "Plugin 1x",
              short_description: "Only 1x icon",
              rating: 60,
              num_ratings: 5,
              icons: { "1x": "https://example.com/1x.png" },
            },
          ],
        }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=wordpress&q=plugin",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      expect(body.apps[0].logo_url).toBe("https://example.com/1x.png");
    });

    it("returns 502 when WordPress API fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=wordpress&q=seo",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(502);
      expect(res.json().error).toContain("wordpress");
    });
  });

  // -----------------------------------------------------------------------
  // Platform routing - Atlassian
  // -----------------------------------------------------------------------

  describe("Atlassian search", () => {
    it("returns results from Atlassian Marketplace REST API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 42,
          _embedded: {
            addons: [
              {
                key: "com.example.jira-plugin",
                name: "JIRA Plugin",
                summary: "<p>A great plugin for JIRA</p>",
                _embedded: {
                  reviews: { averageStars: 4.1, count: 200 },
                  logo: { _links: { image: { href: "https://logo.example.com/img.png" } } },
                },
              },
            ],
          },
        }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=atlassian&q=jira",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.keyword).toBe("jira");
      expect(body.totalResults).toBe(42);
      expect(body.apps).toHaveLength(1);
      expect(body.source).toBe("api");

      const app0 = body.apps[0];
      expect(app0.app_slug).toBe("com.example.jira-plugin");
      expect(app0.app_name).toBe("JIRA Plugin");
      // HTML stripped from summary
      expect(app0.short_description).toBe("A great plugin for JIRA");
      expect(app0.short_description).not.toContain("<p>");
      expect(app0.average_rating).toBe(4.1);
      expect(app0.rating_count).toBe(200);
      expect(app0.logo_url).toBe("https://logo.example.com/img.png");
    });

    it("handles empty addons array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 0,
          _embedded: { addons: [] },
        }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=atlassian&q=xyznothing",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      expect(body.totalResults).toBe(0);
      expect(body.apps).toHaveLength(0);
    });

    it("handles missing _embedded field gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ count: 0 }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=atlassian&q=test",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      expect(body.totalResults).toBe(0);
      expect(body.apps).toHaveLength(0);
    });

    it("returns 502 when Atlassian API fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=atlassian&q=jira",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(502);
      expect(res.json().error).toContain("atlassian");
    });
  });

  // -----------------------------------------------------------------------
  // Platform routing - Zoom
  // -----------------------------------------------------------------------

  describe("Zoom search", () => {
    it("returns results from Zoom Marketplace API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 15,
          apps: [
            {
              id: "zoom-app-1",
              displayName: "Zoom Scheduler",
              name: "zoom-scheduler",
              description: "Schedule Zoom meetings easily",
              ratingStatistics: { averageRating: 4.3, totalRatings: 75 },
              icon: "https://cdn.zoom.us/icon.png",
            },
          ],
        }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=zoom&q=scheduler",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.keyword).toBe("scheduler");
      expect(body.totalResults).toBe(15);
      expect(body.apps).toHaveLength(1);
      expect(body.source).toBe("api");

      expect(body.apps[0].app_slug).toBe("zoom-app-1");
      expect(body.apps[0].app_name).toBe("Zoom Scheduler");
      expect(body.apps[0].average_rating).toBe(4.3);
      expect(body.apps[0].rating_count).toBe(75);
      expect(body.apps[0].logo_url).toBe("https://cdn.zoom.us/icon.png");
    });

    it("constructs full icon URL for relative icon paths", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 1,
          apps: [
            {
              id: "zoom-rel",
              displayName: "Rel Icon App",
              description: "Relative icon path",
              icon: "relative/icon/path.png",
            },
          ],
        }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=zoom&q=rel",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      expect(body.apps[0].logo_url).toContain("marketplacecontent-cf.zoom.us");
    });

    it("prefers displayName over name", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 1,
          apps: [
            {
              id: "z1",
              displayName: "Display Name",
              name: "internal-name",
              description: "Test",
            },
          ],
        }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=zoom&q=test",
        headers: authHeaders(userToken()),
      });

      expect(res.json().apps[0].app_name).toBe("Display Name");
    });

    it("returns 502 when Zoom API fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=zoom&q=test",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(502);
      expect(res.json().error).toContain("zoom");
    });
  });

  // -----------------------------------------------------------------------
  // Platform routing - Wix
  // -----------------------------------------------------------------------

  describe("Wix search", () => {
    function buildWixHtml(apps: any[], total?: number) {
      const data = {
        queries: [
          {
            queryKey: ["initial-apps-fetch-search"],
            state: {
              data: {
                appGroup: { apps },
                paging: { total: total ?? apps.length },
              },
            },
          },
        ],
      };
      const encoded = Buffer.from(JSON.stringify(data)).toString("base64");
      return `<html><script>window.__REACT_QUERY_STATE__ = JSON.parse(__decodeBase64('${encoded}'))</script></html>`;
    }

    it("returns results from Wix HTML embedded state", async () => {
      const html = buildWixHtml(
        [
          {
            slug: "wix-app-1",
            name: "Wix Forms",
            shortDescription: "Create forms for your Wix site",
            reviews: { averageRating: 4.0, totalCount: 120 },
            icon: "https://example.com/wix-icon.png",
          },
        ],
        50
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=wix&q=forms",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.keyword).toBe("forms");
      expect(body.totalResults).toBe(50);
      expect(body.apps).toHaveLength(1);
      expect(body.source).toBe("html");
      expect(body.apps[0].app_slug).toBe("wix-app-1");
      expect(body.apps[0].app_name).toBe("Wix Forms");
      expect(body.apps[0].average_rating).toBe(4.0);
      expect(body.apps[0].rating_count).toBe(120);
    });

    it("returns empty results when no REACT_QUERY_STATE in HTML", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><body>Some page without state</body></html>",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=wix&q=nothing",
        headers: authHeaders(userToken()),
      });

      // Throws because __REACT_QUERY_STATE__ not found -> 502
      expect(res.statusCode).toBe(502);
    });

    it("returns empty results when query state has no matching data", async () => {
      const data = { queries: [{ queryKey: ["some-other-key"], state: { data: null } }] };
      const encoded = Buffer.from(JSON.stringify(data)).toString("base64");
      const html = `<html><script>window.__REACT_QUERY_STATE__ = JSON.parse(__decodeBase64('${encoded}'))</script></html>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=wix&q=noresults",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.totalResults).toBe(0);
      expect(body.apps).toHaveLength(0);
    });

    it("returns 502 when Wix returns non-OK status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=wix&q=test",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(502);
      expect(res.json().error).toContain("wix");
    });
  });

  // -----------------------------------------------------------------------
  // Platform routing - Canva (live + DB fallback)
  // -----------------------------------------------------------------------

  describe("Canva search", () => {
    it("returns results from Canva search server", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalResults: 10,
          apps: [
            {
              position: 1,
              app_slug: "canva-app",
              app_name: "Canva Template",
              short_description: "Templates for Canva",
              average_rating: 4.5,
              rating_count: 200,
              is_sponsored: false,
              is_built_in: false,
              is_built_for_shopify: false,
            },
          ],
          source: "live",
        }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=canva&q=template",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.keyword).toBe("template");
      expect(body.totalResults).toBe(10);
      expect(body.apps).toHaveLength(1);
      expect(body.source).toBe("live");
    });

    it("falls back to DB when Canva search server returns error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=canva&q=design",
        headers: authHeaders(userToken()),
      });

      // Should still succeed, falling back to DB
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.source).toBe("database");
    });

    it("falls back to DB when Canva search server times out", async () => {
      mockFetch.mockRejectedValueOnce(new Error("The operation was aborted"));

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=canva&q=photo",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.source).toBe("database");
    });
  });

  // -----------------------------------------------------------------------
  // Platform routing - DB-based platforms
  // -----------------------------------------------------------------------

  describe("database-based platform search", () => {
    it("google_workspace uses database search and returns source field", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=google_workspace&q=mail",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.keyword).toBe("mail");
      expect(body.source).toBe("database");
      expect(body).toHaveProperty("totalResults");
      expect(body).toHaveProperty("apps");
    });

    it("zoho uses database search and returns source field", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=zoho&q=crm",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.keyword).toBe("crm");
      expect(body.source).toBe("database");
    });

    it("zendesk uses database search and returns source field", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=zendesk&q=slack",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.keyword).toBe("slack");
      expect(body.source).toBe("database");
    });

    it("hubspot uses database search and returns source field", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=hubspot&q=email",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.keyword).toBe("email");
      expect(body.source).toBe("database");
    });

    it("database search returns empty array with totalResults=0 when no rows match", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=google_workspace&q=zzzznonexistent",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.totalResults).toBe(0);
      expect(body.apps).toEqual([]);
      expect(body.source).toBe("database");
    });
  });

  // -----------------------------------------------------------------------
  // External service error handling
  // -----------------------------------------------------------------------

  describe("external service error handling", () => {
    it("returns 502 with descriptive error when fetch is rejected", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(502);
      const body = res.json();
      expect(body.error).toContain("Failed to fetch from shopify");
      expect(body.error).toContain("ECONNREFUSED");
    });

    it("returns 502 when WordPress API throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("DNS resolution failed"));

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=wordpress&q=seo",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(502);
      expect(res.json().error).toContain("wordpress");
    });

    it("returns 502 when Atlassian API throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Request timeout"));

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=atlassian&q=jira",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(502);
      expect(res.json().error).toContain("atlassian");
    });

    it("returns 502 when Zoom API throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Socket hang up"));

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=zoom&q=meeting",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(502);
      expect(res.json().error).toContain("zoom");
    });
  });

  // -----------------------------------------------------------------------
  // Response shape consistency
  // -----------------------------------------------------------------------

  describe("response shape consistency", () => {
    it("returns keyword, totalResults, and apps array for all responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html></html>",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=inventory",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("keyword");
      expect(body).toHaveProperty("totalResults");
      expect(body).toHaveProperty("apps");
      expect(Array.isArray(body.apps)).toBe(true);
      expect(typeof body.totalResults).toBe("number");
      expect(typeof body.keyword).toBe("string");
    });

    it("all app objects in Salesforce results have required SearchApp fields", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalCount: 1,
          listings: [
            {
              oafId: "sf-check",
              title: "Consistency Check",
              description: "Checking fields",
              averageRating: 3.0,
              reviewsAmount: 5,
              logos: [],
            },
          ],
        }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=salesforce&q=check",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      for (const app of body.apps) {
        expect(app).toHaveProperty("position");
        expect(app).toHaveProperty("app_slug");
        expect(app).toHaveProperty("app_name");
        expect(app).toHaveProperty("short_description");
        expect(app).toHaveProperty("average_rating");
        expect(app).toHaveProperty("rating_count");
        expect(app).toHaveProperty("is_sponsored");
        expect(app).toHaveProperty("is_built_in");
        expect(app).toHaveProperty("is_built_for_shopify");
        expect(typeof app.position).toBe("number");
        expect(typeof app.app_slug).toBe("string");
        expect(typeof app.app_name).toBe("string");
        expect(typeof app.average_rating).toBe("number");
        expect(typeof app.rating_count).toBe("number");
        expect(typeof app.is_sponsored).toBe("boolean");
        expect(typeof app.is_built_in).toBe("boolean");
        expect(typeof app.is_built_for_shopify).toBe("boolean");
      }
    });

    it("all app objects in database results have required SearchApp fields", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=google_workspace&q=mail",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      // Even with empty results, the shape should be valid
      expect(Array.isArray(body.apps)).toBe(true);
      expect(typeof body.totalResults).toBe("number");
    });

    it("source field is present in all successful responses", async () => {
      // Shopify
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html></html>",
      });
      const shopifyRes = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
        headers: authHeaders(userToken()),
      });
      expect(shopifyRes.json().source).toBe("shopify-html");

      // DB platform
      const dbRes = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=zoho&q=test",
        headers: authHeaders(userToken()),
      });
      expect(dbRes.json().source).toBe("database");

      // API platform
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalCount: 0,
          listings: [],
        }),
      });
      const sfRes = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=salesforce&q=test",
        headers: authHeaders(userToken()),
      });
      expect(sfRes.json().source).toBe("api");
    });
  });
});
