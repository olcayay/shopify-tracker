/**
 * PLA-1066: when a scrape_runs row is created for a job that already has a
 * `running` row with the same (queue, jobId), return that row's id so the
 * new row can record it as `parent_run_id`. Returns null on first attempts.
 *
 * Helper is best-effort — never throws — so insertion paths can call it
 * inline without try/catch noise.
 */
import { and, desc, eq } from "drizzle-orm";
import { scrapeRuns } from "@appranks/db";
import type { Database } from "@appranks/db";

export async function resolveParentRunId(
  db: Database,
  queue: string | null | undefined,
  jobId: string | null | undefined,
): Promise<string | null> {
  if (!jobId || !queue) return null;
  try {
    const [row] = await db
      .select({ id: scrapeRuns.id })
      .from(scrapeRuns)
      .where(
        and(
          eq(scrapeRuns.jobId, jobId),
          eq(scrapeRuns.queue, queue),
          eq(scrapeRuns.status, "running"),
        ),
      )
      .orderBy(desc(scrapeRuns.startedAt))
      .limit(1);
    return row?.id ?? null;
  } catch {
    return null;
  }
}
