"use client";

import { useMemo } from "react";

export const STOP_WORDS = new Set([
  "the","a","an","is","are","am","was","were","be","been","being",
  "in","on","at","to","for","of","and","or","but","not","with",
  "by","from","as","it","its","this","that","these","those",
  "i","you","he","she","we","they","my","your","our","his","her","their",
  "me","us","him","them","do","does","did","have","has","had",
  "will","would","can","could","shall","should","may","might","must",
  "so","if","then","than","no","all","any","each","every","some",
  "such","very","just","about","up","out","how","what","which","who",
  "when","where","also","more","other","into","over","after","before",
]);

export function useKeywordDensity(text: string) {
  return useMemo(() => {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    const totalWords = words.length;
    if (totalWords === 0) return [];

    const counts = new Map<string, number>();

    // 1-word keywords
    for (const w of words) {
      if (w.length < 2 || STOP_WORDS.has(w)) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
    }

    // 2-word phrases (skip if starts or ends with stop word)
    for (let i = 0; i < words.length - 1; i++) {
      if (STOP_WORDS.has(words[i]) || STOP_WORDS.has(words[i + 1])) continue;
      if (words[i].length < 2 || words[i + 1].length < 2) continue;
      const phrase = `${words[i]} ${words[i + 1]}`;
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }

    // 3-word phrases (skip if starts or ends with stop word)
    for (let i = 0; i < words.length - 2; i++) {
      if (STOP_WORDS.has(words[i]) || STOP_WORDS.has(words[i + 2])) continue;
      if (words[i].length < 2 || words[i + 2].length < 2) continue;
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }

    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 30)
      .map(([keyword, count]) => ({
        keyword,
        count,
        n: keyword.split(" ").length as 1 | 2 | 3,
        density: ((count / totalWords) * 100).toFixed(2),
      }));
  }, [text]);
}

export const N_GRAM_COLORS = {
  1: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  2: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  3: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
} as const;
