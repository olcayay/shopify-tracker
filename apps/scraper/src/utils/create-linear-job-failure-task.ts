import type { PlatformId } from "@appranks/shared";
import { createLogger, getPlatform } from "@appranks/shared";
import { ensureScrapingErrorLabel, createLinearIssue } from "./linear-client.js";

const log = createLogger("linear-job-failure");

/**
 * Create a Linear task when a BullMQ job fails at the job level
 * (e.g., stalled, timed out, uncaught exception).
 *
 * Unlike `createLinearErrorTask` which handles item-level errors,
 * this handles job-level failures where no item errors may exist.
 */
export async function createLinearJobFailureTask(
  jobId: string,
  queueName: string,
  platform: string | undefined,
  jobType: string | undefined,
  errorMessage: string,
  attemptsMade: number,
): Promise<void> {
  if (!process.env.LINEAR_API_KEY) return;

  try {
    const labelId = await ensureScrapingErrorLabel();
    if (!labelId) {
      log.warn("could not get scraping-error label, skipping job failure task");
      return;
    }

    const platformName = platform
      ? getPlatform(platform as PlatformId).name.split(" ")[0]
      : "Unknown";
    const typeLabel = jobType ?? "unknown";

    const title = `[${platformName}] Job failed: ${typeLabel} (job ${jobId})`;

    const lines: string[] = [];
    lines.push(`**Queue:** ${queueName}`);
    lines.push(`**Job ID:** ${jobId}`);
    lines.push(`**Job Type:** ${typeLabel}`);
    lines.push(`**Platform:** ${platformName}`);
    lines.push(`**Attempts Made:** ${attemptsMade}`);
    lines.push(`**Timestamp:** ${new Date().toISOString()}`);
    lines.push("");
    lines.push("## Error");
    lines.push("```");
    lines.push(errorMessage);
    lines.push("```");
    lines.push("");
    lines.push("## Notes");
    lines.push("This task was auto-created because a BullMQ job failed at the job level (e.g., stalled, timed out, or threw an unrecoverable error). Check the worker logs and Sentry for more details.");

    const description = lines.join("\n");

    const issue = await createLinearIssue({
      title,
      description,
      labelIds: [labelId],
      priority: 1, // Urgent — job-level failures are always critical
    });

    if (issue) {
      log.info("created Linear job failure task", {
        issueId: issue.identifier,
        jobId,
        jobType: typeLabel,
      });
    }
  } catch (err) {
    log.error("failed to create Linear job failure task", { error: String(err) });
  }
}
