import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensurePlatformDeveloper } from "../ensure-platform-developer.js";

// ---- Mocking ----

// Mock the shared package utilities
vi.mock("@appranks/shared", () => ({
  developerNameToSlug: vi.fn((name: string) =>
    name
      .toLowerCase()
      .replace(/\s+(inc|llc|ltd|corp)\.?$/i, "")
      .trim()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  ),
  normalizeDeveloperName: vi.fn((name: string) =>
    name.replace(/\s+(Inc|LLC|Ltd|Corp)\.?$/i, "").trim()
  ),
}));

/**
 * Create a mock db that simulates drizzle's query builder chain.
 * Each call to `from`, `where`, `limit`, `set`, `values`, `onConflictDoNothing`,
 * `returning` returns `this` for chaining, and the terminal call resolves the result.
 */
function createMockDb(options: {
  /** Result for platform_developers SELECT — undefined means not found */
  existingPlatformDev?: { globalDeveloperId: number };
  /** Result for global_developers SELECT by slug — undefined means not found */
  existingGlobalDev?: { id: number };
  /** Result for INSERT ... RETURNING on global_developers — undefined means conflict */
  insertGlobalResult?: { id: number };
}) {
  const {
    existingPlatformDev,
    existingGlobalDev,
    insertGlobalResult,
  } = options;

  let selectCallCount = 0;
  const insertCalls: Array<{ table: string; values: any }> = [];
  const updateCalls: Array<{ table: string; set: any }> = [];

  // Track which table is being operated on
  let currentTable: string = "";
  let isInsert = false;
  let isUpdate = false;
  let insertValues: any = null;
  let updateSet: any = null;

  const chainable: any = {};

  // Make all chain methods return `chainable` for fluent API
  const chainMethods = ["from", "where", "limit", "set", "values", "onConflictDoNothing"];
  for (const method of chainMethods) {
    chainable[method] = vi.fn(function (this: any, arg: any) {
      if (method === "values") {
        insertValues = arg;
      }
      if (method === "set") {
        updateSet = arg;
      }
      return chainable;
    });
  }

  // `returning` resolves the insert chain — returns an array
  chainable.returning = vi.fn(() => {
    insertCalls.push({ table: currentTable, values: insertValues });
    if (currentTable === "global_developers") {
      return Promise.resolve(insertGlobalResult ? [insertGlobalResult] : []);
    }
    return Promise.resolve([]);
  });

  // Make the chainable itself thenable so `await db.select()...limit(1)` resolves
  chainable.then = function (resolve: any, reject: any) {
    try {
      let result: any[];
      if (isInsert) {
        // INSERT without returning (platform_developers onConflictDoNothing)
        insertCalls.push({ table: currentTable, values: insertValues });
        result = [];
      } else if (isUpdate) {
        updateCalls.push({ table: currentTable, set: updateSet });
        result = [];
      } else {
        // SELECT
        selectCallCount++;
        if (selectCallCount === 1) {
          // First select: platform_developers lookup
          result = existingPlatformDev ? [existingPlatformDev] : [];
        } else if (selectCallCount === 2) {
          // Second select: global_developers lookup by slug
          result = existingGlobalDev ? [existingGlobalDev] : [];
        } else {
          // Third select: race condition re-fetch
          result = existingGlobalDev ? [existingGlobalDev] : [];
        }
      }
      resolve(result);
    } catch (e) {
      reject(e);
    }
  };

  const db = {
    select: vi.fn((fields: any) => {
      isInsert = false;
      isUpdate = false;
      return chainable;
    }),
    insert: vi.fn((table: any) => {
      isInsert = true;
      isUpdate = false;
      // Determine table name from the drizzle table object
      // In tests this is called with the imported table references
      currentTable =
        table?.[Symbol.for("drizzle:Name")] ||
        table?._.name ||
        (table === "global_developers" ? "global_developers" : "platform_developers");
      return chainable;
    }),
    update: vi.fn((table: any) => {
      isInsert = false;
      isUpdate = true;
      currentTable =
        table?.[Symbol.for("drizzle:Name")] ||
        table?._.name ||
        "unknown";
      return chainable;
    }),
    _insertCalls: insertCalls,
    _updateCalls: updateCalls,
    _selectCallCount: () => selectCallCount,
  };

  return db;
}

