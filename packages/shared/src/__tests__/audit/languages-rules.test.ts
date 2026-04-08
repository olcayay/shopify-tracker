import { describe, it, expect } from "vitest";
import { computeLanguagesSection } from "../../audit/rules/languages.js";

describe("computeLanguagesSection", () => {
  it("scores well for multilingual app", () => {
    const snapshot = {
      languages: ["English", "Spanish", "French", "German", "Portuguese", "Japanese"],
    };
    const result = computeLanguagesSection(snapshot, {}, "shopify");
    expect(result.score).toBe(100);
  });

  it("fails for no languages", () => {
    const result = computeLanguagesSection({}, {}, "shopify");
    const countCheck = result.checks.find((c) => c.id === "lang-count");
    expect(countCheck?.status).toBe("fail");
  });

  it("warns for English-only app", () => {
    const snapshot = { languages: ["English"] };
    const result = computeLanguagesSection(snapshot, {}, "shopify");

    const countCheck = result.checks.find((c) => c.id === "lang-count");
    expect(countCheck?.status).toBe("fail"); // only 1 language

    const enCheck = result.checks.find((c) => c.id === "lang-english");
    expect(enCheck?.status).toBe("pass");

    const esCheck = result.checks.find((c) => c.id === "lang-spanish");
    expect(esCheck?.status).toBe("warning");
  });

  it("detects English even with locale codes", () => {
    const snapshot = { languages: ["en-US", "fr-FR", "de-DE", "es-ES", "pt-BR"] };
    const result = computeLanguagesSection(snapshot, {}, "shopify");

    const enCheck = result.checks.find((c) => c.id === "lang-english");
    expect(enCheck?.status).toBe("pass");

    const frCheck = result.checks.find((c) => c.id === "lang-french");
    expect(frCheck?.status).toBe("pass");
  });

  it("fails English check when missing", () => {
    const snapshot = { languages: ["Spanish", "French"] };
    const result = computeLanguagesSection(snapshot, {}, "shopify");

    const enCheck = result.checks.find((c) => c.id === "lang-english");
    expect(enCheck?.status).toBe("fail");
    expect(enCheck?.impact).toBe("high");
  });

  it("skips individual language checks when no languages at all", () => {
    const result = computeLanguagesSection({}, {}, "shopify");
    // Should only have the count check, not individual language checks
    expect(result.checks.length).toBe(1);
  });
});
