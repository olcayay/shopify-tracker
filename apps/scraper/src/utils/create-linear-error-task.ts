import { eq, and, isNull } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { scrapeRuns, scrapeItemErrors } from "@appranks/db";
import { createLogger, getPlatform, type PlatformId } from "@appranks/shared";
import { ensureScrapingErrorLabel, createLinearIssue } from "./linear-client.js";

const log = createLogger("linear-error-task");

/** Human-readable scraper type labels */
const SCRAPER_TYPE_LABELS: Record<string, string> = {
  category: "Category",
  app_details: "App Details",
  keyword_search: "Keyword Search",
  keyword_suggestions: "Keyword Suggestions",
  reviews: "Reviews",
  featured_apps: "Featured Apps",
};

/**
 * After a scrape job finishes, check for item errors and create a Linear task if any exist.
 * This is fire-and-forget — errors here never affect scraping.
 */
export async function createLinearErrorTask(
  db: Database,
  jobId: string | undefined,
  platform: PlatformId,
  scraperType: string
): Promise<void> {
  if (!jobId) return;
  if (!process.env.LINEAR_API_KEY) return;

  try {
    // Find all runs for this job
    const runs = await db
      .select({ id: scrapeRuns.id, status: scrapeRuns.status })
      .from(scrapeRuns)
      .where(eq(scrapeRuns.jobId, jobId));

    if (runs.length === 0) return;

    const runIds = runs.map((r) => r.id);

    // Fetch all item errors for these runs that don't already have a Linear issue
    const allErrors: Array<{
      id: string;
      scrapeRunId: string;
      itemIdentifier: string;
      itemType: string;
      url: string | null;
      errorMessage: string;
    }> = [];

    for (const runId of runIds) {
      const errors = await db
        .select({
          id: scrapeItemErrors.id,
          scrapeRunId: scrapeItemErrors.scrapeRunId,
          itemIdentifier: scrapeItemErrors.itemIdentifier,
          itemType: scrapeItemErrors.itemType,
          url: scrapeItemErrors.url,
          errorMessage: scrapeItemErrors.errorMessage,
        })
        .from(scrapeItemErrors)
        .where(
          and(
            eq(scrapeItemErrors.scrapeRunId, runId),
            isNull(scrapeItemErrors.linearIssueId)
          )
        );
      allErrors.push(...errors);
    }

    if (allErrors.length === 0) return;

    // Ensure the scraping-error label exists
    const labelId = await ensureScrapingErrorLabel();
    if (!labelId) {
      log.warn("could not get scraping-error label, skipping task creation");
      return;
    }

    // Group errors by message pattern (first 100 chars)
    const groups = new Map<string, typeof allErrors>();
    for (const err of allErrors) {
      const key = err.errorMessage.slice(0, 100);
      const group = groups.get(key) || [];
      group.push(err);
      groups.set(key, group);
    }

    // Determine priority
    const totalErrors = allErrors.length;
    const jobFailed = runs.some((r) => r.status === "failed");
    let priority: number;
    if (totalErrors >= 50 || jobFailed) priority = 1; // Urgent
    else if (totalErrors >= 10) priority = 2; // High
    else if (totalErrors >= 3) priority = 3; // Medium
    else priority = 4; // Low

    // Build title
    const platformName = getPlatform(platform).name.split(" ")[0]; // "Shopify", "Salesforce", etc.
    const scraperLabel = SCRAPER_TYPE_LABELS[scraperType] || scraperType;
    const title = `[${platformName}] ${scraperLabel}: ${totalErrors} item${totalErrors > 1 ? "s" : ""} failed`;

    // Build body
    const lines: string[] = [];
    lines.push(`**Platform:** ${getPlatform(platform).name}`);
    lines.push(`**Scraper:** ${scraperType}`);
    lines.push(`**Run ID(s):** ${runIds.join(", ")}`);
    lines.push(`**Job ID:** ${jobId}`);
    lines.push(`**Timestamp:** ${new Date().toISOString()}`);
    lines.push(`**Total failures:** ${totalErrors}`);
    lines.push("");
    lines.push("## Error Summary");

    for (const [pattern, errors] of groups) {
      lines.push("");
      lines.push(`### \`${pattern}\` (${errors.length} occurrence${errors.length > 1 ? "s" : ""})`);
      lines.push("| Item | Type | URL |");
      lines.push("|------|------|-----|");

      const displayErrors = errors.slice(0, 10);
      for (const err of displayErrors) {
        const urlCell = err.url ? `[link](${err.url})` : "-";
        lines.push(`| ${err.itemIdentifier} | ${err.itemType} | ${urlCell} |`);
      }

      if (errors.length > 10) {
        lines.push(`| ... and ${errors.length - 10} more | | |`);
      }
    }

    const description = lines.join("\n");

    // Create the Linear issue
    const issue = await createLinearIssue({
      title,
      description,
      labelIds: [labelId],
      priority,
    });

    if (!issue) return;

    // Update all error rows with the Linear issue reference
    const errorIds = allErrors.map((e) => e.id);
    for (const errorId of errorIds) {
      await db
        .update(scrapeItemErrors)
        .set({
          linearIssueId: issue.identifier,
          linearIssueUrl: issue.url,
        })
        .where(eq(scrapeItemErrors.id, errorId));
    }

    log.info("linked errors to Linear issue", {
      issueId: issue.identifier,
      errorCount: errorIds.length,
    });
  } catch (err) {
    log.error("failed to create Linear error task", { error: String(err) });
  }
}
