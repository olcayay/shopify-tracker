import { describe, it, expect, vi } from "vitest";
import { recordItemError } from "../record-item-error.js";

function createMockDb() {
  const insertedValues: any[] = [];
  return {
    db: {
      insert: () => ({
        values: (val: any) => {
          insertedValues.push(val);
          return Promise.resolve();
        },
      }),
    } as any,
    insertedValues,
  };
}

function createFailingDb() {
  return {
    insert: () => ({
      values: () => Promise.reject(new Error("DB connection failed")),
    }),
  } as any;
}

describe("recordItemError", () => {
  it("inserts an error record with correct fields", async () => {
    const { db, insertedValues } = createMockDb();
    const error = new Error("page not found");
    error.stack = "Error: page not found\n    at scrape (scraper.ts:42)";

    await recordItemError(db, {
      scrapeRunId: "run-123",
      itemIdentifier: "my-app",
      itemType: "app",
      url: "https://apps.shopify.com/my-app",
      error,
    });

    expect(insertedValues).toHaveLength(1);
    const record = insertedValues[0];
    expect(record.scrapeRunId).toBe("run-123");
    expect(record.itemIdentifier).toBe("my-app");
    expect(record.itemType).toBe("app");
    expect(record.url).toBe("https://apps.shopify.com/my-app");
    expect(record.errorMessage).toBe("page not found");
    expect(record.stackTrace).toContain("scraper.ts:42");
  });

  it("handles string errors", async () => {
    const { db, insertedValues } = createMockDb();

    await recordItemError(db, {
      scrapeRunId: "run-456",
      itemIdentifier: "some-keyword",
      itemType: "keyword",
      error: "timeout after 90s",
    });

    expect(insertedValues).toHaveLength(1);
    expect(insertedValues[0].errorMessage).toBe("timeout after 90s");
    expect(insertedValues[0].url).toBeNull();
  });

  it("truncates long error messages to 2048 chars", async () => {
    const { db, insertedValues } = createMockDb();
    const longMessage = "x".repeat(5000);

    await recordItemError(db, {
      scrapeRunId: "run-789",
      itemIdentifier: "test",
      itemType: "app",
      error: new Error(longMessage),
    });

    expect(insertedValues[0].errorMessage.length).toBe(2048);
  });

  it("truncates long identifiers to 255 chars", async () => {
    const { db, insertedValues } = createMockDb();
    const longId = "k".repeat(500);

    await recordItemError(db, {
      scrapeRunId: "run-abc",
      itemIdentifier: longId,
      itemType: "keyword",
      error: new Error("fail"),
    });

    expect(insertedValues[0].itemIdentifier.length).toBe(255);
  });

  it("truncates long URLs to 1024 chars", async () => {
    const { db, insertedValues } = createMockDb();
    const longUrl = "https://example.com/" + "a".repeat(2000);

    await recordItemError(db, {
      scrapeRunId: "run-url",
      itemIdentifier: "test",
      itemType: "app",
      url: longUrl,
      error: new Error("fail"),
    });

    expect(insertedValues[0].url.length).toBe(1024);
  });

  it("does not throw when DB insert fails", async () => {
    const db = createFailingDb();

    // Should not throw
    await expect(
      recordItemError(db, {
        scrapeRunId: "run-fail",
        itemIdentifier: "test",
        itemType: "app",
        error: new Error("original error"),
      })
    ).resolves.toBeUndefined();
  });
});
