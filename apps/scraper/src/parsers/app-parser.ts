import * as cheerio from "cheerio";
import {
  createLogger,
  type AppDetails,
  type AppDeveloper,
  type AppCategory,
  type AppSubcategoryGroup,
  type AppFeature,
  type PricingTier,
} from "@shopify-tracking/shared";

const log = createLogger("app-parser");

/**
 * Parse an app detail page and extract all available data.
 * Uses JSON-LD structured data for rating/name, HTML for the rest.
 */
export function parseAppPage(html: string, slug: string): AppDetails {
  const $ = cheerio.load(html);

  const jsonLd = parseJsonLd($);
  const appName = jsonLd?.name || $("h1").first().text().trim() || slug;

  const safeParse = <T>(name: string, fn: () => T, fallback: T): T => {
    try { return fn(); } catch (e) {
      log.warn(`failed to parse ${name}`, { slug, error: String(e) });
      return fallback;
    }
  };

  const title = safeParse("title", () => parseTitle($), "");
  const description = safeParse("description", () => parseFullDescription($), "");
  const pricing = safeParse("pricing", () => parsePricingSummary($), "");
  const developer = safeParse("developer", () => parseDeveloper($), { name: "", url: "" });
  const demoStoreUrl = safeParse("demoStoreUrl", () => parseDemoStoreUrl($), null);
  const languages = safeParse("languages", () => parseLanguages($), []);
  const worksWith = safeParse("worksWith", () => parseWorksWith($), []);
  const categories = safeParse("categories", () => parseCategories($), []);
  const pricingTiers = safeParse("pricingTiers", () => parsePricingTiers($), []);

  return {
    app_slug: slug,
    app_name: appName,
    title,
    description,
    pricing,
    average_rating: jsonLd?.ratingValue ?? null,
    rating_count: jsonLd?.ratingCount ?? null,
    developer,
    demo_store_url: demoStoreUrl,
    languages,
    works_with: worksWith,
    categories,
    pricing_tiers: pricingTiers,
  };
}

// --- JSON-LD ---

interface JsonLdData {
  name: string;
  ratingValue: number | null;
  ratingCount: number | null;
}

function parseJsonLd($: cheerio.CheerioAPI): JsonLdData | null {
  let result: JsonLdData | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "");
      if (data["@type"] === "SoftwareApplication") {
        result = {
          name: data.name || "",
          ratingValue: data.aggregateRating?.ratingValue ?? null,
          ratingCount: data.aggregateRating?.ratingCount ?? null,
        };
      }
    } catch {}
  });

  return result;
}

// --- Parsers ---

function parseTitle($: cheerio.CheerioAPI): string {
  // h2 after "Featured images gallery" is the tagline/title
  const h2s = $("h2");
  let found = false;
  let title = "";

  h2s.each((_, el) => {
    const text = $(el).text().trim();
    if (found && !title && text.length > 5 && text.length < 300) {
      // Skip known non-title h2s
      if (
        !text.startsWith("Pricing") &&
        !text.startsWith("Reviews") &&
        !text.startsWith("Support") &&
        !text.startsWith("More apps") &&
        !text.startsWith("Want to add") &&
        !text.startsWith("Log in") &&
        !text.startsWith("Apps by") &&
        !text.includes("isn't compatible")
      ) {
        title = text;
      }
    }
    if (text === "Featured images gallery") found = true;
  });

  return title;
}

function parseFullDescription($: cheerio.CheerioAPI): string {
  const metaDesc = $('meta[name="description"]').attr("content")?.trim();
  return metaDesc || "";
}

function parsePricingSummary($: cheerio.CheerioAPI): string {
  // Look for "Free plan available", "Free trial available", etc.
  const bodyText = $.text();
  const patterns = [
    /Free plan available/i,
    /Free trial available/i,
    /Free to install/i,
    /Free$/m,
    /From \$[\d.]+\/month/i,
  ];

  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match) return match[0];
  }

  // Fallback: check first pricing card
  const firstCard = $(".app-details-pricing-plan-card").first();
  if (firstCard.length) {
    const text = firstCard.text().replace(/\s+/g, " ").trim();
    if (text.includes("Free")) return "Free plan available";
    const priceMatch = text.match(/\$[\d.]+/);
    if (priceMatch) return `From ${priceMatch[0]}/month`;
  }

  return "";
}

function parseDeveloper($: cheerio.CheerioAPI): AppDeveloper {
  let name = "";
  let url = "";
  let website: string | undefined;

  // Partner link
  $('a[href*="/partners/"]').each((_, el) => {
    const $el = $(el);
    if ($el.closest('.megamenu-component, .side-menu-component').length > 0) return;
    if (!name) {
      name = $el.text().trim();
      url = $el.attr("href") || "";
      if (url && !url.startsWith("http")) {
        url = `https://apps.shopify.com${url}`;
      }
    }
  });

  // Developer website link
  $('a[href]').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (text === "website" || text === "developer website") {
      website = $(el).attr("href") || undefined;
    }
  });

  return { name, url, website };
}

function parseDemoStoreUrl($: cheerio.CheerioAPI): string | null {
  let demoUrl: string | null = null;
  $("a").each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (text.includes("demo store") || text.includes("view demo")) {
      demoUrl = $(el).attr("href") || null;
    }
  });
  return demoUrl;
}

function parseLanguages($: cheerio.CheerioAPI): string[] {
  const bodyText = $.text();
  const match = bodyText.match(/Languages\s+([\s\S]*?)(?:Works with|Categories|$)/);
  if (!match) return [];

  const langText = match[1].trim();
  // Split by common delimiters and clean up
  return langText
    .split(/[,\n]/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.length < 50);
}

