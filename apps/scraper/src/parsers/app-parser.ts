import * as cheerio from "cheerio";
import {
  createLogger,
  type AppDetails,
  type AppDeveloper,
  type AppCategory,
  type AppSubcategoryGroup,
  type AppFeature,
  type PricingPlan,
  type AppSupport,
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

  const appIntroduction = safeParse("appIntroduction", () => parseAppIntroduction($), "");
  const appDetails = safeParse("appDetails", () => parseAppDetails($), "");
  const seoTitle = safeParse("seoTitle", () => parseSeoTitle($), "");
  const seoMetaDescription = safeParse("seoMetaDescription", () => parseSeoMetaDescription($), "");
  const features = safeParse("features", () => parseFeatures($), []);
  const pricing = safeParse("pricing", () => parsePricingSummary($), "");
  const developer = safeParse("developer", () => parseDeveloper($), { name: "", url: "" });
  const demoStoreUrl = safeParse("demoStoreUrl", () => parseDemoStoreUrl($), null);
  const languages = safeParse("languages", () => parseLanguages($), []);
  const integrations = safeParse("integrations", () => parseIntegrations($), []);
  const categories = safeParse("categories", () => parseCategories($), []);
  const pricingPlans = safeParse("pricingPlans", () => parsePricingPlans($), []);
  const launchedDate = safeParse("launchedDate", () => parseLaunchedDate($), null);
  const support = safeParse("support", () => parseSupport($), null);

  return {
    app_slug: slug,
    app_name: appName,
    icon_url: jsonLd?.image ?? null,
    app_introduction: appIntroduction,
    app_details: appDetails,
    seo_title: seoTitle,
    seo_meta_description: seoMetaDescription,
    features,
    pricing,
    average_rating: jsonLd?.ratingValue ?? null,
    rating_count: jsonLd?.ratingCount ?? null,
    developer,
    launched_date: launchedDate,
    demo_store_url: demoStoreUrl,
    languages,
    integrations,
    categories,
    pricing_plans: pricingPlans,
    support,
  };
}

// --- JSON-LD ---

interface JsonLdData {
  name: string;
  ratingValue: number | null;
  ratingCount: number | null;
  image: string | null;
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
          image: data.image || null,
        };
      }
    } catch {}
  });

  return result;
}

// --- Parsers ---

function parseAppIntroduction($: cheerio.CheerioAPI): string {
  // The app introduction (short tagline) is the h2 inside #app-details
  const detailsSection = $("#app-details");
  if (detailsSection.length) {
    const h2 = detailsSection.find("h2").first();
    if (h2.length) {
      const text = h2.text().trim();
      if (text.length > 5 && text.length < 500) return text;
    }
  }

  // Fallback: h2 after "Featured images gallery" (old logic)
  const h2s = $("h2");
  let found = false;
  let title = "";

  h2s.each((_, el) => {
    const text = $(el).text().trim();
    if (found && !title && text.length > 5 && text.length < 300) {
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

function parseAppDetails($: cheerio.CheerioAPI): string {
  // The app details body text is inside #app-details — a <p> with lg:tw-block (desktop version)
  const detailsSection = $("#app-details");
  if (detailsSection.length) {
    // Desktop paragraph (hidden on mobile, shown on lg+)
    const desktopP = detailsSection.find("p.lg\\:tw-block").first();
    if (desktopP.length) {
      const text = desktopP.text().trim();
      if (text.length > 10) return text;
    }

    // Fallback: truncated content (mobile version)
    const truncated = detailsSection.find("[data-truncate-content-copy]").first();
    if (truncated.length) {
      const text = truncated.text().trim();
      if (text.length > 10) return text;
    }
  }

  return "";
}

function parseSeoTitle($: cheerio.CheerioAPI): string {
  return $("title").text().trim();
}

function parseSeoMetaDescription($: cheerio.CheerioAPI): string {
  const metaDesc = $('meta[name="description"]').attr("content")?.trim();
  return metaDesc || "";
}

function parseFeatures($: cheerio.CheerioAPI): string[] {
  // The 5 feature bullet points are in a <ul class="tw-list-disc"> inside #app-details
  const features: string[] = [];

  const detailsSection = $("#app-details");
  if (detailsSection.length) {
    detailsSection.find("ul.tw-list-disc li").each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 5 && text.length < 500) {
        features.push(text);
      }
    });
  }

  return features;
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

function parseIntegrations($: cheerio.CheerioAPI): string[] {
  const bodyText = $.text();
  const match = bodyText.match(/Works with\s+([\s\S]*?)(?:Categories|Built for|$)/);
  if (!match) return [];

  const text = match[1].trim();
  return text
    .split(/[,\n]/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && w.length < 100);
}

function parseSupport($: cheerio.CheerioAPI): AppSupport | null {
  // Support email is in data attribute on #adp-developer section
  const devSection = $("section#adp-developer");
  const email = devSection.attr("data-developer-support-email") || null;

  // Look for support portal URL in the developer section
  let portalUrl: string | null = null;
  devSection.find("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim().toLowerCase();
    if (
      text.includes("support") ||
      text.includes("help") ||
      text.includes("contact")
    ) {
      if (href.startsWith("http") && !href.includes("shopify.com")) {
        portalUrl = href;
      }
    }
  });

  // No support info found
  if (!email && !portalUrl) return null;

  return {
    email,
    portal_url: portalUrl,
    phone: null, // Phone rarely appears on public listing pages
  };
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
  let catIndex = 0;
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
      type: catIndex === 0 ? "primary" : "secondary",
      title: cat.title || "Unknown",
      url: cat.url,
      subcategories: [...groups.values()],
    });
    catIndex++;
  }

  return categories;
}

function parseLaunchedDate($: cheerio.CheerioAPI): Date | null {
  let launched: Date | null = null;
  $("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text === "Launched") {
      const $next = $(el).next("p");
      if ($next.length) {
        // Get only direct text content (first text node), not child elements like Changelog links
        const raw = $next.contents().first().text().trim().replace(/[·•].*$/, "").trim();
        if (raw) {
          const parsed = new Date(raw);
          if (!isNaN(parsed.getTime())) {
            launched = parsed;
          }
        }
      }
    }
  });
  return launched;
}

function parsePricingPlans($: cheerio.CheerioAPI): PricingPlan[] {
  const plans: PricingPlan[] = [];

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

    plans.push({
      name,
      price,
      period,
      yearly_price: yearlyPrice,
      discount_text: discountText,
      trial_text: trialText,
      features,
    });
  });

  return plans;
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