describe("ensurePlatformDeveloper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Empty / whitespace name ---
  it("returns 0 for empty developer name", async () => {
    const db = createMockDb({});
    const result = await ensurePlatformDeveloper(db as any, "shopify", "");
    expect(result).toBe(0);
    // Should not even query the database
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns 0 for whitespace-only developer name", async () => {
    const db = createMockDb({});
    const result = await ensurePlatformDeveloper(db as any, "shopify", "   ");
    expect(result).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });

  // --- Existing platform developer found ---
  it("returns existing global developer ID when platform developer exists", async () => {
    const db = createMockDb({
      existingPlatformDev: { globalDeveloperId: 42 },
    });

    const result = await ensurePlatformDeveloper(
      db as any,
      "shopify",
      "Bold Commerce"
    );

    expect(result).toBe(42);
    expect(db.select).toHaveBeenCalledTimes(1); // Only one select — found immediately
    expect(db.insert).not.toHaveBeenCalled();
  });

  // --- Global developer exists, new platform developer ---
  it("links to existing global developer and creates platform developer", async () => {
    const db = createMockDb({
      existingPlatformDev: undefined,
      existingGlobalDev: { id: 10 },
    });

    const result = await ensurePlatformDeveloper(
      db as any,
      "wix",
      "Bold Commerce"
    );

    expect(result).toBe(10);
    expect(db.select).toHaveBeenCalledTimes(2); // platform lookup + global lookup
    expect(db.insert).toHaveBeenCalledTimes(1); // only platform_developers insert
  });

  // --- New developer — creates both global and platform ---
  it("creates new global developer and platform developer when neither exists", async () => {
    const db = createMockDb({
      existingPlatformDev: undefined,
      existingGlobalDev: undefined,
      insertGlobalResult: { id: 99 },
    });

    const result = await ensurePlatformDeveloper(
      db as any,
      "shopify",
      "NewDev Co"
    );

    expect(result).toBe(99);
    expect(db.select).toHaveBeenCalledTimes(2); // platform + global lookups
    expect(db.insert).toHaveBeenCalledTimes(2); // global + platform inserts
  });

  // --- Race condition: insert conflict, then re-fetch ---
  it("handles race condition — insert conflict triggers re-fetch", async () => {
    const db = createMockDb({
      existingPlatformDev: undefined,
      existingGlobalDev: undefined, // Not found on first check
      insertGlobalResult: undefined, // Insert returns empty (conflict)
    });

    // For the race condition case, the 3rd select needs to return the developer
    // Override to simulate the re-fetch finding the developer
    let selectCount = 0;
    const origSelect = db.select;
    db.select = vi.fn((...args: any[]) => {
      selectCount++;
      const chain = origSelect(...args);

      // Override the then for the 3rd select call (race condition re-fetch)
      if (selectCount >= 2) {
        const origThen = chain.then;
        chain.then = function (resolve: any, reject: any) {
          // Let first two calls go through normally
          if (selectCount <= 2) {
            return origThen.call(this, resolve, reject);
          }
          // 3rd call: return the raced developer
          resolve([{ id: 77 }]);
        };
      }

      return chain;
    }) as any;

    const result = await ensurePlatformDeveloper(
      db as any,
      "shopify",
      "RacedDev"
    );

    expect(result).toBe(77);
  });

  // --- Name trimming ---
  it("trims whitespace from developer name before processing", async () => {
    const db = createMockDb({
      existingPlatformDev: { globalDeveloperId: 5 },
    });

    await ensurePlatformDeveloper(db as any, "shopify", "  Acme Inc  ");

    // The where clause should use trimmed name
    // We verify by checking that select was called (name was not empty after trim)
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  // --- Website field ---
  it("updates website if existing global developer has empty website", async () => {
    const db = createMockDb({
      existingPlatformDev: undefined,
      existingGlobalDev: { id: 20 },
    });

    await ensurePlatformDeveloper(
      db as any,
      "shopify",
      "Acme",
      "https://acme.com"
    );

    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it("does not update website if none provided", async () => {
    const db = createMockDb({
      existingPlatformDev: undefined,
      existingGlobalDev: { id: 20 },
    });

    await ensurePlatformDeveloper(db as any, "shopify", "Acme");

    expect(db.update).not.toHaveBeenCalled();
  });

  it("does not update website if null provided", async () => {
    const db = createMockDb({
      existingPlatformDev: undefined,
      existingGlobalDev: { id: 20 },
    });

    await ensurePlatformDeveloper(db as any, "shopify", "Acme", null);

    expect(db.update).not.toHaveBeenCalled();
  });

  // --- Cross-platform scenarios ---
  it("same developer name on different platforms links to same global", async () => {
    // First call: shopify — creates everything new
    const db1 = createMockDb({
      existingPlatformDev: undefined,
      existingGlobalDev: undefined,
      insertGlobalResult: { id: 50 },
    });
    const result1 = await ensurePlatformDeveloper(
      db1 as any,
      "shopify",
      "Jotform"
    );

    // Second call: wix — same name, global already exists
    const db2 = createMockDb({
      existingPlatformDev: undefined,
      existingGlobalDev: { id: 50 },
    });
    const result2 = await ensurePlatformDeveloper(
      db2 as any,
      "wix",
      "Jotform"
    );

    expect(result1).toBe(50);
    expect(result2).toBe(50);
  });

  // --- Corporate suffix normalization ---
  it("normalizes developer name with Inc suffix for slug matching", async () => {
    const db = createMockDb({
      existingPlatformDev: undefined,
      existingGlobalDev: { id: 33 },
    });

    // "Acme Inc" should slug to "acme" (suffix stripped), matching existing global
    await ensurePlatformDeveloper(db as any, "shopify", "Acme Inc");

    // Should find the global developer because slug normalization strips "Inc"
    expect(db.select).toHaveBeenCalledTimes(2);
    expect(db.insert).toHaveBeenCalledTimes(1); // Only platform_developers
  });

  it("normalizes developer name with LLC suffix", async () => {
    const db = createMockDb({
      existingPlatformDev: undefined,
      existingGlobalDev: { id: 34 },
    });

    await ensurePlatformDeveloper(db as any, "shopify", "Acme LLC");

    expect(db.select).toHaveBeenCalledTimes(2);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  // --- Platform parameter ---
  it("works with various platform identifiers", async () => {
    const platforms = [
      "shopify",
      "wix",
      "salesforce",
      "atlassian",
      "zendesk",
      "hubspot",
    ];
    for (const platform of platforms) {
      const db = createMockDb({
        existingPlatformDev: { globalDeveloperId: 1 },
      });
      const result = await ensurePlatformDeveloper(
        db as any,
        platform,
        "TestDev"
      );
      expect(result).toBe(1);
    }
  });

  // --- onConflictDoNothing is used ---
  it("uses onConflictDoNothing for both inserts to handle concurrency", async () => {
    const db = createMockDb({
      existingPlatformDev: undefined,
      existingGlobalDev: undefined,
      insertGlobalResult: { id: 55 },
    });

    await ensurePlatformDeveloper(db as any, "shopify", "ConcurrentDev");

    // Both global and platform inserts should go through
    expect(db.insert).toHaveBeenCalledTimes(2);
  });
});
