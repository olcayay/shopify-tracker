import { describe, it, expect } from "vitest";

/**
 * Tests for the no-op DB stub used in smoke tests.
 * Verifies that all chainable methods work without a real DB connection.
 */

function createNoopDb(): any {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    groupBy: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    insert: () => chain,
    values: () => chain,
    returning: () => Promise.resolve([{ id: "smoke-test-stub" }]),
    update: () => chain,
    set: () => chain,
    delete: () => chain,
    onConflictDoUpdate: () => chain,
    onConflictDoNothing: () => chain,
    execute: () => Promise.resolve([]),
    then: (resolve: any) => resolve([]),
  };
  return chain;
}

describe("createNoopDb (smoke test DB stub)", () => {
  it("supports select().from().where() chain and resolves to empty array", async () => {
    const db = createNoopDb();
    const result = await db.select().from("table").where("condition");
    expect(result).toEqual([]);
  });

  it("supports insert().values().returning() chain", async () => {
    const db = createNoopDb();
    const result = await db.insert("table").values({ key: "value" }).returning();
    expect(result).toEqual([{ id: "smoke-test-stub" }]);
  });

  it("supports update().set().where() chain", async () => {
    const db = createNoopDb();
    const result = await db.update("table").set({ key: "value" }).where("condition");
    expect(result).toEqual([]);
  });

  it("supports execute() for raw SQL", async () => {
    const db = createNoopDb();
    const result = await db.execute("SELECT 1");
    expect(result).toEqual([]);
  });

  it("supports onConflictDoUpdate chain", async () => {
    const db = createNoopDb();
    const result = await db.insert("table").values({}).onConflictDoUpdate({});
    expect(result).toEqual([]);
  });

  it("supports deeply chained queries", async () => {
    const db = createNoopDb();
    const result = await db
      .select()
      .from("table")
      .leftJoin("other", "condition")
      .where("filter")
      .orderBy("col")
      .limit(10)
      .offset(0);
    expect(result).toEqual([]);
  });
});
