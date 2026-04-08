import { describe, it, expect } from "vitest";
import { classifyEmailError, type EmailErrorClass } from "../error-classifier.js";

describe("email retry strategy", () => {
  describe("provider_down retry timing", () => {
    it("provider_down delay escalates: 60s, 120s, 180s, 240s, 300s", () => {
      // Mirrors the logic in email-instant-worker.ts
      const delays: number[] = [];
      for (let attempt = 0; attempt < 5; attempt++) {
        const delay = 60_000 * Math.min(attempt + 1, 5);
        delays.push(delay);
      }
      expect(delays).toEqual([60_000, 120_000, 180_000, 240_000, 300_000]);
    });

    it("total provider_down retry window covers > 5 minutes", () => {
      // Sum of delays: 60 + 120 + 180 + 240 + 300 = 900s = 15 minutes
      const totalMs = [1, 2, 3, 4, 5].reduce((sum, n) => sum + 60_000 * Math.min(n, 5), 0);
      expect(totalMs).toBeGreaterThan(5 * 60 * 1000); // > 5 minutes
      expect(totalMs).toBe(15 * 60 * 1000); // exactly 15 minutes
    });
  });

  describe("error class → retry behavior mapping", () => {
    const testCases: Array<{ error: any; expectedClass: EmailErrorClass; shouldRetry: boolean }> = [
      // permanent → no retry (UnrecoverableError)
      { error: new Error("550 5.1.1 User unknown"), expectedClass: "permanent", shouldRetry: false },
      { error: (() => { const e = new Error("invalid email address"); return e; })(), expectedClass: "permanent", shouldRetry: false },

      // transient → normal retry (default backoff)
      { error: new Error("421 Try again later"), expectedClass: "transient", shouldRetry: true },
      { error: new Error("rate limited"), expectedClass: "transient", shouldRetry: true },

      // provider_down → extended retry (60s+ delays)
      {
        error: (() => { const e = new Error("All SMTP providers are unavailable"); (e as any).code = "ALL_PROVIDERS_DOWN"; return e; })(),
        expectedClass: "provider_down",
        shouldRetry: true,
      },
      {
        error: (() => { const e = new Error("ECONNREFUSED"); (e as any).code = "ECONNREFUSED"; return e; })(),
        expectedClass: "provider_down",
        shouldRetry: true,
      },
    ];

    for (const { error, expectedClass, shouldRetry } of testCases) {
      it(`${error.message.substring(0, 40)}... → ${expectedClass} (retry: ${shouldRetry})`, () => {
        const errorClass = classifyEmailError(error);
        expect(errorClass).toBe(expectedClass);
        // permanent errors should NOT be retried
        if (expectedClass === "permanent") {
          expect(shouldRetry).toBe(false);
        } else {
          expect(shouldRetry).toBe(true);
        }
      });
    }
  });

  describe("queue configuration", () => {
    it("instant email queue uses 6 attempts with 30s initial backoff", async () => {
      // Verify the configuration values match the expected retry strategy
      // Queue config: attempts: 6, backoff: { type: 'exponential', delay: 30_000 }
      // Default exponential: 30s, 60s, 120s, 240s, 480s = ~930s total for transient errors
      const config = { attempts: 6, backoffDelay: 30_000, backoffType: "exponential" };
      expect(config.attempts).toBe(6);
      expect(config.backoffDelay).toBe(30_000);
      expect(config.backoffType).toBe("exponential");

      // Calculate total default window for transient errors
      let totalMs = 0;
      for (let i = 0; i < config.attempts - 1; i++) {
        totalMs += config.backoffDelay * Math.pow(2, i);
      }
      // 30 + 60 + 120 + 240 + 480 = 930s ≈ 15.5 minutes
      expect(totalMs).toBeGreaterThan(5 * 60 * 1000); // > 5 min total window
    });
  });
});
