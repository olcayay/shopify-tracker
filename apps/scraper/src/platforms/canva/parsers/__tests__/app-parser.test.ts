import { describe, it, expect } from "vitest";
import {
  extractCanvaApps,
  extractCanvaDetailApp,
  normalizeCanvaApp,
  parseCanvaAppPage,
  extractCanvaAppListingApi,
} from "../app-parser.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build minimal embedded JSON HTML like the /apps bulk page */
function buildBulkHtml(
  apps: { id: string; name: string; topics?: string[]; urlSlug?: string; type?: string }[],
): string {
  const entries = apps.map((app) => {
    const obj = {
      A: app.id,
      B: app.type || "SDK_APP",
      C: app.name,
      D: `${app.name} short desc`,
      E: `${app.name} tagline`,
      F: `${app.name} Dev`,
      G: { A: `https://cdn.canva.com/${app.id}/icon.png`, B: 128, C: 128 },
      H: `${app.name} full description`,
      I: app.topics ?? [],
    };
    const json = JSON.stringify(obj);
    const slug = app.urlSlug || app.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `<a href="/apps/${app.id}/${slug}">${json}</a>`;
  });
  return `<html><body>${entries.join("")}</body></html>`;
}

/** Build minimal detail page HTML */
function buildDetailHtml(appId: string, overrides: Record<string, any> = {}): string {
  const obj: Record<string, any> = {
    A: appId,
    C: overrides.developer ?? "Test Developer",
    E: overrides.name ?? "Test App",
    F: overrides.shortDescription ?? "Short desc",
    G: overrides.tagline ?? "App tagline",
    H: overrides.fullDescription ?? "Full description here",
    K: overrides.iconUrl ?? "https://cdn.canva.com/icon.png",
    I: overrides.promoCardUrl ?? "https://cdn.canva.com/promo.png",
    L: overrides.termsUrl ?? "https://example.com/terms",
    M: overrides.privacyUrl ?? "https://example.com/privacy",
    N: overrides.developerWebsite ?? "https://example.com",
    O: overrides.screenshots ?? ["https://cdn.canva.com/ss1.png", "https://cdn.canva.com/ss2.png"],
    V: overrides.permissions ?? [
      { A: "design:read", B: "MANDATORY" },
      { A: "asset:write", B: "OPTIONAL" },
    ],
    Y: overrides.languages ?? ["en", "fr", "de"],
    X: overrides.devInfo ?? {
      A: "Test Developer",
      B: "dev@test.com",
      C: "+1234567890",
      D: { A: "123 Main St", C: "San Francisco", D: "US", E: "CA", F: "94105" },
    },
  };
  const json = JSON.stringify(obj);
  return `<html><body>${json}</body></html>`;
}

/** Build appListing API injected HTML */
function buildApiHtml(appId: string, overrides: Record<string, any> = {}): string {
  const obj: Record<string, any> = {
    A: {
      A: appId,
      B: 42,
      C: "SDK_APP",
      D: overrides.name ?? "API App",
      E: overrides.shortDescription ?? "API short desc",
      F: overrides.fullDescription ?? "API full description",
      G: overrides.tagline ?? "API tagline",
      T: overrides.developer ?? "API Developer",
      H: overrides.icon ? { A: overrides.icon } : { A: "https://cdn.canva.com/api-icon.png" },
      I: { A: "https://cdn.canva.com/api-promo.png" },
      J: overrides.screenshots ?? [],
      K: "https://example.com/terms",
      L: "https://example.com/privacy",
      M: overrides.website ?? "https://api-dev.com",
      e: overrides.languages ?? ["en"],
      Y: overrides.devInfo ?? { A: "API Developer", B: "api@dev.com" },
    },
  };
  const jsonStr = JSON.stringify(obj);
  return `<html><body><!-- CANVA_APP_LISTING_API:${jsonStr}:END_CANVA_APP_LISTING_API --></body></html>`;
}

// ---------------------------------------------------------------------------
// extractCanvaApps
// ---------------------------------------------------------------------------

