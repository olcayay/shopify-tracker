/** Shared similarity utilities for computing app-to-app similarity scores */

export interface AppSimilarityData {
  categorySlugs: Set<string>;
  featureHandles: Set<string>;
  keywordIds: Set<string>;
  textTokens: Set<string>;
}

export interface SimilarityResult {
  overall: number;
  category: number;
  feature: number;
  keyword: number;
  text: number;
}

/** Weights for each similarity component (must sum to 1) */
export const SIMILARITY_WEIGHTS = {
  category: 0.25,
  feature: 0.25,
  keyword: 0.25,
  text: 0.25,
} as const;

type SimilarityWeights = { category: number; feature: number; keyword: number; text: number };

const PLATFORM_SIMILARITY_WEIGHTS: Record<string, SimilarityWeights> = {
  shopify: { category: 0.25, feature: 0.25, keyword: 0.25, text: 0.25 },
  salesforce: { category: 0.35, feature: 0.0, keyword: 0.30, text: 0.35 },
  canva: { category: 0.50, feature: 0.0, keyword: 0.0, text: 0.50 },
  wix: { category: 0.35, feature: 0.0, keyword: 0.30, text: 0.35 },
  wordpress: { category: 0.35, feature: 0.0, keyword: 0.30, text: 0.35 },
  google_workspace: { category: 0.35, feature: 0.0, keyword: 0.30, text: 0.35 },
  atlassian: { category: 0.35, feature: 0.0, keyword: 0.30, text: 0.35 },
  zoom: { category: 0.35, feature: 0.0, keyword: 0.30, text: 0.35 },
  zoho: { category: 0.35, feature: 0.0, keyword: 0.30, text: 0.35 },
  zendesk: { category: 0.35, feature: 0.0, keyword: 0.30, text: 0.35 },
  hubspot: { category: 0.35, feature: 0.0, keyword: 0.30, text: 0.35 },
};

/** Get similarity weights for a given platform (defaults to Shopify weights) */
export function getSimilarityWeights(platform?: string): SimilarityWeights {
  if (platform && PLATFORM_SIMILARITY_WEIGHTS[platform]) {
    return PLATFORM_SIMILARITY_WEIGHTS[platform];
  }
  return { ...SIMILARITY_WEIGHTS };
}

/** Common stop words used for similarity text tokenization */
export const COMMON_SIMILARITY_STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "am", "was", "were", "be", "been", "being",
  "in", "on", "at", "to", "for", "of", "and", "or", "but", "not", "with",
  "by", "from", "as", "it", "its", "this", "that", "these", "those",
  "i", "you", "he", "she", "we", "they", "my", "your", "our", "his", "her", "their",
  "me", "us", "him", "them", "do", "does", "did", "have", "has", "had",
  "will", "would", "can", "could", "shall", "should", "may", "might", "must",
  "so", "if", "then", "than", "no", "all", "any", "each", "every", "some",
  "such", "very", "just", "about", "up", "out", "how", "what", "which", "who",
  "when", "where", "also", "more", "other", "into", "over", "after", "before",
  // Generic marketplace terms
  "app", "apps", "your", "our",
]);

/** Platform-specific stop words for similarity */
const SHOPIFY_SIMILARITY_STOP_WORDS = new Set(["shopify", "store", "stores", "shop", "shops"]);
const SALESFORCE_SIMILARITY_STOP_WORDS = new Set(["salesforce", "appexchange", "crm", "lightning"]);
const CANVA_SIMILARITY_STOP_WORDS = new Set(["canva", "design", "template", "templates"]);
const WIX_SIMILARITY_STOP_WORDS = new Set(["wix", "website", "site", "sites", "web"]);
const WORDPRESS_SIMILARITY_STOP_WORDS = new Set(["wordpress", "wp", "plugin", "plugins", "widget"]);
const GOOGLE_WORKSPACE_SIMILARITY_STOP_WORDS = new Set(["google", "workspace", "marketplace", "sheets", "docs", "drive", "gmail", "addon", "add-on"]);
const ATLASSIAN_SIMILARITY_STOP_WORDS = new Set(["atlassian", "jira", "confluence", "bitbucket", "marketplace", "plugin", "addon", "app", "cloud", "server", "datacenter"]);
const ZOOM_SIMILARITY_STOP_WORDS = new Set(["zoom", "meeting", "meetings", "webinar", "video", "marketplace", "app", "apps", "cloud"]);
const ZOHO_SIMILARITY_STOP_WORDS = new Set(["zoho", "marketplace", "extension", "integration", "app", "apps", "crm", "desk", "books", "projects"]);
const ZENDESK_SIMILARITY_STOP_WORDS = new Set(["zendesk", "support", "ticket", "tickets", "agent", "agents", "customer", "customers", "marketplace", "app", "apps", "helpdesk"]);
const HUBSPOT_SIMILARITY_STOP_WORDS = new Set(["hubspot", "crm", "marketing", "sales", "service", "integration", "connector", "marketplace", "app", "apps", "hub"]);

const PLATFORM_SIMILARITY_STOP_WORDS: Record<string, Set<string>> = {
  shopify: SHOPIFY_SIMILARITY_STOP_WORDS,
  salesforce: SALESFORCE_SIMILARITY_STOP_WORDS,
  canva: CANVA_SIMILARITY_STOP_WORDS,
  wix: WIX_SIMILARITY_STOP_WORDS,
  wordpress: WORDPRESS_SIMILARITY_STOP_WORDS,
  google_workspace: GOOGLE_WORKSPACE_SIMILARITY_STOP_WORDS,
  atlassian: ATLASSIAN_SIMILARITY_STOP_WORDS,
  zoom: ZOOM_SIMILARITY_STOP_WORDS,
  zoho: ZOHO_SIMILARITY_STOP_WORDS,
  zendesk: ZENDESK_SIMILARITY_STOP_WORDS,
  hubspot: HUBSPOT_SIMILARITY_STOP_WORDS,
};

