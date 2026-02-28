import type { AppCategory } from "./types/app.js";

// --- Stop Words ---

export const KEYWORD_STOP_WORDS = new Set([
  // Common English
  "the", "a", "an", "is", "are", "am", "was", "were", "be", "been", "being",
  "in", "on", "at", "to", "for", "of", "and", "or", "but", "not", "with",
  "by", "from", "as", "it", "its", "this", "that", "these", "those",
  "i", "you", "he", "she", "we", "they", "my", "your", "our", "his", "her", "their",
  "me", "us", "him", "them", "do", "does", "did", "have", "has", "had",
  "will", "would", "can", "could", "shall", "should", "may", "might", "must",
  "so", "if", "then", "than", "no", "all", "any", "each", "every", "some",
  "such", "very", "just", "about", "up", "out", "how", "what", "which", "who",
  "when", "where", "also", "more", "other", "into", "over", "after", "before",
  // Shopify-specific
  "app", "apps", "shopify", "store", "stores", "shop", "shops",
  "online", "plugin", "plugins", "tool", "tools", "solution", "solutions",
  "feature", "features", "powerful", "easy", "easily", "best", "free",
  "new", "help", "helps", "get", "gets", "use", "using", "used",
  "make", "makes", "made", "one", "way", "like", "need", "needs",
  "based", "built", "create", "increase", "improve", "manage",
  "right", "top", "first", "most", "great", "good",
]);

// --- Field Weights ---

export const FIELD_WEIGHTS = {
  name: 10.0,
  subtitle: 5.0,
  introduction: 4.0,
  categories: 3.0,
  features: 2.0,
  description: 2.0,
  categoryFeatures: 2.0,
} as const;

// --- Types ---

export interface AppMetadataInput {
  name: string;
  subtitle: string | null;
  introduction: string | null;
  description: string | null;
  features: string[];
  categories: AppCategory[];
}

export interface KeywordSource {
  field: keyof typeof FIELD_WEIGHTS;
  weight: number;
}

export interface ScoredKeyword {
  keyword: string;
  score: number;
  count: number;
  sources: KeywordSource[];
}

// --- N-gram Generation ---

function cleanText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

function isStopWord(word: string): boolean {
  return KEYWORD_STOP_WORDS.has(word);
}

export function generateNgrams(text: string, maxN: number = 3): string[] {
  const words = cleanText(text);
  const candidates: string[] = [];

  // Unigrams (4+ chars, not stop word)
  for (const w of words) {
    if (w.length >= 4 && !isStopWord(w)) {
      candidates.push(w);
    }
  }

  // Bigrams (at least one non-stop word)
  for (let i = 0; i < words.length - 1; i++) {
    if (!isStopWord(words[i]) || !isStopWord(words[i + 1])) {
      candidates.push(`${words[i]} ${words[i + 1]}`);
    }
  }

  // Trigrams (at least two non-stop words)
  if (maxN >= 3) {
    for (let i = 0; i < words.length - 2; i++) {
      const nonStop = [words[i], words[i + 1], words[i + 2]].filter(
        (w) => !isStopWord(w)
      ).length;
      if (nonStop >= 2) {
        candidates.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
    }
  }

  return candidates;
}

// --- Main Algorithm ---

// Word count multiplier: more words = higher value as a keyword
// 1 word = 1x, 2 words = 1.5x, 3+ words = 2x
function wordCountMultiplier(keyword: string): number {
  const wordCount = keyword.split(/\s+/).length;
  if (wordCount >= 3) return 3;
  if (wordCount === 2) return 2;
  return 1;
}

function addCandidates(
  map: Map<string, ScoredKeyword>,
  candidates: string[],
  field: keyof typeof FIELD_WEIGHTS
): void {
  const baseWeight = FIELD_WEIGHTS[field];
  const seen = new Set<string>();
  for (const raw of candidates) {
    const keyword = raw.trim().toLowerCase();
    if (keyword.length < 3) continue;
    // Deduplicate within same field
    if (seen.has(keyword)) continue;
    seen.add(keyword);

    const weight = baseWeight * wordCountMultiplier(keyword);
    const existing = map.get(keyword);
    if (existing) {
      existing.score += weight;
      existing.count += 1;
      existing.sources.push({ field, weight });
    } else {
      map.set(keyword, {
        keyword,
        score: weight,
        count: 1,
        sources: [{ field, weight }],
      });
    }
  }
}

function extractCategoryTitles(categories: AppCategory[]): string[] {
  const titles: string[] = [];
  for (const c of categories) {
    if (c.title) titles.push(c.title);
    for (const sub of c.subcategories ?? []) {
      if (sub.title) titles.push(sub.title);
    }
  }
  return titles;
}

function extractCategoryFeatureTitles(categories: AppCategory[]): string[] {
  const titles: string[] = [];
  for (const c of categories) {
    for (const sub of c.subcategories ?? []) {
      for (const f of sub.features ?? []) {
        if (f.title) titles.push(f.title);
      }
    }
  }
  return titles;
}

export function extractKeywordsFromAppMetadata(
  data: AppMetadataInput
): ScoredKeyword[] {
  const map = new Map<string, ScoredKeyword>();

  // 1. App name — full name + ngrams
  if (data.name) {
    const nameCleaned = data.name
      .replace(/[|:&\-–—]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // Add the full cleaned name as a candidate (minus stop words only)
    const nameWords = cleanText(nameCleaned).filter((w) => !isStopWord(w));
    if (nameWords.length > 1) {
      addCandidates(map, [nameWords.join(" ")], "name");
    }
    addCandidates(map, generateNgrams(nameCleaned), "name");
  }

  // 2. Subtitle — ngrams
  if (data.subtitle) {
    addCandidates(map, generateNgrams(data.subtitle), "subtitle");
  }

  // 3. Introduction — ngrams
  if (data.introduction) {
    addCandidates(map, generateNgrams(data.introduction), "introduction");
  }

  // 4. Categories — use titles directly + ngrams
  if (data.categories.length > 0) {
    const catTitles = extractCategoryTitles(data.categories);
    // Direct titles (already keyword-like)
    addCandidates(map, catTitles, "categories");
    // Also generate ngrams from titles
    for (const title of catTitles) {
      addCandidates(map, generateNgrams(title), "categories");
    }
  }

  // 5. Description — ngrams (cap at 500 words to limit noise)
  if (data.description) {
    const descWords = data.description.split(/\s+/).slice(0, 500).join(" ");
    addCandidates(map, generateNgrams(descWords), "description");
  }

  // 6. Features — use directly + ngrams from longer ones
  if (data.features.length > 0) {
    addCandidates(map, data.features, "features");
    for (const feat of data.features) {
      addCandidates(map, generateNgrams(feat), "features");
    }
  }

  // 7. Category features — use titles directly + ngrams
  if (data.categories.length > 0) {
    const featureTitles = extractCategoryFeatureTitles(data.categories);
    addCandidates(map, featureTitles, "categoryFeatures");
    for (const title of featureTitles) {
      addCandidates(map, generateNgrams(title), "categoryFeatures");
    }
  }

  // Filter: primary field presence, min 2 fields, max 3 words
  const PRIMARY_FIELDS = new Set(["name", "subtitle", "introduction", "description"]);
  const filtered = Array.from(map.values()).filter(
    (kw) =>
      kw.sources.some((s) => PRIMARY_FIELDS.has(s.field)) &&
      kw.count >= 2 &&
      kw.keyword.split(/\s+/).length <= 3
  );

  // Sort by score descending, then alphabetically
  return filtered.sort(
    (a, b) => b.score - a.score || a.keyword.localeCompare(b.keyword)
  );
}
