import { describe, it, expect } from "vitest";
import { normalizePlan } from "../app-details-scraper.js";

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
