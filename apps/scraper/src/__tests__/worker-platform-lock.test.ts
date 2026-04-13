import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import { withPlatformLock, NON_PLATFORM_JOBS } from "../worker-platform-lock.js";
import type { ScraperJobData } from "../queue.js";

function makeJob(overrides: Partial<ScraperJobData> = {}, id = "1"): Job<ScraperJobData> {
  return {
    id,
    data: {
      type: "app_details",
      platform: "salesforce",
      triggeredBy: "test",
      ...overrides,
    },
  } as unknown as Job<ScraperJobData>;
}

function makeDeps(overrides: Partial<Parameters<typeof withPlatformLock>[1]> = {}) {
  const release = vi.fn(async () => undefined);
  const acquireWithWait = vi.fn(async () => release);
  const limit = vi.fn(async () => [] as Array<{ isEnabled: boolean }>);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  const deps = {
    db: { select } as unknown as Parameters<typeof withPlatformLock>[1]["db"],
    redisLock: { acquireWithWait },
    log: { warn: vi.fn() },
    lockTtlMs: 1000,
    lockPollMs: 100,
    lockTimeoutMs: 5000,
    ...overrides,
  };

  return { deps, release, acquireWithWait, selectMock: select };
}

describe("withPlatformLock (PLA-1060)", () => {
  let processFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    processFn = vi.fn(async () => undefined);
  });

  it("bypasses lock for daily_digest / weekly_summary / data_cleanup", async () => {
    const { deps, acquireWithWait } = makeDeps();
    const wrapped = withPlatformLock(processFn, deps);

    for (const type of NON_PLATFORM_JOBS) {
      await wrapped(makeJob({ type: type as ScraperJobData["type"] }));
    }

    expect(processFn).toHaveBeenCalledTimes(NON_PLATFORM_JOBS.size);
    expect(acquireWithWait).not.toHaveBeenCalled();
  });

  it("acquires per-platform+type lock for scraping jobs and releases after success", async () => {
    const { deps, acquireWithWait, release } = makeDeps();
    const wrapped = withPlatformLock(processFn, deps);

    await wrapped(makeJob({ type: "app_details", platform: "salesforce" }));

    expect(acquireWithWait).toHaveBeenCalledWith(
      "platform:salesforce:app_details",
      1000,
      100,
      5000,
    );
    expect(processFn).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("releases lock even when the processor throws", async () => {
    const { deps, release } = makeDeps();
    processFn.mockRejectedValueOnce(new Error("boom"));
    const wrapped = withPlatformLock(processFn, deps);

    await expect(wrapped(makeJob())).rejects.toThrow("boom");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("throws when lock cannot be acquired within timeout", async () => {
    const { deps, acquireWithWait } = makeDeps();
    acquireWithWait.mockResolvedValueOnce(null as unknown as () => Promise<void>);
    const wrapped = withPlatformLock(processFn, deps);

    await expect(wrapped(makeJob({ platform: "salesforce" }))).rejects.toThrow(
      /Could not acquire lock for platform salesforce/,
    );
    expect(processFn).not.toHaveBeenCalled();
  });

  it("defaults missing platform to 'shopify'", async () => {
    const { deps, acquireWithWait } = makeDeps();
    const wrapped = withPlatformLock(processFn, deps);

    await wrapped(makeJob({ platform: undefined, type: "category" }));

    expect(acquireWithWait).toHaveBeenCalledWith(
      "platform:shopify:category",
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("serializes two concurrent same-platform jobs (regression for interactive-worker race)", async () => {
    // PLA-1060: two interactive worker instances previously raced on
    // Salesforce app_details. The lock must serialize them.
    let activeCount = 0;
    let maxActive = 0;
    const processOrder: string[] = [];

    processFn = vi.fn(async (job: Job<ScraperJobData>) => {
      activeCount += 1;
      maxActive = Math.max(maxActive, activeCount);
      processOrder.push(String(job.id));
      await new Promise((r) => setTimeout(r, 10));
      activeCount -= 1;
    });

    // Build a mutex-like redisLock stub: only one caller can hold the lock.
    let held = false;
    const waiters: Array<() => void> = [];
    const acquireWithWait = vi.fn(async () => {
      while (held) {
        await new Promise<void>((r) => waiters.push(r));
      }
      held = true;
      return async () => {
        held = false;
        const next = waiters.shift();
        if (next) next();
      };
    });

    const { deps } = makeDeps({
      redisLock: { acquireWithWait },
    });
    const wrapped = withPlatformLock(processFn, deps);

    await Promise.all([
      wrapped(makeJob({ platform: "salesforce", type: "app_details" }, "32")),
      wrapped(makeJob({ platform: "salesforce", type: "app_details" }, "33")),
    ]);

    expect(maxActive).toBe(1);
    expect(processOrder).toHaveLength(2);
  });

  it("skips job when platform feature flag is disabled (no lock acquired)", async () => {
    const limit = vi.fn(async () => [{ isEnabled: false }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const warn = vi.fn();

    const { deps, acquireWithWait } = makeDeps({
      db: { select } as unknown as Parameters<typeof withPlatformLock>[1]["db"],
      log: { warn },
    });
    const wrapped = withPlatformLock(processFn, deps);

    await wrapped(makeJob({ platform: "salesforce" }));

    expect(processFn).not.toHaveBeenCalled();
    expect(acquireWithWait).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "platform feature flag disabled, skipping job",
      expect.objectContaining({ platform: "salesforce" }),
    );
  });
});
