import { describe, it, expect, vi } from "vitest";

/**
 * Comprehensive tests for the DB proxy pattern.
 * The proxy ensures pool resets propagate to all 51 route handlers
 * that capture `const db = app.db` at registration time.
 */

function createDbProxy<T extends object>(getCurrentDb: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const value = (getCurrentDb() as any)[prop];
      if (typeof value === "function") return value.bind(getCurrentDb());
      return value;
    },
    set(_target, prop, value) {
      (getCurrentDb() as any)[prop] = value;
      return true;
    },
  });
}

describe("DB proxy delegation", () => {
  it("delegates method calls to the current target", () => {
    const pool1 = { execute: vi.fn().mockResolvedValue("pool1-result"), select: vi.fn() };
    const pool2 = { execute: vi.fn().mockResolvedValue("pool2-result"), select: vi.fn() };

    let currentDb = pool1;
    const proxy = createDbProxy(() => currentDb);
    const capturedDb = proxy;

    capturedDb.execute("SELECT 1");
    expect(pool1.execute).toHaveBeenCalledWith("SELECT 1");
    expect(pool2.execute).not.toHaveBeenCalled();

    currentDb = pool2;
    capturedDb.execute("SELECT 2");
    expect(pool2.execute).toHaveBeenCalledWith("SELECT 2");
    expect(pool1.execute).toHaveBeenCalledTimes(1);
  });

  it("delegates property access to the current target", () => {
    let currentDb: any = { __pgClient: { options: { max: 10 } } };
    const proxy = createDbProxy(() => currentDb);

    expect(proxy.__pgClient.options.max).toBe(10);
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
    const proxy = createDbProxy(() => currentDb);
    const capturedDb = proxy;

    await capturedDb.execute();
    currentDb = pool2;
    await capturedDb.execute();

    expect(results).toEqual(["pool1", "pool2"]);
  });

  it("returns undefined for non-existent properties", () => {
    const currentDb: any = {};
    const proxy = createDbProxy(() => currentDb);
    expect(proxy.nonExistent).toBeUndefined();
  });
});

describe("DB proxy — multiple route simulation", () => {
  it("all captured references update after pool swap", () => {
    const pool1 = { execute: vi.fn(), select: vi.fn(), insert: vi.fn() };
    const pool2 = { execute: vi.fn(), select: vi.fn(), insert: vi.fn() };

    let currentDb = pool1;
    const proxy = createDbProxy(() => currentDb);

    // Simulate 5 different routes capturing db at registration
    const route1Db = proxy;
    const route2Db = proxy;
    const route3Db = proxy;
    const route4Db = proxy;
    const route5Db = proxy;

    // All routes use pool1
    route1Db.execute("q1");
    route2Db.select("q2");
    route3Db.insert("q3");
    expect(pool1.execute).toHaveBeenCalledTimes(1);
    expect(pool1.select).toHaveBeenCalledTimes(1);
    expect(pool1.insert).toHaveBeenCalledTimes(1);

    // Pool reset
    currentDb = pool2;

    // All routes now use pool2
    route4Db.execute("q4");
    route5Db.select("q5");
    route1Db.insert("q6");
    expect(pool2.execute).toHaveBeenCalledTimes(1);
    expect(pool2.select).toHaveBeenCalledTimes(1);
    expect(pool2.insert).toHaveBeenCalledTimes(1);
    // pool1 not called again
    expect(pool1.execute).toHaveBeenCalledTimes(1);
  });
});

describe("DB proxy — concurrent request safety", () => {
  it("handles concurrent reads during pool swap", async () => {
    const results: string[] = [];
    const pool1 = {
      execute: vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push("pool1");
      }),
    };
    const pool2 = {
      execute: vi.fn(async () => {
        results.push("pool2");
      }),
    };

    let currentDb: any = pool1;
    const proxy = createDbProxy(() => currentDb);

    // Start a slow request on pool1
    const slowRequest = proxy.execute("slow");

    // Pool reset happens while request is in flight
    currentDb = pool2;

    // New request goes to pool2
    await proxy.execute("fast");

    // Wait for slow request to complete
    await slowRequest;

    // Both pools were used
    expect(pool1.execute).toHaveBeenCalledTimes(1);
    expect(pool2.execute).toHaveBeenCalledTimes(1);
    expect(results).toContain("pool1");
    expect(results).toContain("pool2");
  });
});

describe("DB proxy — multiple pool resets", () => {
  it("survives 3 consecutive pool resets", () => {
    const pools = [
      { execute: vi.fn() },
      { execute: vi.fn() },
      { execute: vi.fn() },
      { execute: vi.fn() },
    ];

    let currentDb: any = pools[0];
    const proxy = createDbProxy(() => currentDb);
    const capturedDb = proxy;

    capturedDb.execute("q0");
    expect(pools[0].execute).toHaveBeenCalledTimes(1);

    currentDb = pools[1];
    capturedDb.execute("q1");
    expect(pools[1].execute).toHaveBeenCalledTimes(1);

    currentDb = pools[2];
    capturedDb.execute("q2");
    expect(pools[2].execute).toHaveBeenCalledTimes(1);

    currentDb = pools[3];
    capturedDb.execute("q3");
    expect(pools[3].execute).toHaveBeenCalledTimes(1);

    // Verify each pool was only called once
    pools.forEach((pool, i) => {
      expect(pool.execute).toHaveBeenCalledTimes(1);
      expect(pool.execute).toHaveBeenCalledWith(`q${i}`);
    });
  });
});

describe("DB proxy — error handling", () => {
  it("propagates errors from the current pool", async () => {
    const pool = {
      execute: vi.fn().mockRejectedValue(new Error("CONNECTION_ENDED")),
    };
    let currentDb: any = pool;
    const proxy = createDbProxy(() => currentDb);

    await expect(proxy.execute("test")).rejects.toThrow("CONNECTION_ENDED");
  });

  it("new pool works after old pool threw", async () => {
    const badPool = {
      execute: vi.fn().mockRejectedValue(new Error("pool stuck")),
    };
    const goodPool = {
      execute: vi.fn().mockResolvedValue("success"),
    };

    let currentDb: any = badPool;
    const proxy = createDbProxy(() => currentDb);

    await expect(proxy.execute("test")).rejects.toThrow("pool stuck");

    // Pool reset
    currentDb = goodPool;
    const result = await proxy.execute("test2");
    expect(result).toBe("success");
  });
});

describe("DB proxy — Drizzle ORM method chain simulation", () => {
  it("supports chained method calls (select().from().where())", () => {
    const mockWhere = vi.fn().mockReturnValue([{ id: 1 }]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    const pool = { select: mockSelect };

    let currentDb: any = pool;
    const proxy = createDbProxy(() => currentDb);

    const result = proxy.select().from("apps").where("id = 1");
    expect(result).toEqual([{ id: 1 }]);
    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith("apps");
    expect(mockWhere).toHaveBeenCalledWith("id = 1");
  });

  it("supports insert().values().returning()", () => {
    const mockReturning = vi.fn().mockReturnValue([{ id: 1 }]);
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
    const pool = { insert: mockInsert };

    let currentDb: any = pool;
    const proxy = createDbProxy(() => currentDb);

    const result = proxy.insert("apps").values({ name: "test" }).returning();
    expect(result).toEqual([{ id: 1 }]);
  });
});