/** Get merged similarity stop words for a given platform */
export function getSimilarityStopWords(platform?: string): Set<string> {
  const merged = new Set(COMMON_SIMILARITY_STOP_WORDS);
  const platformSet = platform ? PLATFORM_SIMILARITY_STOP_WORDS[platform] : undefined;
  if (platformSet) {
    for (const w of platformSet) merged.add(w);
  }
  return merged;
}

/** @deprecated Use getSimilarityStopWords('shopify') instead. Kept for backward compatibility. */
export const STOP_WORDS = getSimilarityStopWords("shopify");

/** Jaccard index: |A ∩ B| / |A ∪ B| */
export function jaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const item of smaller) {
    if (larger.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Tokenize text into a set of normalized words */
export function tokenize(text: string, stopWords?: Set<string>): Set<string> {
  const sw = stopWords ?? STOP_WORDS;
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !sw.has(w))
  );
}

/** Extract category slugs from snapshot categories JSONB */
export function extractCategorySlugs(categories: any[], platform?: string): Set<string> {
  const slugs = new Set<string>();
  for (const c of categories) {
    if (platform && platform !== "shopify") {
      // Non-Shopify: use slug directly if available, fall back to url
      const slug = c.slug ?? c.url;
      if (slug) slugs.add(slug);
    } else {
      // Shopify: parse slug from URL
      if (c.url) {
        const slug = c.url.replace(/.*\/categories\//, "").replace(/\/.*/, "");
        if (slug) slugs.add(slug);
      }
    }
  }
  return slugs;
}

/** Extract feature_handle values from snapshot categories JSONB */
export function extractFeatureHandles(categories: any[], platform?: string): Set<string> {
  // Non-Shopify platforms don't have feature taxonomy
  if (platform && platform !== "shopify") {
    return new Set<string>();
  }
  const handles = new Set<string>();
  for (const c of categories) {
    for (const sub of c.subcategories ?? []) {
      for (const f of sub.features ?? []) {
        if (f.feature_handle) handles.add(f.feature_handle);
      }
    }
  }
  return handles;
}

/**
 * Extract category/tag slugs from platform_data JSONB.
 * For non-Shopify platforms, tags/categories are stored in platform_data
 * rather than in the snapshot categories array.
 */
export function extractCategorySlugsFromPlatformData(
  platformData: Record<string, unknown>,
  platform: string
): Set<string> {
  switch (platform) {
    case "wordpress": {
      const tags = platformData.tags as Record<string, string> | undefined;
      if (!tags || typeof tags !== "object") return new Set();
      return new Set(Object.keys(tags));
    }
    case "wix": {
      const cats = platformData.categories as Array<{ slug?: string }> | undefined;
      if (!Array.isArray(cats)) return new Set();
      return new Set(cats.map((c) => c.slug).filter((s): s is string => !!s));
    }
    case "canva": {
      const topics = platformData.topics as string[] | undefined;
      if (!Array.isArray(topics)) return new Set();
      return new Set(
        topics
          .filter((t) => t.startsWith("marketplace_topic."))
          .map((t) => t.replace("marketplace_topic.", "").replace(/_/g, "-"))
      );
    }
    case "salesforce": {
      const cats = platformData.listingCategories as string[] | undefined;
      return new Set(cats || []);
    }
    case "google_workspace": {
      const cat = platformData.category as string | undefined;
      if (!cat) return new Set();
      return new Set([cat]);
    }
    case "atlassian": {
      const cats = platformData.categories as Array<{ slug?: string; key?: string }> | undefined;
      if (!Array.isArray(cats)) return new Set();
      return new Set(cats.map((c) => c.slug || c.key).filter((s): s is string => !!s));
    }
    case "zoom": {
      const cats = platformData.categories as Array<{ slug?: string }> | undefined;
      if (!Array.isArray(cats)) return new Set();
      return new Set(cats.map((c) => c.slug).filter((s): s is string => !!s));
    }
    case "zoho": {
      const cats = platformData.categories as Array<{ slug?: string }> | undefined;
      if (!Array.isArray(cats)) return new Set();
      return new Set(cats.map((c) => c.slug).filter((s): s is string => !!s));
    }
    case "zendesk": {
      const cats = platformData.categories as Array<{ slug?: string }> | undefined;
      if (!Array.isArray(cats)) return new Set();
      return new Set(cats.map((c) => c.slug).filter((s): s is string => !!s));
    }
    case "hubspot": {
      const cats = platformData.categories as Array<{ slug?: string }> | undefined;
      if (!Array.isArray(cats)) return new Set();
      return new Set(cats.map((c) => c.slug).filter((s): s is string => !!s));
    }
    default:
      return new Set();
  }
}

/** Compute similarity between two apps given their pre-processed data */
export function computeSimilarityBetween(
  appA: AppSimilarityData,
  appB: AppSimilarityData,
  platform?: string
): SimilarityResult {
  const weights = getSimilarityWeights(platform);

  const category = jaccard(appA.categorySlugs, appB.categorySlugs);
  const feature = jaccard(appA.featureHandles, appB.featureHandles);
  const keyword = jaccard(appA.keywordIds, appB.keywordIds);
  const text = jaccard(appA.textTokens, appB.textTokens);

  const overall =
    weights.category * category +
    weights.feature * feature +
    weights.keyword * keyword +
    weights.text * text;

  return { overall, category, feature, keyword, text };
}