describe("extractCanvaApps", () => {
  it("extracts apps from embedded JSON", () => {
    const html = buildBulkHtml([
      { id: "AAF_test1", name: "App One" },
      { id: "AAF_test2", name: "App Two" },
    ]);
    const apps = extractCanvaApps(html);
    expect(apps).toHaveLength(2);
    expect(apps[0].name).toBe("App One");
    expect(apps[1].name).toBe("App Two");
  });

  it("extracts app ID correctly", () => {
    const html = buildBulkHtml([{ id: "AAF_myApp1", name: "My App" }]);
    const apps = extractCanvaApps(html);
    expect(apps[0].id).toBe("AAF_myApp1");
  });

  it("extracts icon URL from field G.A", () => {
    const html = buildBulkHtml([{ id: "AAF_icon1", name: "Icon App" }]);
    const apps = extractCanvaApps(html);
    expect(apps[0].iconUrl).toBe("https://cdn.canva.com/AAF_icon1/icon.png");
  });

  it("extracts developer name from field F", () => {
    const html = buildBulkHtml([{ id: "AAF_dev1", name: "DevApp" }]);
    const apps = extractCanvaApps(html);
    expect(apps[0].developer).toBe("DevApp Dev");
  });

  it("extracts topics (marketplace_topic.* only)", () => {
    const html = buildBulkHtml([
      { id: "AAF_topics1", name: "TopicApp", topics: ["marketplace_topic.forms", "marketplace_topic.ai_text", "other_tag"] },
    ]);
    const apps = extractCanvaApps(html);
    expect(apps[0].topics).toEqual(["marketplace_topic.forms", "marketplace_topic.ai_text"]);
  });

  it("deduplicates apps by ID", () => {
    const html = buildBulkHtml([
      { id: "AAF_dup1", name: "Dup App" },
      { id: "AAF_dup1", name: "Dup App Copy" },
    ]);
    const apps = extractCanvaApps(html);
    expect(apps).toHaveLength(1);
    expect(apps[0].name).toBe("Dup App");
  });

  it("handles EXTENSION type apps", () => {
    const html = buildBulkHtml([{ id: "AAD_ext1", name: "Extension App", type: "EXTENSION" }]);
    const apps = extractCanvaApps(html);
    expect(apps).toHaveLength(1);
    expect(apps[0].appType).toBe("EXTENSION");
  });

  it("derives urlSlug from page link", () => {
    const html = buildBulkHtml([{ id: "AAF_slug1", name: "Slug Test", urlSlug: "my-custom-slug" }]);
    const apps = extractCanvaApps(html);
    expect(apps[0].urlSlug).toBe("my-custom-slug");
  });

  it("returns empty array for HTML without apps", () => {
    const apps = extractCanvaApps("<html><body>No apps here</body></html>");
    expect(apps).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractCanvaDetailApp
// ---------------------------------------------------------------------------

describe("extractCanvaDetailApp", () => {
  it("extracts detail app data from HTML", () => {
    const html = buildDetailHtml("AAF_detail1", { name: "Detail App" });
    const app = extractCanvaDetailApp(html, "AAF_detail1");
    expect(app).not.toBeNull();
    expect(app!.name).toBe("Detail App");
    expect(app!.id).toBe("AAF_detail1");
  });

  it("extracts developer info", () => {
    const html = buildDetailHtml("AAF_dev1", {
      developer: "ACME Corp",
      developerWebsite: "https://acme.com",
    });
    const app = extractCanvaDetailApp(html, "AAF_dev1");
    expect(app!.developer).toBe("ACME Corp");
    expect(app!.developerWebsite).toBe("https://acme.com");
  });

  it("extracts developer address from X.D", () => {
    const html = buildDetailHtml("AAF_addr1");
    const app = extractCanvaDetailApp(html, "AAF_addr1");
    expect(app!.developerAddress).toEqual({
      street: "123 Main St",
      city: "San Francisco",
      country: "US",
      state: "CA",
      zip: "94105",
    });
  });

  it("extracts screenshots", () => {
    const html = buildDetailHtml("AAF_ss1", {
      screenshots: ["https://cdn.canva.com/s1.png", "https://cdn.canva.com/s2.png"],
    });
    const app = extractCanvaDetailApp(html, "AAF_ss1");
    expect(app!.screenshots).toEqual(["https://cdn.canva.com/s1.png", "https://cdn.canva.com/s2.png"]);
  });

  it("extracts permissions", () => {
    const html = buildDetailHtml("AAF_perm1", {
      permissions: [{ A: "design:read", B: "MANDATORY" }],
    });
    const app = extractCanvaDetailApp(html, "AAF_perm1");
    expect(app!.permissions).toEqual([{ scope: "design:read", type: "MANDATORY" }]);
  });

  it("extracts languages", () => {
    const html = buildDetailHtml("AAF_lang1", { languages: ["en", "ja", "ko"] });
    const app = extractCanvaDetailApp(html, "AAF_lang1");
    expect(app!.languages).toEqual(["en", "ja", "ko"]);
  });

  it("returns null when app ID not found", () => {
    const html = buildDetailHtml("AAF_other");
    const app = extractCanvaDetailApp(html, "AAF_missing");
    expect(app).toBeNull();
  });

  it("returns null for empty HTML", () => {
    const app = extractCanvaDetailApp("<html><body></body></html>", "AAF_test");
    expect(app).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractCanvaAppListingApi
// ---------------------------------------------------------------------------

describe("extractCanvaAppListingApi", () => {
  it("extracts app from API marker", () => {
    const html = buildApiHtml("AAF_api1", { name: "API Test App" });
    const app = extractCanvaAppListingApi(html, "AAF_api1");
    expect(app).not.toBeNull();
    expect(app!.name).toBe("API Test App");
  });

  it("extracts developer from T field", () => {
    const html = buildApiHtml("AAF_api2", { developer: "API Dev Co" });
    const app = extractCanvaAppListingApi(html, "AAF_api2");
    expect(app!.developer).toBe("API Dev Co");
  });

  it("extracts languages from e field", () => {
    const html = buildApiHtml("AAF_api3", { languages: ["en", "es"] });
    const app = extractCanvaAppListingApi(html, "AAF_api3");
    expect(app!.languages).toEqual(["en", "es"]);
  });

  it("returns null when marker not found", () => {
    const app = extractCanvaAppListingApi("<html><body>no marker</body></html>", "AAF_test");
    expect(app).toBeNull();
  });

  it("returns null when app ID doesn't match", () => {
    const html = buildApiHtml("AAF_wrong");
    const app = extractCanvaAppListingApi(html, "AAF_expected");
    expect(app).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeCanvaApp
// ---------------------------------------------------------------------------

describe("normalizeCanvaApp", () => {
  it("normalizes embedded app to NormalizedAppDetails", () => {
    const result = normalizeCanvaApp({
      id: "AAF_norm1",
      appType: "SDK_APP",
      name: "Normalized App",
      shortDescription: "Short",
      tagline: "Tagline",
      developer: "Dev Co",
      iconUrl: "https://cdn.canva.com/icon.png",
      fullDescription: "Full desc",
      topics: ["marketplace_topic.forms"],
      urlSlug: "normalized-app",
    });

    expect(result.name).toBe("Normalized App");
    expect(result.slug).toBe("AAF_norm1--normalized-app");
    expect(result.averageRating).toBeNull();
    expect(result.ratingCount).toBeNull();
    expect(result.developer?.name).toBe("Dev Co");
    expect(result.badges).toEqual([]);
  });

  it("adds canva_extension badge for EXTENSION type", () => {
    const result = normalizeCanvaApp({
      id: "AAD_ext1",
      appType: "EXTENSION",
      name: "Ext",
      shortDescription: "",
      tagline: "",
      developer: "",
      iconUrl: "",
      fullDescription: "",
      topics: [],
      urlSlug: "ext",
    });
    expect(result.badges).toEqual(["canva_extension"]);
  });

  it("uses only app ID as slug when urlSlug is empty", () => {
    const result = normalizeCanvaApp({
      id: "AAF_noslug",
      appType: "SDK_APP",
      name: "No Slug",
      shortDescription: "",
      tagline: "",
      developer: "",
      iconUrl: "",
      fullDescription: "",
      topics: [],
      urlSlug: "",
    });
    expect(result.slug).toBe("AAF_noslug");
  });
});

// ---------------------------------------------------------------------------
// parseCanvaAppPage
// ---------------------------------------------------------------------------

describe("parseCanvaAppPage", () => {
  it("parses from SSR detail page (priority 1)", () => {
    const html = buildDetailHtml("AAF_ssr1", { name: "SSR App" });
    const result = parseCanvaAppPage(html, "AAF_ssr1--ssr-app");
    expect(result.name).toBe("SSR App");
    expect(result.slug).toBe("AAF_ssr1--ssr-app");
  });

  it("parses from appListing API (priority 2) when no detail", () => {
    const html = buildApiHtml("AAF_api1", { name: "API Only App" });
    const result = parseCanvaAppPage(html, "AAF_api1--api-only-app");
    expect(result.name).toBe("API Only App");
  });

  it("falls back to bulk page format (priority 3)", () => {
    const html = buildBulkHtml([{ id: "AAF_bulk1", name: "Bulk App", urlSlug: "bulk-app" }]);
    const result = parseCanvaAppPage(html, "AAF_bulk1--bulk-app");
    expect(result.name).toBe("Bulk App");
  });

  it("returns fallback for unknown app", () => {
    const html = "<html><body>nothing</body></html>";
    const result = parseCanvaAppPage(html, "AAF_unknown--my-app");
    expect(result.name).toBe("my app");
    expect(result.slug).toBe("AAF_unknown--my-app");
    expect(result.averageRating).toBeNull();
    expect(result.ratingCount).toBeNull();
    expect(result.developer).toBeNull();
  });

  it("extracts appId from slug with double dash", () => {
    const html = buildDetailHtml("AAF_dash1", { name: "Dash App" });
    const result = parseCanvaAppPage(html, "AAF_dash1--dash-app");
    expect(result.name).toBe("Dash App");
  });

  it("handles slug without double dash", () => {
    const html = buildDetailHtml("AAF_nodash", { name: "No Dash" });
    const result = parseCanvaAppPage(html, "AAF_nodash");
    expect(result.name).toBe("No Dash");
  });
});