function parseWorksWith($: cheerio.CheerioAPI): string[] {
  const bodyText = $.text();
  const match = bodyText.match(/Works with\s+([\s\S]*?)(?:Categories|Built for|$)/);
  if (!match) return [];

  const text = match[1].trim();
  return text
    .split(/[,\n]/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && w.length < 100);
}

function parseCategories($: cheerio.CheerioAPI): AppCategory[] {
  const categories: AppCategory[] = [];
  const featureLinks = $('a[href*="feature_handles"]');

  if (featureLinks.length === 0) return categories;

  // Group features by their category URL base
  const featuresByCategory = new Map<
    string,
    { title: string; url: string; features: AppFeature[] }
  >();

  featureLinks.each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href") || "";
    const text = $el.text().trim();

    const handleMatch = href.match(/feature_handles%5B%5D=([^&]+)/);
    if (!handleMatch) return;

    const featureHandle = decodeURIComponent(handleMatch[1]);

    // Category URL is the base without feature params
    const categoryUrl = href.split("?")[0];
    const categorySlugMatch = categoryUrl.match(/\/categories\/([^/]+)/);
    if (!categorySlugMatch) return;

    const categorySlug = categorySlugMatch[1].replace(/\/all$/, "");
    const categoryTitle = categorySlug
      .split("-")
      .pop() || categorySlug;

    if (!featuresByCategory.has(categorySlug)) {
      featuresByCategory.set(categorySlug, {
        title: "",
        url: `https://apps.shopify.com/categories/${categorySlug}`,
        features: [],
      });
    }

    featuresByCategory.get(categorySlug)!.features.push({
      title: text,
      url: href.startsWith("http")
        ? href
        : `https://apps.shopify.com${href}`,
      feature_handle: featureHandle,
    });
  });

  // Find category titles from page links
  $('a[href*="/categories/"]').each((_, el) => {
    const $el = $(el);
    if ($el.closest('.megamenu-component, .side-menu-component, [class*="navbar"]').length > 0) return;
    const href = ($el.attr("href") || "").split("?")[0].replace(/\/all$/, "");
    const text = $el.text().trim();
    const slugMatch = href.match(/\/categories\/([^/]+)$/);
    if (!slugMatch) return;

    const entry = featuresByCategory.get(slugMatch[1]);
    if (entry && !entry.title && text.length < 100) {
      entry.title = text;
    }
  });

  // Group features into subcategory groups based on handle prefix
  for (const [, cat] of featuresByCategory) {
    const groups = new Map<string, AppSubcategoryGroup>();

    for (const feature of cat.features) {
      // Handle format: cf.forms.form_types.feedback
      // Group by third segment: form_types, customization, data_management
      const parts = feature.feature_handle.split(".");
      const groupKey = parts.length >= 3 ? parts[2] : "general";
      const groupTitle = groupKey
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      if (!groups.has(groupKey)) {
        groups.set(groupKey, { title: groupTitle, features: [] });
      }
      groups.get(groupKey)!.features.push(feature);
    }

    categories.push({
      title: cat.title || "Unknown",
      url: cat.url,
      subcategories: [...groups.values()],
    });
  }

  return categories;
}

function parsePricingTiers($: cheerio.CheerioAPI): PricingTier[] {
  const tiers: PricingTier[] = [];

  $(".app-details-pricing-plan-card").each((_, el) => {
    const $card = $(el);
    const text = $card.text().replace(/\s+/g, " ").trim();

    // Extract plan name (first meaningful text)
    const name = extractPlanName(text);

    // Extract price
    const priceMatch = text.match(/\$([\d.]+)\s*\/\s*(month|year)/);
    const price = priceMatch ? priceMatch[1] : null;
    const period = priceMatch ? priceMatch[2] : null;

    // Extract yearly price
    const yearlyMatch = text.match(/\$([\d.]+)\s*\/\s*year/);
    const yearlyPrice = yearlyMatch ? yearlyMatch[1] : null;

    // Extract discount
    const discountMatch = text.match(/save\s+(\d+%)/i);
    const discountText = discountMatch ? `save ${discountMatch[1]}` : null;

    // Extract trial
    const trialMatch = text.match(/(\d+-day free trial)/i);
    const trialText = trialMatch ? trialMatch[1] : null;

    // Extract features (bullet points / list items)
    const features: string[] = [];
    $card.find("li").each((_, li) => {
      const featureText = $(li).text().trim();
      if (featureText && featureText.length < 200) {
        features.push(featureText);
      }
    });

    // If no <li> found, try splitting text by known boundaries
    if (features.length === 0) {
      const featureText = text
        .replace(/^.*?(Free|All\s)/, "$1")
        .split(/\s{2,}/);
      featureText.forEach((f) => {
        const cleaned = f.trim();
        if (
          cleaned.length > 3 &&
          cleaned.length < 200 &&
          !cleaned.includes("$") &&
          !cleaned.includes("month") &&
          !cleaned.startsWith("Starter") &&
          !cleaned.startsWith("Pro") &&
          !cleaned.startsWith("Free,")
        ) {
          features.push(cleaned);
        }
      });
    }

    tiers.push({
      name,
      price,
      period,
      yearly_price: yearlyPrice,
      discount_text: discountText,
      trial_text: trialText,
      features,
    });
  });

  return tiers;
}

function extractPlanName(text: string): string {
  // Common plan names at the start
  const patterns = [
    /^(Free|Basic|Starter|Standard|Pro|Professional|Premium|Enterprise|Business|Advanced|Plus|Unlimited)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  // Take first word
  const firstWord = text.split(/[\s,]/)[0];
  return firstWord.length < 30 ? firstWord : "Plan";
}
