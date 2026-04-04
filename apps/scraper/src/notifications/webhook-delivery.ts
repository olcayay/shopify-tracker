/**
 * Webhook/external delivery for notifications (PLA-700).
 * Send notifications to Slack, Discord, or custom webhook URLs.
 */
import { createLogger } from "@appranks/shared";

const log = createLogger("notification:webhook");

export interface WebhookConfig {
  url: string;
  type: "slack" | "discord" | "custom";
  /** Optional authorization header */
  authHeader?: string;
  /** Only send notifications of these categories (empty = all) */
  categories?: string[];
  /** Minimum priority to send ("low" | "normal" | "high" | "urgent") */
  minPriority?: string;
}

export interface WebhookPayload {
  title: string;
  body: string;
  url?: string;
  category?: string;
  priority?: string;
  timestamp: string;
}

const PRIORITY_ORDER: Record<string, number> = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3,
};

/**
 * Build a Slack webhook payload.
 */
function buildSlackPayload(payload: WebhookPayload): Record<string, unknown> {
  const emoji = payload.priority === "urgent" ? ":rotating_light:" :
    payload.priority === "high" ? ":warning:" : ":bell:";

  return {
    text: `${emoji} *${payload.title}*\n${payload.body}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *${payload.title}*\n${payload.body}`,
        },
      },
      ...(payload.url ? [{
        type: "actions",
        elements: [{
          type: "button",
          text: { type: "plain_text", text: "View in AppRanks" },
          url: payload.url,
        }],
      }] : []),
    ],
  };
}

/**
 * Build a Discord webhook payload.
 */
function buildDiscordPayload(payload: WebhookPayload): Record<string, unknown> {
  const color = payload.priority === "urgent" ? 0xff0000 :
    payload.priority === "high" ? 0xffa500 : 0x3b82f6;

  return {
    embeds: [{
      title: payload.title,
      description: payload.body,
      color,
      url: payload.url,
      timestamp: payload.timestamp,
      footer: { text: `AppRanks • ${payload.category || "notification"}` },
    }],
  };
}

/**
 * Send a notification to a webhook.
 */
export async function deliverToWebhook(
  config: WebhookConfig,
  payload: WebhookPayload
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  // Check priority filter
  if (config.minPriority) {
    const minOrder = PRIORITY_ORDER[config.minPriority] ?? 0;
    const payloadOrder = PRIORITY_ORDER[payload.priority || "normal"] ?? 1;
    if (payloadOrder < minOrder) {
      return { success: true }; // Filtered out — not an error
    }
  }

  // Check category filter
  if (config.categories && config.categories.length > 0 && payload.category) {
    if (!config.categories.includes(payload.category)) {
      return { success: true }; // Filtered out
    }
  }

  // Build provider-specific payload
  let body: Record<string, unknown>;
  switch (config.type) {
    case "slack":
      body = buildSlackPayload(payload);
      break;
    case "discord":
      body = buildDiscordPayload(payload);
      break;
    case "custom":
    default:
      body = { ...payload, source: "appranks" };
      break;
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.authHeader) {
      headers["Authorization"] = config.authHeader;
    }

    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      log.warn("webhook delivery failed", {
        url: config.url,
        type: config.type,
        statusCode: response.status,
      });
      return { success: false, statusCode: response.status, error: `HTTP ${response.status}` };
    }

    log.info("webhook delivered", { url: config.url, type: config.type });
    return { success: true, statusCode: response.status };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error("webhook delivery error", { url: config.url, error });
    return { success: false, error };
  }
}
