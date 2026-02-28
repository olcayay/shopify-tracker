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

export const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "am", "was", "were", "be", "been", "being",
  "in", "on", "at", "to", "for", "of", "and", "or", "but", "not", "with",
  "by", "from", "as", "it", "its", "this", "that", "these", "those",
  "i", "you", "he", "she", "we", "they", "my", "your", "our", "his", "her", "their",
  "me", "us", "him", "them", "do", "does", "did", "have", "has", "had",
  "will", "would", "can", "could", "shall", "should", "may", "might", "must",
  "so", "if", "then", "than", "no", "all", "any", "each", "every", "some",
  "such", "very", "just", "about", "up", "out", "how", "what", "which", "who",
  "when", "where", "also", "more", "other", "into", "over", "after", "before",
  // Shopify-specific stop words
  "app", "apps", "shopify", "store", "stores", "shop", "shops", "your", "our",
]);

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
export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  );
}

/** Extract category slugs from snapshot categories JSONB */
export function extractCategorySlugs(categories: any[]): Set<string> {
  const slugs = new Set<string>();
  for (const c of categories) {
    if (c.url) {
      const slug = c.url.replace(/.*\/categories\//, "").replace(/\/.*/, "");
      if (slug) slugs.add(slug);
    }
  }
  return slugs;
}

/** Extract feature_handle values from snapshot categories JSONB */
export function extractFeatureHandles(categories: any[]): Set<string> {
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
  appB: AppSimilarityData
): SimilarityResult {
  const category = jaccard(appA.categorySlugs, appB.categorySlugs);
  const feature = jaccard(appA.featureHandles, appB.featureHandles);
  const keyword = jaccard(appA.keywordIds, appB.keywordIds);
  const text = jaccard(appA.textTokens, appB.textTokens);

  const overall =
    SIMILARITY_WEIGHTS.category * category +
    SIMILARITY_WEIGHTS.feature * feature +
    SIMILARITY_WEIGHTS.keyword * keyword +
    SIMILARITY_WEIGHTS.text * text;

  return { overall, category, feature, keyword, text };
}
