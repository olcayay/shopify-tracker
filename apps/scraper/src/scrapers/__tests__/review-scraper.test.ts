import { describe, it, expect } from "vitest";
import { parseReviewDate } from "../review-scraper.js";

// ---------------------------------------------------------------------------
// PLA-254: parseReviewDate returns null on failure (not unparsed string)
// ---------------------------------------------------------------------------
describe("parseReviewDate", () => {
  it("parses standard 'Month Day, Year' format", () => {
    expect(parseReviewDate("December 29, 2025")).toBe("2025-12-29");
    expect(parseReviewDate("January 1, 2024")).toBe("2024-01-01");
    expect(parseReviewDate("March 15, 2023")).toBe("2023-03-15");
  });

  it("parses single-digit day", () => {
    expect(parseReviewDate("June 5, 2025")).toBe("2025-06-05");
  });

  it("parses ISO-like date format", () => {
    expect(parseReviewDate("2025-12-29")).toBe("2025-12-29");
    expect(parseReviewDate("2024-01-15T10:00:00Z")).toBe("2024-01-15");
  });

  it("returns null for empty string", () => {
    expect(parseReviewDate("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(parseReviewDate("   ")).toBeNull();
  });

  it("returns null for random text", () => {
    expect(parseReviewDate("not a date at all")).toBeNull();
  });

  it("returns null for partial date", () => {
    expect(parseReviewDate("December 2025")).toBeNull();
  });

  it("returns null for unknown month name", () => {
    expect(parseReviewDate("Foobar 15, 2025")).toBeNull();
  });

  it("handles all 12 months", () => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    months.forEach((month, i) => {
      const result = parseReviewDate(`${month} 1, 2025`);
      expect(result).toBe(`2025-${String(i + 1).padStart(2, "0")}-01`);
    });
  });
});
