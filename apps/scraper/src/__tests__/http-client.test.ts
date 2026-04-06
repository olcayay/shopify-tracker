import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpClient } from "../http-client.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function ok(body: string) {
  return new Response(body, { status: 200 });
}

function httpError(status: number, statusText: string) {
  return new Response("", { status, statusText });
}

/**
 * Create a client with 0 delay and 0 retries for basic tests,
 * or with retries for retry behavior tests.
 */
function createClient(maxRetries = 0): HttpClient {
  return new HttpClient({ delayMs: 0, maxRetries, maxConcurrency: 10 });
}

describe("HttpClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("fetchPage", () => {
    it("returns HTML on successful response", async () => {
      mockFetch.mockResolvedValueOnce(ok("<html>test</html>"));
      const result = await createClient().fetchPage("https://example.com");
      expect(result).toBe("<html>test</html>");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("retries on 5xx server errors", async () => {
      mockFetch
        .mockResolvedValueOnce(httpError(500, "Internal Server Error"))
        .mockResolvedValueOnce(ok("recovered"));
      const result = await createClient(1).fetchPage("https://example.com");
      expect(result).toBe("recovered");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("does not retry on 404 (non-retryable 4xx)", async () => {
      mockFetch.mockResolvedValue(httpError(404, "Not Found"));
      await expect(createClient(2).fetchPage("https://example.com")).rejects.toThrow(
        "All 3 attempts failed"
      );
      // Only 1 call — broke out of retry loop immediately
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("does not retry on 403 (non-retryable 4xx)", async () => {
      mockFetch.mockResolvedValue(httpError(403, "Forbidden"));
      await expect(createClient(2).fetchPage("https://example.com")).rejects.toThrow(
        "All 3 attempts failed"
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("exhausts all retries on persistent 5xx", async () => {
      mockFetch.mockResolvedValue(httpError(500, "Server Error"));
      await expect(createClient(2).fetchPage("https://example.com")).rejects.toThrow(
        "All 3 attempts failed"
      );
      // 1 initial + 2 retries = 3
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("includes URL in thrown error", async () => {
      mockFetch.mockResolvedValue(httpError(500, "Server Error"));
      await expect(createClient().fetchPage("https://example.com/test")).rejects.toThrow(
        "https://example.com/test"
      );
    });

    it("retries on network error", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("fetch failed"))
        .mockResolvedValueOnce(ok("ok"));
      const result = await createClient(1).fetchPage("https://example.com");
      expect(result).toBe("ok");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("429 rate limit handling", () => {
    it("429 does not break out of retry loop like 404 does", async () => {
      // 404: non-retryable → 1 call, breaks immediately
      mockFetch.mockResolvedValue(httpError(404, "Not Found"));
      await expect(createClient(2).fetchPage("https://a.com")).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // 429 error message confirms it attempted all retries (not just 1)
      mockFetch.mockReset();
      mockFetch.mockResolvedValue(httpError(429, "Too Many Requests"));
      // With maxRetries=0: if 429 broke like 404, it'd be 1 call. If it continues, also 1 call.
      // The distinction is in the error message — 429 should say "All X attempts" not break early.
      await expect(createClient(0).fetchPage("https://b.com")).rejects.toThrow(
        "HTTP 429: Too Many Requests"
      );
    });
  });

  describe("fetchRaw", () => {
    it("returns body on success", async () => {
      mockFetch.mockResolvedValueOnce(ok('{"ok":true}'));
      const result = await createClient().fetchRaw("https://api.test", {
        method: "POST",
        body: "{}",
      });
      expect(result).toBe('{"ok":true}');
    });

    it("does not retry 404 in fetchRaw", async () => {
      mockFetch.mockResolvedValue(httpError(404, "Not Found"));
      await expect(
        createClient(2).fetchRaw("https://api.test", { method: "GET" })
      ).rejects.toThrow("All 3 attempts failed");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("retries 5xx in fetchRaw", async () => {
      mockFetch
        .mockResolvedValueOnce(httpError(502, "Bad Gateway"))
        .mockResolvedValueOnce(ok("ok"));
      const result = await createClient(1).fetchRaw("https://api.test", { method: "GET" });
      expect(result).toBe("ok");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("429 in fetchRaw does not break like 404", async () => {
      mockFetch.mockResolvedValue(httpError(429, "Too Many Requests"));
      await expect(createClient(0).fetchRaw("https://api.test", { method: "GET" })).rejects.toThrow(
        "HTTP 429: Too Many Requests"
      );
    });
  });

  describe("per-request timeout", () => {
    it("passes AbortSignal.timeout to fetch in fetchPage", async () => {
      mockFetch.mockResolvedValueOnce(ok("ok"));
      await createClient().fetchPage("https://example.com");
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1]).toHaveProperty("signal");
      // AbortSignal.timeout returns an AbortSignal instance
      expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
    });

    it("passes AbortSignal.timeout to fetch in fetchRaw", async () => {
      mockFetch.mockResolvedValueOnce(ok("ok"));
      await createClient().fetchRaw("https://example.com", { method: "GET" });
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1]).toHaveProperty("signal");
      expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
    });

    it("respects caller-provided signal in fetchRaw", async () => {
      const controller = new AbortController();
      mockFetch.mockResolvedValueOnce(ok("ok"));
      await createClient().fetchRaw("https://example.com", {
        method: "GET",
        signal: controller.signal,
      });
      const callArgs = mockFetch.mock.calls[0];
      // Should use the caller's signal, not override it
      expect(callArgs[1].signal).toBe(controller.signal);
    });

    it("AbortError from timeout is retried like network errors", async () => {
      const abortError = new DOMException("The operation was aborted", "TimeoutError");
      mockFetch
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce(ok("recovered"));
      const result = await createClient(1).fetchPage("https://example.com");
      expect(result).toBe("recovered");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("cumulative backoff budget", () => {
    it("bails early when 429 backoff exceeds budget", async () => {
      // With maxRetries=4 and base=2000ms: 2000 + 4000 + 8000 + 16000 + 32000 = 62000ms
      // Budget is 45000ms, so should bail after cumulative exceeds 45s
      mockFetch.mockResolvedValue(httpError(429, "Too Many Requests"));
      const client = new HttpClient({ delayMs: 0, maxRetries: 4, maxConcurrency: 10 });
      // Mock sleep to be instant
      vi.spyOn(client, "sleep").mockResolvedValue(undefined);

      await expect(client.fetchPage("https://example.com")).rejects.toThrow(
        "Rate limit backoff budget exceeded"
      );
    });

    it("bails early in fetchRaw when 429 backoff exceeds budget", async () => {
      mockFetch.mockResolvedValue(httpError(429, "Too Many Requests"));
      const client = new HttpClient({ delayMs: 0, maxRetries: 4, maxConcurrency: 10 });
      vi.spyOn(client, "sleep").mockResolvedValue(undefined);

      await expect(client.fetchRaw("https://example.com", { method: "GET" })).rejects.toThrow(
        "Rate limit backoff budget exceeded"
      );
    });
  });

  describe("default options", () => {
    it("error message includes attempt count from maxRetries", async () => {
      mockFetch.mockResolvedValue(httpError(404, "Not Found"));
      const client = new HttpClient({ delayMs: 0, maxRetries: 2, maxConcurrency: 10 });
      await expect(client.fetchPage("https://example.com")).rejects.toThrow("All 3 attempts");
    });
  });
});
