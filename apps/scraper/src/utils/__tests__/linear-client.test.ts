import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to test the module with different env states, so we re-import
describe("linear-client", () => {
  const originalKey = process.env.LINEAR_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey) {
      process.env.LINEAR_API_KEY = originalKey;
    } else {
      delete process.env.LINEAR_API_KEY;
    }
    global.fetch = originalFetch;
    vi.resetModules();
  });

  describe("createLinearIssue", () => {
    it("returns null when LINEAR_API_KEY is not set", async () => {
      delete process.env.LINEAR_API_KEY;
      const { createLinearIssue } = await import("../linear-client.js");
      const result = await createLinearIssue({
        title: "Test",
        description: "Test",
        labelIds: [],
        priority: 3,
      });
      expect(result).toBeNull();
    });

    it("calls Linear GraphQL API and returns issue details", async () => {
      process.env.LINEAR_API_KEY = "lin_api_test";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            issueCreate: {
              success: true,
              issue: { id: "abc", identifier: "PLA-42", url: "https://linear.app/issue/PLA-42" },
            },
          },
        }),
      }) as any;

      const { createLinearIssue } = await import("../linear-client.js");
      const result = await createLinearIssue({
        title: "Test issue",
        description: "Some desc",
        labelIds: ["label-1"],
        priority: 2,
      });

      expect(result).toEqual({
        id: "abc",
        identifier: "PLA-42",
        url: "https://linear.app/issue/PLA-42",
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, opts] = (global.fetch as any).mock.calls[0];
      expect(url).toBe("https://api.linear.app/graphql");
      expect(opts.headers.Authorization).toBe("lin_api_test");
      const body = JSON.parse(opts.body);
      expect(body.variables.input.title).toBe("Test issue");
      expect(body.variables.input.priority).toBe(2);
    });

    it("returns null on API error without throwing", async () => {
      process.env.LINEAR_API_KEY = "lin_api_test";
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      }) as any;

      const { createLinearIssue } = await import("../linear-client.js");
      const result = await createLinearIssue({
        title: "Test",
        description: "Test",
        labelIds: [],
        priority: 3,
      });
      expect(result).toBeNull();
    });

    it("returns null on GraphQL errors without throwing", async () => {
      process.env.LINEAR_API_KEY = "lin_api_test";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          errors: [{ message: "Invalid input" }],
        }),
      }) as any;

      const { createLinearIssue } = await import("../linear-client.js");
      const result = await createLinearIssue({
        title: "Test",
        description: "Test",
        labelIds: [],
        priority: 3,
      });
      expect(result).toBeNull();
    });
  });

  describe("ensureScrapingErrorLabel", () => {
    it("returns null when LINEAR_API_KEY is not set", async () => {
      delete process.env.LINEAR_API_KEY;
      const { ensureScrapingErrorLabel } = await import("../linear-client.js");
      const result = await ensureScrapingErrorLabel();
      expect(result).toBeNull();
    });

    it("returns existing label ID if found", async () => {
      process.env.LINEAR_API_KEY = "lin_api_test";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            team: {
              labels: {
                nodes: [{ id: "existing-label-id", name: "scraping-error" }],
              },
            },
          },
        }),
      }) as any;

      const { ensureScrapingErrorLabel } = await import("../linear-client.js");
      const result = await ensureScrapingErrorLabel();
      expect(result).toBe("existing-label-id");
    });

    it("creates label if not found", async () => {
      process.env.LINEAR_API_KEY = "lin_api_test";
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: label search — not found
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              data: { team: { labels: { nodes: [] } } },
            }),
          });
        }
        // Second call: label creation
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              issueLabelCreate: {
                success: true,
                issueLabel: { id: "new-label-id" },
              },
            },
          }),
        });
      }) as any;

      const { ensureScrapingErrorLabel } = await import("../linear-client.js");
      const result = await ensureScrapingErrorLabel();
      expect(result).toBe("new-label-id");
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
