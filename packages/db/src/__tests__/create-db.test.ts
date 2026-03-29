import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the postgres module before importing createDb
const mockPostgresClient = {};
const mockPostgres = vi.fn((..._args: any[]) => mockPostgresClient);

vi.mock("postgres", () => ({
  default: (...args: any[]) => mockPostgres(...args),
}));

// Mock drizzle to capture what it receives
const mockDrizzleReturn = { query: {} };
const mockDrizzle = vi.fn((..._args: any[]) => mockDrizzleReturn);

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: (...args: any[]) => mockDrizzle(...args),
}));

// Import after mocks are set up
import { createDb, createHealthCheckDb, schema } from "../index.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createDb", () => {
  it("creates a postgres client with the given URL", () => {
    createDb("postgres://localhost:5432/testdb");
    expect(mockPostgres).toHaveBeenCalledWith(
      "postgres://localhost:5432/testdb",
      expect.any(Object)
    );
  });

  it("sets max connections to 10", () => {
    createDb("postgres://localhost/db");
    const config = mockPostgres.mock.calls[0][1];
    expect(config.max).toBe(10);
  });

  it("sets idle timeout to 30 seconds", () => {
    createDb("postgres://localhost/db");
    const config = mockPostgres.mock.calls[0][1];
    expect(config.idle_timeout).toBe(30);
  });

  it("sets max lifetime to 30 minutes (1800 seconds)", () => {
    createDb("postgres://localhost/db");
    const config = mockPostgres.mock.calls[0][1];
    expect(config.max_lifetime).toBe(60 * 30);
  });

  it("forces UTC timezone and statement_timeout in connection settings", () => {
    createDb("postgres://localhost/db");
    const config = mockPostgres.mock.calls[0][1];
    expect(config.connection).toEqual({
      timezone: "UTC",
      statement_timeout: 30000,
    });
  });

  it("sets connect timeout to 10 seconds", () => {
    createDb("postgres://localhost/db");
    const config = mockPostgres.mock.calls[0][1];
    expect(config.connect_timeout).toBe(10);
  });

  it("provides exponential backoff function", () => {
    createDb("postgres://localhost/db");
    const config = mockPostgres.mock.calls[0][1];
    expect(typeof config.backoff).toBe("function");
  });

  it("backoff returns 1s for first retry", () => {
    createDb("postgres://localhost/db");
    const { backoff } = mockPostgres.mock.calls[0][1];
    expect(backoff(0)).toBe(1000);
  });

  it("backoff returns 2s for second retry", () => {
    createDb("postgres://localhost/db");
    const { backoff } = mockPostgres.mock.calls[0][1];
    expect(backoff(1)).toBe(2000);
  });

  it("backoff returns 4s for third retry", () => {
    createDb("postgres://localhost/db");
    const { backoff } = mockPostgres.mock.calls[0][1];
    expect(backoff(2)).toBe(4000);
  });

  it("backoff caps at 30s", () => {
    createDb("postgres://localhost/db");
    const { backoff } = mockPostgres.mock.calls[0][1];
    // 2^5 = 32s, should be capped to 30s
    expect(backoff(5)).toBe(30000);
    expect(backoff(10)).toBe(30000);
    expect(backoff(100)).toBe(30000);
  });

  it("passes the postgres client and schema to drizzle", () => {
    createDb("postgres://localhost/db");
    expect(mockDrizzle).toHaveBeenCalledWith(mockPostgresClient, { schema });
  });

  it("returns the drizzle instance", () => {
    const db = createDb("postgres://localhost/db");
    expect(db).toBe(mockDrizzleReturn);
  });

  it("schema contains expected table exports", () => {
    // Verify key tables are present in the combined schema
    expect(schema).toHaveProperty("apps");
    expect(schema).toHaveProperty("categories");
    expect(schema).toHaveProperty("reviews");
    expect(schema).toHaveProperty("trackedKeywords");
    expect(schema).toHaveProperty("users");
    expect(schema).toHaveProperty("accounts");
    expect(schema).toHaveProperty("globalDevelopers");
    expect(schema).toHaveProperty("platformDevelopers");
    expect(schema).toHaveProperty("scrapeRuns");
    expect(schema).toHaveProperty("notifications");
    expect(schema).toHaveProperty("emailLogs");
  });
});

describe("createHealthCheckDb", () => {
  it("creates a postgres client with max 1 connection", () => {
    createHealthCheckDb("postgres://localhost/db");
    const config = mockPostgres.mock.calls[0][1];
    expect(config.max).toBe(1);
  });

  it("sets idle timeout to 60 seconds", () => {
    createHealthCheckDb("postgres://localhost/db");
    const config = mockPostgres.mock.calls[0][1];
    expect(config.idle_timeout).toBe(60);
  });

  it("sets connect timeout to 5 seconds", () => {
    createHealthCheckDb("postgres://localhost/db");
    const config = mockPostgres.mock.calls[0][1];
    expect(config.connect_timeout).toBe(5);
  });

  it("sets statement_timeout to 5 seconds for fast health checks", () => {
    createHealthCheckDb("postgres://localhost/db");
    const config = mockPostgres.mock.calls[0][1];
    expect(config.connection.statement_timeout).toBe(5000);
  });

  it("returns a drizzle instance", () => {
    const db = createHealthCheckDb("postgres://localhost/db");
    expect(db).toBe(mockDrizzleReturn);
    expect(mockDrizzle).toHaveBeenCalledWith(mockPostgresClient, { schema });
  });
});
