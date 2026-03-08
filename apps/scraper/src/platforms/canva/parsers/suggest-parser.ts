import { createLogger } from "@appranks/shared";

const log = createLogger("canva-suggest-parser");

/**
 * Canva suggest API response shape (from POST /_ajax/appsearch/suggest).
 *
 * Field mapping:
 *   B = suggestions array
 *     B[].A = app ID
 *     B[].B = app name (used as suggestion text)
 */
interface CanvaSuggestResponse {
  B?: { A: string; B: string }[];
}

/**
 * Parse Canva suggest API JSON response into keyword suggestions.
 *
 * The suggest API returns app name suggestions from Canva's search engine.
 *
 * @param json - Raw JSON string from /_ajax/appsearch/suggest
 * @returns Array of suggestion strings (app names)
 */
export function parseCanvaSuggestions(json: string): string[] {
  let data: CanvaSuggestResponse;
  try {
    data = JSON.parse(json);
  } catch (e) {
    log.error("failed to parse suggest response JSON", { error: String(e) });
    return [];
  }

  const suggestions = (data.B || []).map((s) => s.B.toLowerCase());

  log.info("parsed suggestions", { count: suggestions.length });
  return suggestions;
}
