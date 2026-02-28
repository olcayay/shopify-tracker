import { describe, it, expect } from "vitest";
import {
  extractWordGroups,
  filterKeywordsByWord,
  STOP_WORDS,
  MIN_WORD_FREQUENCY,
} from "@/lib/keyword-word-groups";

describe("extractWordGroups", () => {
  it("extracts words appearing 2+ times", () => {
    const result = extractWordGroups(["ai chatbot", "chatbot", "smart chatbot"]);
    expect(result.find((g) => g.word === "chatbot")).toEqual({ word: "chatbot", count: 3 });
    expect(result.find((g) => g.word === "ai")).toBeUndefined();
    expect(result.find((g) => g.word === "smart")).toBeUndefined();
  });

  it("returns empty array for no keywords", () => {
    expect(extractWordGroups([])).toEqual([]);
  });

  it("returns empty array when no word repeats", () => {
    expect(extractWordGroups(["alpha", "beta", "gamma"])).toEqual([]);
  });

  it("excludes stop words", () => {
    const result = extractWordGroups(["tool for tracking", "tool for monitoring"]);
    expect(result.find((g) => g.word === "for")).toBeUndefined();
    expect(result.find((g) => g.word === "tool")?.count).toBe(2);
  });

  it("excludes app/apps as stop words", () => {
    const result = extractWordGroups(["app tracker", "app monitor"]);
    expect(result.find((g) => g.word === "app")).toBeUndefined();
  });

  it("is case insensitive", () => {
    const result = extractWordGroups(["ChatBot", "chatbot helper"]);
    expect(result.find((g) => g.word === "chatbot")?.count).toBe(2);
  });

  it("sorts by frequency descending then alphabetically", () => {
    const result = extractWordGroups([
      "ai chatbot",
      "ai helpdesk",
      "chatbot helper",
      "smart chatbot",
      "support helpdesk",
    ]);
    expect(result[0]).toEqual({ word: "chatbot", count: 3 });
    expect(result[1]).toEqual({ word: "ai", count: 2 });
    expect(result[2]).toEqual({ word: "helpdesk", count: 2 });
  });

  it("deduplicates words within a single keyword", () => {
    const result = extractWordGroups(["chatbot chatbot", "chatbot"]);
    expect(result.find((g) => g.word === "chatbot")?.count).toBe(2);
  });

  it("excludes single-character words", () => {
    const result = extractWordGroups(["a b test", "x y test"]);
    expect(result).toHaveLength(1);
    expect(result[0].word).toBe("test");
  });

  it("handles keywords with extra whitespace", () => {
    const result = extractWordGroups(["  chatbot  ", "chatbot helper"]);
    expect(result.find((g) => g.word === "chatbot")?.count).toBe(2);
  });
});

describe("filterKeywordsByWord", () => {
  const keywords = [
    { keyword: "ai chatbot" },
    { keyword: "chatbot" },
    { keyword: "smart chatbot" },
    { keyword: "ai helpdesk" },
  ];

  it("filters to keywords containing the word", () => {
    const result = filterKeywordsByWord(keywords, "chatbot");
    expect(result).toHaveLength(3);
  });

  it("uses whole-word matching (not substring)", () => {
    const kws = [{ keyword: "email marketing" }, { keyword: "ai assistant" }];
    const result = filterKeywordsByWord(kws, "ai");
    expect(result).toHaveLength(1);
    expect(result[0].keyword).toBe("ai assistant");
  });

  it("is case insensitive", () => {
    const result = filterKeywordsByWord(keywords, "AI");
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no match", () => {
    const result = filterKeywordsByWord(keywords, "nonexistent");
    expect(result).toEqual([]);
  });

  it("preserves extra properties on keyword objects", () => {
    const kws = [
      { keyword: "ai chatbot", keywordId: 1, slug: "ai-chatbot" },
      { keyword: "chatbot", keywordId: 2, slug: "chatbot" },
    ];
    const result = filterKeywordsByWord(kws, "chatbot");
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty("keywordId", 1);
    expect(result[1]).toHaveProperty("keywordId", 2);
  });
});

describe("constants", () => {
  it("MIN_WORD_FREQUENCY is 2", () => {
    expect(MIN_WORD_FREQUENCY).toBe(2);
  });

  it("STOP_WORDS includes common English words", () => {
    expect(STOP_WORDS.has("the")).toBe(true);
    expect(STOP_WORDS.has("and")).toBe(true);
    expect(STOP_WORDS.has("for")).toBe(true);
  });

  it("STOP_WORDS includes app/apps", () => {
    expect(STOP_WORDS.has("app")).toBe(true);
    expect(STOP_WORDS.has("apps")).toBe(true);
  });
});
