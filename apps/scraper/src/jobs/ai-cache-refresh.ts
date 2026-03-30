/**
 * AI suggestion cache refresh & cleanup job (PLA-456).
 *
 * - Deletes expired cache entries (expiresAt < now)
 * - Cleans up stale "generating" entries (stuck > 30 minutes)
 * - Logs cleanup stats
 */
import { sql, lt, and, eq } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { aiKeywordSuggestions, aiCompetitorSuggestions } from "@appranks/db";
import { createLogger } from "@appranks/shared";

const log = createLogger("ai-cache-refresh");

const STALE_GENERATING_MINUTES = 30;

export interface AiCacheCleanupResult {
  expiredKeywords: number;
  expiredCompetitors: number;
  staleKeywords: number;
  staleCompetitors: number;
}

export async function cleanupAiSuggestionCache(db: Database): Promise<AiCacheCleanupResult> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_GENERATING_MINUTES * 60 * 1000);

  // Delete expired keyword suggestions
  const expiredKw = await db
    .delete(aiKeywordSuggestions)
    .where(and(
      lt(aiKeywordSuggestions.expiresAt, now),
      eq(aiKeywordSuggestions.status, "success")
    ))
    .returning({ id: aiKeywordSuggestions.id });

  // Delete expired competitor suggestions
  const expiredComp = await db
    .delete(aiCompetitorSuggestions)
    .where(and(
      lt(aiCompetitorSuggestions.expiresAt, now),
      eq(aiCompetitorSuggestions.status, "success")
    ))
    .returning({ id: aiCompetitorSuggestions.id });

  // Clean up stale "generating" entries (stuck jobs)
  const staleKw = await db
    .update(aiKeywordSuggestions)
    .set({ status: "failed", errorMessage: "Generation timed out" })
    .where(and(
      eq(aiKeywordSuggestions.status, "generating"),
      lt(aiKeywordSuggestions.createdAt, staleThreshold)
    ))
    .returning({ id: aiKeywordSuggestions.id });

  const staleComp = await db
    .update(aiCompetitorSuggestions)
    .set({ status: "failed", errorMessage: "Generation timed out" })
    .where(and(
      eq(aiCompetitorSuggestions.status, "generating"),
      lt(aiCompetitorSuggestions.createdAt, staleThreshold)
    ))
    .returning({ id: aiCompetitorSuggestions.id });

  const result: AiCacheCleanupResult = {
    expiredKeywords: expiredKw.length,
    expiredCompetitors: expiredComp.length,
    staleKeywords: staleKw.length,
    staleCompetitors: staleComp.length,
  };

  log.info(`AI cache cleanup: ${result.expiredKeywords + result.expiredCompetitors} expired, ${result.staleKeywords + result.staleCompetitors} stale`, result as any);
  return result;
}
