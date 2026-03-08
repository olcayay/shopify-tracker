import { createLogger } from "@appranks/shared";
import { extractCanvaApps } from "./app-parser.js";

const log = createLogger("canva-suggest-parser");

/** Common words to exclude from suggestions */
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "your", "this", "that", "from",
  "are", "all", "you", "can", "will", "has", "have", "not", "but",
  "they", "more", "their", "what", "when", "out", "also", "its",
  "our", "how", "get", "use", "new", "one", "just", "make", "any",
  "about", "into", "app", "apps",
]);

/**
 * Generate auto-suggestions for a keyword prefix from Canva embedded app data.
 *
 * No Canva autocomplete API exists, so we build suggestions from:
 * 1. App names (split into multi-word phrases and individual words)
 * 2. Topic tag labels (human-readable versions of marketplace_topic.* tags)
 *
 * Returns top 10 unique suggestions matching the prefix.
 */
export function generateCanvaSuggestions(
  html: string,
  keyword: string,
): string[] {
  const apps = extractCanvaApps(html);
  const lowerKeyword = keyword.toLowerCase().trim();

  if (!lowerKeyword) return [];

  const candidates = new Set<string>();

  for (const app of apps) {
    // Add full app name if it contains the keyword
    const lowerName = app.name.toLowerCase();
    if (lowerName.includes(lowerKeyword)) {
      candidates.add(app.name.toLowerCase());
    }

    // Add individual words from app name
    const nameWords = app.name.toLowerCase().split(/\s+/);
    for (const word of nameWords) {
      if (word.length > 2 && word.startsWith(lowerKeyword) && !STOP_WORDS.has(word)) {
        candidates.add(word);
      }
    }

    // Add topic labels (convert marketplace_topic.ai_audio → "ai audio")
    for (const topic of app.topics) {
      const label = topic
        .replace("marketplace_topic.", "")
        .replace(/_/g, " ");
      if (label.includes(lowerKeyword)) {
        candidates.add(label);
      }
    }
  }

  // Remove the exact keyword itself
  candidates.delete(lowerKeyword);

  // Sort: prefer shorter suggestions and those starting with the keyword
  const sorted = [...candidates].sort((a, b) => {
    const aStarts = a.startsWith(lowerKeyword) ? 0 : 1;
    const bStarts = b.startsWith(lowerKeyword) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.length - b.length;
  });

  const suggestions = sorted.slice(0, 10);

  log.info("generated suggestions", {
    keyword,
    totalCandidates: candidates.size,
    returned: suggestions.length,
  });

  return suggestions;
}
