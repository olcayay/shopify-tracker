import type { Worker } from "bullmq";

export interface ShutdownLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export interface GracefulShutdownOptions {
  /** Max time (ms) to wait for in-flight jobs before force-exiting. Default: 60_000 */
  timeoutMs?: number;
  /** Override process.exit for testing */
  exit?: (code: number) => void;
}

/**
 * Creates a graceful shutdown handler for BullMQ workers.
 *
 * - Prevents duplicate shutdown calls
 * - Logs in-flight job status
 * - Waits for workers to finish active jobs (BullMQ close())
 * - Force-exits after timeout
 */
export function createGracefulShutdown(
  workers: Worker[],
  log: ShutdownLogger,
  opts: GracefulShutdownOptions = {},
) {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const exit = opts.exit ?? ((code: number) => process.exit(code));
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      log.warn("shutdown already in progress, ignoring duplicate signal", { signal });
      return;
    }
    shuttingDown = true;
    log.info("graceful shutdown initiated", { signal });

    // Hard timeout — force exit if graceful close takes too long
    const forceTimer = setTimeout(() => {
      log.error("graceful shutdown timed out, forcing exit", { timeoutMs });
      exit(1);
    }, timeoutMs);
    forceTimer.unref();

    // Log in-flight job status for each worker
    for (const w of workers) {
      log.info("worker status at shutdown", {
        name: w.name,
        running: w.isRunning(),
      });
    }

    try {
      // BullMQ Worker.close() stops picking new jobs and waits for active ones
      await Promise.all(workers.map((w) => w.close()));
      log.info("all workers closed successfully");
    } catch (err) {
      log.error("error during worker shutdown", { error: String(err) });
    }

    clearTimeout(forceTimer);
    log.info("shutdown complete, exiting");
    exit(0);
  };

  return {
    shutdown,
    /** Exposed for testing */
    get isShuttingDown() {
      return shuttingDown;
    },
  };
}
