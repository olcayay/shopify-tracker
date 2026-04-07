import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the DB proxy pattern used to propagate pool resets to route handlers.
 * Routes capture `const db = app.db` at registration time. The proxy ensures
 * that after pool reset (reassigning the module-level `db`), all method calls
 * through the captured reference delegate to the new pool.
 */

describe("DB proxy delegation", () => {
  it("delegates method calls to the current target", () => {
    const pool1 = { execute: vi.fn().mockResolvedValue("pool1-result"), select: vi.fn() };
    const pool2 = { execute: vi.fn().mockResolvedValue("pool2-result"), select: vi.fn() };

    let currentDb = pool1;
    const proxy = new Proxy({} as any, {
      get(_target, prop) {
        const value = (currentDb as any)[prop];
        if (typeof value === "function") return value.bind(currentDb);
        return value;
      },
    });

    // Capture proxy (simulates route registration)
    const capturedDb = proxy;

    // Use pool1
    capturedDb.execute("SELECT 1");
    expect(pool1.execute).toHaveBeenCalledWith("SELECT 1");
    expect(pool2.execute).not.toHaveBeenCalled();

    // Simulate pool reset
    currentDb = pool2;

    // Captured reference now delegates to pool2
    capturedDb.execute("SELECT 2");
    expect(pool2.execute).toHaveBeenCalledWith("SELECT 2");
    expect(pool1.execute).toHaveBeenCalledTimes(1); // pool1 not called again
  });

  it("delegates property access to the current target", () => {
    let currentDb: any = { __pgClient: { options: { max: 10 } } };
    const proxy = new Proxy({} as any, {
      get(_target, prop) {
        const value = (currentDb as any)[prop];
        if (typeof value === "function") return value.bind(currentDb);
        return value;
      },
    });

    expect(proxy.__pgClient.options.max).toBe(10);

    // Swap target
    currentDb = { __pgClient: { options: { max: 20 } } };
    expect(proxy.__pgClient.options.max).toBe(20);
  });

  it("binds methods to the correct context", async () => {
    const results: string[] = [];
    const pool1 = {
      execute: function () { results.push("pool1"); return Promise.resolve(); },
    };
    const pool2 = {
      execute: function () { results.push("pool2"); return Promise.resolve(); },
    };

    let currentDb: any = pool1;
    const proxy = new Proxy({} as any, {
      get(_target, prop) {
        const value = (currentDb as any)[prop];
        if (typeof value === "function") return value.bind(currentDb);
        return value;
      },
    });

    const capturedDb = proxy;
    await capturedDb.execute();
    currentDb = pool2;
    await capturedDb.execute();

    expect(results).toEqual(["pool1", "pool2"]);
  });

  it("returns undefined for non-existent properties", () => {
    let currentDb: any = {};
    const proxy = new Proxy({} as any, {
      get(_target, prop) {
        const value = (currentDb as any)[prop];
        if (typeof value === "function") return value.bind(currentDb);
        return value;
      },
    });

    expect(proxy.nonExistent).toBeUndefined();
  });
});
