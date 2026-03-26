import type { Database } from "@appranks/db";
import { scrapeItemErrors } from "@appranks/db";
import { createLogger } from "@appranks/shared";

const log = createLogger("record-item-error");

export async function recordItemError(
  db: Database,
  params: {
    scrapeRunId: string;
    itemIdentifier: string;
    itemType: string;
    url?: string;
    error: unknown;
  }
): Promise<void> {
  try {
    const err =
      params.error instanceof Error
        ? params.error
        : new Error(String(params.error));

    await db.insert(scrapeItemErrors).values({
      scrapeRunId: params.scrapeRunId,
      itemIdentifier: params.itemIdentifier.slice(0, 255),
      itemType: params.itemType,
      url: params.url?.slice(0, 1024) || null,
      errorMessage: err.message.slice(0, 2048),
      stackTrace: err.stack || null,
    });
  } catch (insertError) {
    log.error("failed to record item error", {
      runId: params.scrapeRunId,
      item: params.itemIdentifier,
      error: String(insertError),
    });
  }
}
