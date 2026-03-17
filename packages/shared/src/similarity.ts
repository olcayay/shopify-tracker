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

const PLATFORM_SIMILARITY_STOP_WORDS: Record<string, Set<string>> = {
  shopify: SHOPIFY_SIMILARITY_STOP_WORDS,
  salesforce: SALESFORCE_SIMILARITY_STOP_WORDS,
  canva: CANVA_SIMILARITY_STOP_WORDS,
  wix: WIX_SIMILARITY_STOP_WORDS,
  wordpress: WORDPRESS_SIMILARITY_STOP_WORDS,
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
