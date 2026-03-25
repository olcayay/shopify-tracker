import { describe, it, expect } from "vitest";
import { runConcurrent } from "../run-concurrent.js";

describe("runConcurrent", () => {
  it("processes all items", async () => {
    const results: number[] = [];
    await runConcurrent([1, 2, 3, 4, 5], async (n) => {
      results.push(n);
    }, 2);
    expect(results.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("respects concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;

    await runConcurrent([1, 2, 3, 4, 5, 6], async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
    }, 3);

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThanOrEqual(2); // at least some parallelism
  });

  it("handles empty array", async () => {
    const results: number[] = [];
    await runConcurrent([], async (n: number) => {
      results.push(n);
    }, 3);
    expect(results).toEqual([]);
  });

  it("continues processing when one item throws", async () => {
    const results: number[] = [];
    await runConcurrent([1, 2, 3, 4], async (n) => {
      if (n === 2) throw new Error("boom");
      results.push(n);
    }, 2);
    // Item 2 threw, but 1, 3, 4 should still be processed
    expect(results.sort()).toEqual([1, 3, 4]);
  });

  it("handles concurrency larger than items", async () => {
    const results: number[] = [];
    await runConcurrent([1, 2], async (n) => {
      results.push(n);
    }, 10);
    expect(results.sort()).toEqual([1, 2]);
  });

  it("processes items faster with higher concurrency", async () => {
    const delay = 50;
    const items = [1, 2, 3, 4, 5, 6];

    const start1 = Date.now();
    await runConcurrent(items, async () => {
      await new Promise((r) => setTimeout(r, delay));
    }, 1);
    const serial = Date.now() - start1;

    const start3 = Date.now();
    await runConcurrent(items, async () => {
      await new Promise((r) => setTimeout(r, delay));
    }, 3);
    const parallel = Date.now() - start3;

    // Parallel should be noticeably faster (at least 1.5x)
    expect(parallel).toBeLessThan(serial * 0.8);
  });
});
