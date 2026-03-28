import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGracefulShutdown, type ShutdownLogger } from "../graceful-shutdown.js";

function createMockWorker(opts?: { closeFn?: () => Promise<void>; running?: boolean }) {
  return {
    name: "test-queue",
    isRunning: vi.fn().mockReturnValue(opts?.running ?? true),
    close: vi.fn().mockImplementation(opts?.closeFn ?? (() => Promise.resolve())),
  } as any;
}

function createMockLogger(): ShutdownLogger & {
  calls: { level: string; msg: string; meta?: Record<string, unknown> }[];
} {
  const calls: { level: string; msg: string; meta?: Record<string, unknown> }[] = [];
  return {
    calls,
    info: (msg, meta) => calls.push({ level: "info", msg, meta }),
    warn: (msg, meta) => calls.push({ level: "warn", msg, meta }),
    error: (msg, meta) => calls.push({ level: "error", msg, meta }),
  };
}

describe("createGracefulShutdown", () => {
  let exit: ReturnType<typeof vi.fn>;
  let log: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    exit = vi.fn();
    log = createMockLogger();
  });

  it("closes all workers and exits with 0", async () => {
    const w1 = createMockWorker();
    const w2 = createMockWorker();
    const { shutdown } = createGracefulShutdown([w1, w2], log, { exit });

    await shutdown("SIGTERM");

    expect(w1.close).toHaveBeenCalledOnce();
    expect(w2.close).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("logs the signal name", async () => {
    const { shutdown } = createGracefulShutdown([createMockWorker()], log, { exit });

    await shutdown("SIGTERM");

    const initLog = log.calls.find((c) => c.msg === "graceful shutdown initiated");
    expect(initLog).toBeDefined();
    expect(initLog!.meta?.signal).toBe("SIGTERM");
  });

  it("logs worker running status", async () => {
    const w = createMockWorker({ running: true });
    w.name = "bg-queue";
    const { shutdown } = createGracefulShutdown([w], log, { exit });

    await shutdown("SIGINT");

    const statusLog = log.calls.find((c) => c.msg === "worker status at shutdown");
    expect(statusLog).toBeDefined();
    expect(statusLog!.meta?.running).toBe(true);
    expect(statusLog!.meta?.name).toBe("bg-queue");
  });

  it("prevents duplicate shutdown calls", async () => {
    const w = createMockWorker();
    const result = createGracefulShutdown([w], log, { exit });

    await result.shutdown("SIGTERM");
    expect(result.isShuttingDown).toBe(true);

    // Second call should be ignored
    await result.shutdown("SIGINT");

    expect(w.close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);

    const warnLog = log.calls.find((c) => c.msg.includes("ignoring duplicate"));
    expect(warnLog).toBeDefined();
  });

  it("handles worker close errors gracefully", async () => {
    const w = createMockWorker({
      closeFn: () => Promise.reject(new Error("close failed")),
    });
    const { shutdown } = createGracefulShutdown([w], log, { exit });

    await shutdown("SIGTERM");

    // Should still exit with 0 (error is logged, not thrown)
    expect(exit).toHaveBeenCalledWith(0);
    const errLog = log.calls.find((c) => c.msg === "error during worker shutdown");
    expect(errLog).toBeDefined();
    expect(errLog!.meta?.error).toContain("close failed");
  });

  it("force-exits after timeout", async () => {
    vi.useFakeTimers();

    const w = createMockWorker({
      closeFn: () => new Promise(() => {}), // never resolves
    });
    const { shutdown } = createGracefulShutdown([w], log, {
      exit,
      timeoutMs: 5_000,
    });

    // Start shutdown (will hang on worker.close)
    const promise = shutdown("SIGTERM");

    // Advance past the timeout
    vi.advanceTimersByTime(5_001);

    expect(exit).toHaveBeenCalledWith(1);
    const timeoutLog = log.calls.find((c) => c.msg.includes("timed out"));
    expect(timeoutLog).toBeDefined();

    vi.useRealTimers();
  });

  it("logs completion message on success", async () => {
    const { shutdown } = createGracefulShutdown([createMockWorker()], log, { exit });

    await shutdown("SIGTERM");

    const completeLog = log.calls.find((c) => c.msg === "shutdown complete, exiting");
    expect(completeLog).toBeDefined();

    const closedLog = log.calls.find((c) => c.msg === "all workers closed successfully");
    expect(closedLog).toBeDefined();
  });
});
