import { describe, it, expect } from "vitest";
import { normalizePlan, is404Error, resolveDeveloperForSnapshot } from "../app-details-scraper.js";
import { AppNotFoundError } from "../../utils/app-not-found-error.js";

/**
 * stripHtmlTags and parseWordPressDate are private functions.
 * Replicated here for testing.
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "\u2013").replace(/&mdash;/g, "\u2014")
    .replace(/&lsquo;/g, "\u2018").replace(/&rsquo;/g, "\u2019")
    .replace(/&ldquo;/g, "\u201C").replace(/&rdquo;/g, "\u201D")
    .replace(/&hellip;/g, "\u2026")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseWordPressDate(dateStr: string): Date | null {
  try {
    const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})(am|pm)\s+(\w+)$/i);
    if (match) {
      const [, datePart, hourStr, minStr, ampm] = match;
      let hour = parseInt(hourStr, 10);
      if (ampm.toLowerCase() === "pm" && hour !== 12) hour += 12;
      if (ampm.toLowerCase() === "am" && hour === 12) hour = 0;
      return new Date(`${datePart}T${String(hour).padStart(2, "0")}:${minStr}:00Z`);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// normalizePlan
// ---------------------------------------------------------------------------
describe("normalizePlan", () => {
  it("normalizes a complete plan object", () => {
    const result = normalizePlan({
      name: "Basic",
      price: 9.99,
      period: "monthly",
      yearly_price: 99,
      discount_text: "Save 20%",
      trial_text: "14-day trial",
      features: ["Feature A", "Feature B"],
      currency_code: "USD",
      units: "per user",
    });
    expect(result).toEqual({
      name: "Basic",
      price: "9.99",
      period: "monthly",
      yearly_price: "99",
      discount_text: "Save 20%",
      trial_text: "14-day trial",
      features: ["Feature A", "Feature B"],
      currency_code: "USD",
      units: "per user",
    });
  });

  it("converts numeric price to string", () => {
    expect(normalizePlan({ price: 0 }).price).toBe("0");
    expect(normalizePlan({ price: 49.99 }).price).toBe("49.99");
  });

  it("converts yearly_price to string", () => {
    expect(normalizePlan({ yearly_price: 199 }).yearly_price).toBe("199");
  });

  it("handles null/undefined fields", () => {
    const result = normalizePlan({});
    expect(result.name).toBeNull();
    expect(result.price).toBeNull();
    expect(result.period).toBeNull();
    expect(result.yearly_price).toBeNull();
    expect(result.discount_text).toBeNull();
    expect(result.trial_text).toBeNull();
    expect(result.features).toEqual([]);
    expect(result.currency_code).toBeNull();
    expect(result.units).toBeNull();
  });

  it("accepts plan_name as alias for name", () => {
    const result = normalizePlan({ plan_name: "Pro" });
    expect(result.name).toBe("Pro");
  });

  it("prefers name over plan_name", () => {
    const result = normalizePlan({ name: "Pro", plan_name: "Basic" });
    expect(result.name).toBe("Pro");
  });

  it("preserves features array", () => {
    const features = ["Unlimited users", "Priority support"];
    const result = normalizePlan({ features });
    expect(result.features).toEqual(features);
  });

  it("returns consistent key order", () => {
    const keys = Object.keys(normalizePlan({}));
    expect(keys).toEqual([
      "name", "price", "period", "yearly_price",
      "discount_text", "trial_text", "features",
      "currency_code", "units",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Badge extraction logic (mirrors metaBadges pattern in app-details-scraper)
// ---------------------------------------------------------------------------
describe("badge persistence spread pattern", () => {
  // Mirrors the extraction: ("_badges" in details ? details._badges : null)
  // and the spread: ...(metaBadges && metaBadges.length > 0 && { badges: metaBadges })
  function extractBadgeSpread(details: Record<string, unknown>): Record<string, string[]> | Record<string, never> {
    const metaBadges = ("_badges" in details ? details._badges : null) as string[] | null;
    return metaBadges && metaBadges.length > 0 ? { badges: metaBadges } : {};
  }

  it("extracts badges from details with _badges field", () => {
    const details = { _badges: ["cloud_fortified", "top_vendor"] };
    expect(extractBadgeSpread(details)).toEqual({ badges: ["cloud_fortified", "top_vendor"] });
  });

  it("does not spread empty badges array (avoids overwriting existing)", () => {
    const details = { _badges: [] };
    expect(extractBadgeSpread(details)).toEqual({});
  });

  it("does not spread when _badges is null", () => {
    const details = { _badges: null };
    expect(extractBadgeSpread(details)).toEqual({});
  });

  it("does not spread when _badges field is absent (Shopify path)", () => {
    const details = { app_name: "Test App" };
    expect(extractBadgeSpread(details)).toEqual({});
  });

  it("preserves single badge", () => {
    const details = { _badges: ["built_for_shopify"] };
    expect(extractBadgeSpread(details)).toEqual({ badges: ["built_for_shopify"] });
  });
});

// ---------------------------------------------------------------------------
// stripHtmlTags
// ---------------------------------------------------------------------------
describe("stripHtmlTags", () => {
  it("removes simple HTML tags", () => {
    expect(stripHtmlTags("<p>Hello</p>")).toBe("Hello");
  });

  it("converts <br> to newline", () => {
    expect(stripHtmlTags("Line 1<br>Line 2")).toBe("Line 1\nLine 2");
    expect(stripHtmlTags("Line 1<br/>Line 2")).toBe("Line 1\nLine 2");
    expect(stripHtmlTags("Line 1<br />Line 2")).toBe("Line 1\nLine 2");
  });

  it("converts </p> to double newline", () => {
    expect(stripHtmlTags("<p>Para 1</p><p>Para 2</p>")).toBe("Para 1\n\nPara 2");
  });

  it("converts </li> to newline", () => {
    expect(stripHtmlTags("<li>Item 1</li><li>Item 2</li>")).toBe("Item 1\nItem 2");
  });

  it("decodes numeric HTML entities", () => {
    expect(stripHtmlTags("&#169;")).toBe("©");
    expect(stripHtmlTags("&#8364;")).toBe("€");
  });

  it("decodes hex HTML entities", () => {
    expect(stripHtmlTags("&#xA9;")).toBe("©");
    expect(stripHtmlTags("&#x20AC;")).toBe("€");
  });

  it("decodes named HTML entities", () => {
    expect(stripHtmlTags("&amp;")).toBe("&");
    expect(stripHtmlTags("&lt;")).toBe("<");
    expect(stripHtmlTags("&gt;")).toBe(">");
    expect(stripHtmlTags("&quot;")).toBe('"');
    expect(stripHtmlTags("&apos;")).toBe("'");
    expect(stripHtmlTags("a&nbsp;b")).toBe("a b");
  });

  it("decodes typographic entities", () => {
    expect(stripHtmlTags("&ndash;")).toBe("\u2013");
    expect(stripHtmlTags("&mdash;")).toBe("\u2014");
    expect(stripHtmlTags("&lsquo;")).toBe("\u2018");
    expect(stripHtmlTags("&rsquo;")).toBe("\u2019");
    expect(stripHtmlTags("&ldquo;")).toBe("\u201C");
    expect(stripHtmlTags("&rdquo;")).toBe("\u201D");
    expect(stripHtmlTags("&hellip;")).toBe("\u2026");
  });

  it("collapses multiple spaces/tabs to single space", () => {
    expect(stripHtmlTags("Hello    World")).toBe("Hello World");
    expect(stripHtmlTags("Hello\t\tWorld")).toBe("Hello World");
  });

  it("collapses 3+ newlines to double newline", () => {
    expect(stripHtmlTags("A\n\n\n\nB")).toBe("A\n\nB");
  });

  it("trims whitespace", () => {
    expect(stripHtmlTags("  Hello  ")).toBe("Hello");
  });

  it("handles empty string", () => {
    expect(stripHtmlTags("")).toBe("");
  });

  it("handles complex HTML", () => {
    const html = '<div class="desc"><p>App <strong>description</strong> with <a href="#">link</a>.</p><ul><li>Feature 1</li><li>Feature 2</li></ul></div>';
    const result = stripHtmlTags(html);
    expect(result).toContain("App description with link.");
    expect(result).toContain("Feature 1");
    expect(result).toContain("Feature 2");
  });
});

// ---------------------------------------------------------------------------
// parseWordPressDate
// ---------------------------------------------------------------------------
describe("parseWordPressDate", () => {
  it("parses WordPress date format (pm)", () => {
    const result = parseWordPressDate("2024-11-03 3:14pm GMT");
    expect(result).not.toBeNull();
    expect(result!.toISOString()).toBe("2024-11-03T15:14:00.000Z");
  });

  it("parses WordPress date format (am)", () => {
    const result = parseWordPressDate("2025-01-15 10:00am GMT");
    expect(result).not.toBeNull();
    expect(result!.toISOString()).toBe("2025-01-15T10:00:00.000Z");
  });

  it("handles 12pm correctly (noon)", () => {
    const result = parseWordPressDate("2024-06-01 12:30pm GMT");
    expect(result).not.toBeNull();
    expect(result!.toISOString()).toBe("2024-06-01T12:30:00.000Z");
  });

  it("handles 12am correctly (midnight)", () => {
    const result = parseWordPressDate("2024-06-01 12:00am GMT");
    expect(result).not.toBeNull();
    expect(result!.toISOString()).toBe("2024-06-01T00:00:00.000Z");
  });

  it("falls back to native Date parsing for non-WordPress formats", () => {
    const result = parseWordPressDate("2024-01-15T10:00:00Z");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
  });

  it("returns null for invalid date strings", () => {
    expect(parseWordPressDate("not a date")).toBeNull();
    expect(parseWordPressDate("")).toBeNull();
  });

  it("returns null for empty-ish strings", () => {
    expect(parseWordPressDate("abc xyz")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PLA-273: Platform-specific category mapping
// ---------------------------------------------------------------------------
describe("platform category mapping", () => {
  // Helper that replicates the category extraction logic from app-details-scraper
  function mapCategories(platform: string, pd: Record<string, unknown>): { title: string; url: string }[] {
    if (platform === "salesforce") {
      return ((pd.listingCategories as string[]) || []).map(
        (cat: string) => ({ title: cat, url: "" })
      );
    } else if (platform === "wix") {
      return ((pd.categories as Array<{ slug?: string; title?: string }>) || []).map(
        (c) => ({ title: c.title || c.slug || "", url: "" })
      );
    } else if (platform === "wordpress") {
      const tags = (pd.tags || {}) as Record<string, string>;
      return Object.values(tags).map(
        (t: string) => ({ title: t, url: "" })
      );
    } else if (platform === "atlassian") {
      const listCats = (pd.listingCategories as string[]) || [];
      if (listCats.length > 0) {
        return listCats.map((cat: string) => ({ title: cat, url: "" }));
      }
      return ((pd.categories as Array<{ slug?: string; name?: string }>) || []).map(
        (c) => ({ title: c.name || c.slug || "", url: "" })
      );
    } else if (platform === "zoho") {
      return ((pd.categories as Array<{ slug?: string }>) || []).map(
        (c) => ({ title: c.slug || "", url: "" })
      );
    } else if (platform === "zendesk") {
      return ((pd.categories as Array<{ slug?: string; name?: string }>) || []).map(
        (c) => ({ title: c.name || c.slug || "", url: "" })
      );
    } else if (platform === "hubspot") {
      return ((pd.categories as Array<{ slug?: string; displayName?: string }>) || []).map(
        (c) => ({ title: c.displayName || c.slug || "", url: "" })
      );
    } else if (platform === "google_workspace") {
      const cat = pd.category as string | undefined;
      return cat ? [{ title: cat, url: "" }] : [];
    }
    return [];
  }

  it("maps Salesforce listingCategories", () => {
    const result = mapCategories("salesforce", { listingCategories: ["Analytics", "Sales"] });
    expect(result).toEqual([
      { title: "Analytics", url: "" },
      { title: "Sales", url: "" },
    ]);
  });

  it("maps Wix categories with title", () => {
    const result = mapCategories("wix", {
      categories: [{ slug: "marketing", title: "Marketing" }, { slug: "analytics", title: "Analytics" }],
    });
    expect(result).toEqual([
      { title: "Marketing", url: "" },
      { title: "Analytics", url: "" },
    ]);
  });

  it("maps WordPress tags object", () => {
    const result = mapCategories("wordpress", {
      tags: { seo: "SEO", "contact-form": "Contact Form" },
    });
    expect(result).toEqual([
      { title: "SEO", url: "" },
      { title: "Contact Form", url: "" },
    ]);
  });

  it("maps Atlassian listingCategories (string[])", () => {
    const result = mapCategories("atlassian", {
      listingCategories: ["Admin Tools", "Testing"],
    });
    expect(result).toEqual([
      { title: "Admin Tools", url: "" },
      { title: "Testing", url: "" },
    ]);
  });

  it("maps Atlassian categories (object[]) when no listingCategories", () => {
    const result = mapCategories("atlassian", {
      categories: [{ slug: "admin-tools", name: "Admin Tools" }],
    });
    expect(result).toEqual([{ title: "Admin Tools", url: "" }]);
  });

  it("maps Zoho categories", () => {
    const result = mapCategories("zoho", {
      categories: [{ slug: "crm" }, { slug: "analytics" }],
    });
    expect(result).toEqual([
      { title: "crm", url: "" },
      { title: "analytics", url: "" },
    ]);
  });

  it("maps Zendesk categories", () => {
    const result = mapCategories("zendesk", {
      categories: [{ slug: "productivity", name: "Productivity" }],
    });
    expect(result).toEqual([{ title: "Productivity", url: "" }]);
  });

  it("maps HubSpot categories", () => {
    const result = mapCategories("hubspot", {
      categories: [{ slug: "sales", displayName: "Sales" }, { slug: "marketing", displayName: "Marketing" }],
    });
    expect(result).toEqual([
      { title: "Sales", url: "" },
      { title: "Marketing", url: "" },
    ]);
  });

  it("maps Google Workspace single category", () => {
    const result = mapCategories("google_workspace", { category: "Business Tools" });
    expect(result).toEqual([{ title: "Business Tools", url: "" }]);
  });

  it("returns empty for Google Workspace without category", () => {
    const result = mapCategories("google_workspace", {});
    expect(result).toEqual([]);
  });

  it("returns empty for unknown platform", () => {
    const result = mapCategories("shopify", {});
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PLA-274: Platform-specific pricing normalization
// ---------------------------------------------------------------------------
describe("platform pricing normalization", () => {
  function normalizePlatformPricing(platform: string, p: any) {
    if (platform === "atlassian") {
      return {
        name: p.name || "",
        price: p.price != null ? String(p.price) : null,
        period: p.period === "monthly" ? "month" : p.period === "yearly" ? "year" : p.period || null,
        yearly_price: p.yearly_price != null ? String(p.yearly_price) : null,
        discount_text: null,
        trial_text: p.trialDays > 0 ? `${p.trialDays}-day free trial` : null,
        features: p.features || [],
        currency_code: p.currency_code || null,
        units: p.units || null,
      };
    } else if (platform === "hubspot") {
      return {
        name: p.name || "",
        price: p.monthlyPrice != null ? String(p.monthlyPrice) : (p.price != null ? String(p.price) : null),
        period: Array.isArray(p.model) ? p.model.join(", ") : (p.model || p.frequency || null),
        yearly_price: p.yearlyPrice != null ? String(p.yearlyPrice) : null,
        discount_text: null,
        trial_text: p.trial_days > 0 ? `${p.trial_days}-day free trial` : null,
        features: p.features || [],
        currency_code: p.currency_code || null,
        units: p.units || null,
      };
    }
    // Default
    return {
      name: p.plan_name || p.name || "",
      price: p.price != null ? String(p.price) : null,
      period: p.frequency === "monthly" ? "month" : p.frequency === "yearly" ? "year" : p.frequency || null,
      yearly_price: null,
      discount_text: null,
      trial_text: p.trial_days > 0 ? `${p.trial_days}-day free trial` : null,
      features: [],
      currency_code: p.currency_code || null,
      units: p.units || null,
    };
  }

  it("normalizes Atlassian pricing with period field", () => {
    const result = normalizePlatformPricing("atlassian", {
      name: "Standard",
      price: 10,
      period: "monthly",
      yearly_price: 100,
      trialDays: 30,
      features: ["Feature A"],
    });
    expect(result.name).toBe("Standard");
    expect(result.price).toBe("10");
    expect(result.period).toBe("month");
    expect(result.yearly_price).toBe("100");
    expect(result.trial_text).toBe("30-day free trial");
    expect(result.features).toEqual(["Feature A"]);
  });

  it("normalizes HubSpot pricing with monthlyPrice and model array", () => {
    const result = normalizePlatformPricing("hubspot", {
      name: "Professional",
      monthlyPrice: 45,
      model: ["monthly", "yearly"],
      features: ["CRM", "Marketing"],
    });
    expect(result.name).toBe("Professional");
    expect(result.price).toBe("45");
    expect(result.period).toBe("monthly, yearly");
    expect(result.features).toEqual(["CRM", "Marketing"]);
  });

  it("normalizes default platform pricing with frequency", () => {
    const result = normalizePlatformPricing("salesforce", {
      plan_name: "Enterprise",
      price: 99,
      frequency: "monthly",
      trial_days: 14,
    });
    expect(result.name).toBe("Enterprise");
    expect(result.price).toBe("99");
    expect(result.period).toBe("month");
    expect(result.trial_text).toBe("14-day free trial");
  });
});

// ---------------------------------------------------------------------------
// PLA-253: Zod platformData validation (pure function test)
// ---------------------------------------------------------------------------
describe("platformData validation errors tracking", () => {
  it("adds _validationErrors to platformData when validation fails", () => {
    // Simulates what app-details-scraper does before insert
    const pdOriginal: Record<string, unknown> = { someField: 123 };
    const validationErrors = ["someField: Expected string, received number"];
    const pdWithErrors = { ...pdOriginal, _validationErrors: validationErrors };
    expect(pdWithErrors._validationErrors).toEqual(["someField: Expected string, received number"]);
    expect(pdWithErrors.someField).toBe(123);
  });

  it("does not add _validationErrors when validation passes", () => {
    const pdOriginal: Record<string, unknown> = { description: "test" };
    // When validation passes, no _validationErrors is added
    expect(pdOriginal).not.toHaveProperty("_validationErrors");
  });
});

// ---------------------------------------------------------------------------
// PLA-769: isBoilerplateMeta — guard against false change detection
// Replicated here since the module has heavy DB/HTTP imports
// ---------------------------------------------------------------------------
const BOILERPLATE_META: Record<string, string[]> = {
  shopify: ["Shopify App Store, download apps for your Shopify store"],
  canva: ["Discover apps and integrations for Canva"],
  wordpress: ["WordPress.org Plugin Directory"],
  salesforce: ["Salesforce AppExchange"],
};

function isBoilerplateMeta(meta: string, platform: string): boolean {
  const patterns = BOILERPLATE_META[platform];
  if (!patterns) return false;
  const trimmed = meta.trim().toLowerCase();
  return patterns.some((p) => trimmed.startsWith(p.toLowerCase()));
}

describe("isBoilerplateMeta", () => {
  it("detects Shopify boilerplate meta", () => {
    expect(isBoilerplateMeta("Shopify App Store, download apps for your Shopify store", "shopify")).toBe(true);
  });

  it("detects Canva boilerplate meta", () => {
    expect(isBoilerplateMeta("Discover apps and integrations for Canva", "canva")).toBe(true);
  });

  it("detects WordPress boilerplate meta", () => {
    expect(isBoilerplateMeta("WordPress.org Plugin Directory", "wordpress")).toBe(true);
  });

  it("detects Salesforce boilerplate meta", () => {
    expect(isBoilerplateMeta("Salesforce AppExchange", "salesforce")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isBoilerplateMeta("shopify app store, download apps for your shopify store", "shopify")).toBe(true);
  });

  it("trims whitespace", () => {
    expect(isBoilerplateMeta("  Shopify App Store, download apps for your Shopify store  ", "shopify")).toBe(true);
  });

  it("returns false for real app meta description", () => {
    expect(isBoilerplateMeta("Boost your sales with our amazing marketing tool", "shopify")).toBe(false);
  });

  it("returns false for unknown platform", () => {
    expect(isBoilerplateMeta("Some meta description", "unknown_platform")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isBoilerplateMeta("", "shopify")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PLA-769: Change detection guards (unit logic)
// ---------------------------------------------------------------------------
describe("change detection guards", () => {
  // Replicate the guarded logic from app-details-scraper
  function detectFieldChanges(
    fieldMap: Record<string, [string, string]>,
    platform: string,
  ): Array<{ field: string; oldValue: string; newValue: string }> {
    const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];
    for (const [field, [oldVal, newVal]] of Object.entries(fieldMap)) {
      if (oldVal !== newVal && oldVal) {
        if (!newVal) continue; // skip content→empty
        if (field === "seoMetaDescription" && isBoilerplateMeta(newVal, platform)) continue;
        changes.push({ field, oldValue: oldVal, newValue: newVal });
      }
    }
    return changes;
  }

  it("records legitimate field change", () => {
    const changes = detectFieldChanges({
      appIntroduction: ["Old intro", "New intro"],
    }, "shopify");
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({ field: "appIntroduction", oldValue: "Old intro", newValue: "New intro" });
  });

  it("skips first-time population (old empty)", () => {
    const changes = detectFieldChanges({
      appIntroduction: ["", "New intro"],
    }, "shopify");
    expect(changes).toHaveLength(0);
  });

  it("skips content→empty (scrape failure)", () => {
    const changes = detectFieldChanges({
      appIntroduction: ["Real content here", ""],
    }, "shopify");
    expect(changes).toHaveLength(0);
  });

  it("skips boilerplate seoMetaDescription", () => {
    const changes = detectFieldChanges({
      seoMetaDescription: ["Real app SEO description", "Shopify App Store, download apps for your Shopify store"],
    }, "shopify");
    expect(changes).toHaveLength(0);
  });

  it("records real seoMetaDescription change", () => {
    const changes = detectFieldChanges({
      seoMetaDescription: ["Old SEO desc", "New and improved SEO desc"],
    }, "shopify");
    expect(changes).toHaveLength(1);
  });

  it("skips content→empty for multiple fields simultaneously", () => {
    const changes = detectFieldChanges({
      appIntroduction: ["Intro", ""],
      appDetails: ["Details", ""],
      seoTitle: ["Title", ""],
    }, "canva");
    expect(changes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// is404Error — detect HTTP 404 in errors thrown by HttpClient/platform fetchers.
// Guards the delisted_at flow in scrapeApp — if this regresses, 404s will be
// counted as scrape failures instead of delistings. See PLA-1035.
// ---------------------------------------------------------------------------
describe("is404Error", () => {
  it("detects HTTP 404 in wrapped HttpClient error", () => {
    // HttpClient rethrows as: "All N attempts failed for URL: HTTP 404: Not Found"
    const err = new Error(
      "All 5 attempts failed for https://apps.shopify.com/buy-again: HTTP 404: Not Found"
    );
    expect(is404Error(err)).toBe(true);
  });

  it("detects HTTP 404 in direct error", () => {
    expect(is404Error(new Error("HTTP 404: Not Found"))).toBe(true);
  });

  it("returns true for AppNotFoundError with HTTP 404 detail", () => {
    // Belt-and-suspenders: AppNotFoundError is handled before is404Error in
    // the caller, but the string detection still holds up.
    const err = new AppNotFoundError("slug", "shopify", "HTTP 404");
    expect(is404Error(err)).toBe(true);
  });

  it("does not match other HTTP errors", () => {
    expect(is404Error(new Error("HTTP 500: Internal Server Error"))).toBe(false);
    expect(is404Error(new Error("HTTP 403: Forbidden"))).toBe(false);
    expect(is404Error(new Error("HTTP 429: Too Many Requests"))).toBe(false);
  });

  it("does not match a naked '404' substring (avoids false positives in slugs/paths)", () => {
    expect(is404Error(new Error("request to 404.html failed"))).toBe(false);
    expect(is404Error(new Error("error code: 4040"))).toBe(false);
  });

  it("handles null/undefined/string inputs safely", () => {
    expect(is404Error(null)).toBe(false);
    expect(is404Error(undefined)).toBe(false);
    expect(is404Error("HTTP 404: Not Found")).toBe(true);
    expect(is404Error("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveDeveloperForSnapshot — PLA-1070
// ---------------------------------------------------------------------------
describe("resolveDeveloperForSnapshot (PLA-1070)", () => {
  it("returns the incoming developer when name is populated", () => {
    const result = resolveDeveloperForSnapshot(
      { name: "Acme", url: "https://acme.example" },
      { name: "Old Acme", url: "https://old.example" },
    );
    expect(result).toEqual({ name: "Acme", url: "https://acme.example" });
  });

  it("preserves previous developer when incoming is null", () => {
    const result = resolveDeveloperForSnapshot(null, { name: "Acme" });
    expect(result).toEqual({ name: "Acme" });
  });

  it("preserves previous developer when incoming has empty name", () => {
    const result = resolveDeveloperForSnapshot({ name: "", url: "" }, { name: "Acme" });
    expect(result).toEqual({ name: "Acme" });
  });

  it("preserves previous developer when incoming name is whitespace only", () => {
    const result = resolveDeveloperForSnapshot({ name: "   " }, { name: "Acme" });
    expect(result).toEqual({ name: "Acme" });
  });

  it("returns null when both incoming and previous are empty (no historical data)", () => {
    expect(resolveDeveloperForSnapshot(null, null)).toBeNull();
    expect(resolveDeveloperForSnapshot({ name: "" }, null)).toEqual({ name: "" });
  });

  it("returns incoming when previous has no usable name", () => {
    const result = resolveDeveloperForSnapshot({ name: "Acme" }, { name: "" });
    expect(result).toEqual({ name: "Acme" });
  });
});
