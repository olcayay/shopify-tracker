export const MIN_WORD_FREQUENCY = 2;

export const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "for", "to", "in", "on", "of",
  "by", "with", "is", "it", "at", "as", "from", "be", "not", "no",
  "but", "if", "so", "up", "out", "my", "your", "app", "apps",
]);

export interface WordGroup {
  word: string;
  count: number;
}

/**
 * Extract word frequencies from keyword strings.
 * Returns groups sorted by frequency descending, then alphabetically.
 */
export function extractWordGroups(keywords: string[]): WordGroup[] {
  const freq = new Map<string, number>();

  for (const kw of keywords) {
    const words = new Set(
      kw.toLowerCase().split(/\s+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    );
    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }
  }

  return Array.from(freq.entries())
    .filter(([, count]) => count >= MIN_WORD_FREQUENCY)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

/**
 * Filter keywords to only those containing a specific word (whole-word match).
 */
export function filterKeywordsByWord<T extends { keyword: string }>(
  keywords: T[],
  word: string
): T[] {
  const lower = word.toLowerCase();
  return keywords.filter((kw) =>
    kw.keyword.toLowerCase().split(/\s+/).includes(lower)
  );
}
