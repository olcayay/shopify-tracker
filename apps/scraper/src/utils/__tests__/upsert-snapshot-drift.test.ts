import { describe, it, expect } from "vitest";
import { IGNORED_DRIFT_FIELDS } from "../upsert-snapshot-from-card.js";

describe("IGNORED_DRIFT_FIELDS", () => {
  it("contains averageRating", () => {
    expect(IGNORED_DRIFT_FIELDS.has("averageRating")).toBe(true);
  });

  it("contains ratingCount", () => {
    expect(IGNORED_DRIFT_FIELDS.has("ratingCount")).toBe(true);
  });

  it("does not contain meaningful change fields", () => {
    expect(IGNORED_DRIFT_FIELDS.has("pricing")).toBe(false);
    expect(IGNORED_DRIFT_FIELDS.has("appIntroduction")).toBe(false);
    expect(IGNORED_DRIFT_FIELDS.has("developer")).toBe(false);
    expect(IGNORED_DRIFT_FIELDS.has("name")).toBe(false);
    expect(IGNORED_DRIFT_FIELDS.has("seoTitle")).toBe(false);
  });
});
