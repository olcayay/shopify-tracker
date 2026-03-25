import { describe, it, expect } from "vitest";
import { parseHubSpotSearchPage } from "../search-parser.js";
import { makeChirpSearchResponse } from "./fixtures.js";

describe("parseHubSpotSearchPage", () => {
  it("filters cards by keyword in name", () => {
    const json = makeChirpSearchResponse({
      cards: [
        { slug: "gmail", listingName: "Gmail", description: "Email client" },
        { slug: "slack", listingName: "Slack", description: "Team messaging" },
        { slug: "mailchimp-campaign-sync", listingName: "Mailchimp Campaign Sync", description: "Email sync" },
      ],
    });
    const result = parseHubSpotSearchPage(json, "mail", 1);
    expect(result.apps).toHaveLength(2);
    expect(result.apps.map((a) => a.appSlug)).toContain("gmail");
    expect(result.apps.map((a) => a.appSlug)).toContain("mailchimp-campaign-sync");
  });

  it("filters cards by keyword in description", () => {
    const json = makeChirpSearchResponse({
      cards: [
        { slug: "app1", listingName: "App One", description: "A CRM integration tool" },
        { slug: "app2", listingName: "App Two", description: "Photo editor" },
      ],
    });
    const result = parseHubSpotSearchPage(json, "crm", 1);
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].appSlug).toBe("app1");
  });

  it("filters cards by keyword in company name", () => {
    const json = makeChirpSearchResponse({
      cards: [
        { slug: "app1", listingName: "Sales Pro", companyName: "Acme Corp" },
        { slug: "app2", listingName: "Data Sync", companyName: "HubSpot" },
      ],
    });
    const result = parseHubSpotSearchPage(json, "acme", 1);
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].appSlug).toBe("app1");
  });

  it("filters cards by keyword in slug", () => {
    const json = makeChirpSearchResponse({
      cards: [
        { slug: "salesforce-hubspot", listingName: "Salesforce Integration" },
        { slug: "zapier", listingName: "Zapier" },
      ],
    });
    const result = parseHubSpotSearchPage(json, "salesforce", 1);
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].appSlug).toBe("salesforce-hubspot");
  });

  it("matches any keyword in multi-word search", () => {
    const json = makeChirpSearchResponse({
      cards: [
        { slug: "email-app", listingName: "Email App", description: "Send emails" },
        { slug: "marketing-hub", listingName: "Marketing Hub", description: "Marketing tools" },
        { slug: "chat-app", listingName: "Chat App", description: "Live chat" },
      ],
    });
    const result = parseHubSpotSearchPage(json, "email marketing", 1);
    expect(result.apps).toHaveLength(2);
  });

  it("is case insensitive", () => {
    const json = makeChirpSearchResponse({
      cards: [{ slug: "slack", listingName: "Slack", description: "Team Messaging" }],
    });
    const result = parseHubSpotSearchPage(json, "SLACK", 1);
    expect(result.apps).toHaveLength(1);
  });

  it("assigns sequential positions to filtered results", () => {
    const json = makeChirpSearchResponse({
      cards: [
        { slug: "a", listingName: "Alpha Mail" },
        { slug: "b", listingName: "Beta Mail" },
      ],
    });
    const result = parseHubSpotSearchPage(json, "mail", 1);
    expect(result.apps[0].position).toBe(1);
    expect(result.apps[1].position).toBe(2);
  });

  it("sets totalResults to number of filtered results", () => {
    const json = makeChirpSearchResponse({
      cards: [
        { slug: "match", listingName: "Match" },
        { slug: "no", listingName: "No" },
      ],
    });
    const result = parseHubSpotSearchPage(json, "match", 1);
    expect(result.totalResults).toBe(1);
  });

  it("always returns hasNextPage false", () => {
    const json = makeChirpSearchResponse();
    const result = parseHubSpotSearchPage(json, "test", 1);
    expect(result.hasNextPage).toBe(false);
  });

  it("passes through keyword and page", () => {
    const json = makeChirpSearchResponse({ cards: [] });
    const result = parseHubSpotSearchPage(json, "my keyword", 3);
    expect(result.keyword).toBe("my keyword");
    expect(result.currentPage).toBe(3);
  });

  it("returns empty for invalid JSON", () => {
    const result = parseHubSpotSearchPage("bad json", "test", 1);
    expect(result.apps).toEqual([]);
    expect(result.totalResults).toBeNull();
  });

  it("returns empty when no cards match", () => {
    const json = makeChirpSearchResponse({
      cards: [{ slug: "unrelated", listingName: "Unrelated App" }],
    });
    const result = parseHubSpotSearchPage(json, "zzz-nonexistent", 1);
    expect(result.apps).toEqual([]);
    expect(result.totalResults).toBe(0);
  });
});
