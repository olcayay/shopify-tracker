import { describe, it, expect, vi, beforeEach } from "vitest";
import { deliverToWebhook, type WebhookConfig, type WebhookPayload } from "../../notifications/webhook-delivery.js";

const PAYLOAD: WebhookPayload = {
  title: "Ranking Change",
  body: "Your app moved to #1",
  url: "https://appranks.io/shopify/apps/my-app",
  category: "ranking",
  priority: "high",
  timestamp: "2026-04-05T12:00:00Z",
};

describe("deliverToWebhook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("filters by minPriority", async () => {
    const config: WebhookConfig = {
      url: "https://hooks.slack.com/test",
      type: "slack",
      minPriority: "urgent",
    };

    // "high" is below "urgent" — should be filtered out
    const result = await deliverToWebhook(config, { ...PAYLOAD, priority: "high" });
    expect(result.success).toBe(true); // filtered = not an error
  });

  it("filters by category", async () => {
    const config: WebhookConfig = {
      url: "https://hooks.slack.com/test",
      type: "slack",
      categories: ["competitor"],
    };

    // "ranking" not in categories → filtered
    const result = await deliverToWebhook(config, PAYLOAD);
    expect(result.success).toBe(true);
  });

  it("passes category filter when category matches", async () => {
    const config: WebhookConfig = {
      url: "https://hooks.slack.com/test",
      type: "slack",
      categories: ["ranking", "competitor"],
    };

    // Mock fetch to succeed
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    const result = await deliverToWebhook(config, PAYLOAD);
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it("returns error on HTTP failure", async () => {
    const config: WebhookConfig = {
      url: "https://hooks.slack.com/test",
      type: "slack",
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const result = await deliverToWebhook(config, PAYLOAD);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
  });

  it("returns error on network failure", async () => {
    const config: WebhookConfig = {
      url: "https://hooks.slack.com/test",
      type: "custom",
    };

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const result = await deliverToWebhook(config, PAYLOAD);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");
  });

  it("sends correct Slack payload format", async () => {
    const config: WebhookConfig = { url: "https://hooks.slack.com/test", type: "slack" };
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    await deliverToWebhook(config, PAYLOAD);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.text).toContain("Ranking Change");
    expect(body.blocks).toBeDefined();
    expect(body.blocks[0].type).toBe("section");
  });

  it("sends correct Discord payload format", async () => {
    const config: WebhookConfig = { url: "https://discord.com/api/webhooks/test", type: "discord" };
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    await deliverToWebhook(config, PAYLOAD);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.embeds).toBeDefined();
    expect(body.embeds[0].title).toBe("Ranking Change");
    expect(body.embeds[0].color).toBeDefined();
  });

  it("sends custom payload format with source field", async () => {
    const config: WebhookConfig = { url: "https://example.com/webhook", type: "custom" };
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    await deliverToWebhook(config, PAYLOAD);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.source).toBe("appranks");
    expect(body.title).toBe("Ranking Change");
  });

  it("includes auth header when configured", async () => {
    const config: WebhookConfig = {
      url: "https://example.com/webhook",
      type: "custom",
      authHeader: "Bearer token123",
    };
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    await deliverToWebhook(config, PAYLOAD);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer token123");
  });
});
