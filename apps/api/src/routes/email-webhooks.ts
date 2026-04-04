/**
 * Email provider webhook endpoints for bounce/complaint/delivery notifications.
 *
 * Supports:
 * - Generic JSON format (default)
 * - AWS SES SNS notification format
 * - SendGrid Event Webhook format
 *
 * Secured via HMAC signature verification (WEBHOOK_EMAIL_SECRET env var).
 */
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { createHmac } from "crypto";
import { eq, sql } from "drizzle-orm";
import { emailSuppressionList, emailLogs } from "@appranks/db";
import { createLogger } from "@appranks/shared";

const log = createLogger("email-webhooks");

type BounceType = "hard_bounce" | "soft_bounce" | "complaint" | "delivery";

interface ParsedEvent {
  email: string;
  type: BounceType;
  messageId?: string;
  diagnosticCode?: string;
  timestamp?: string;
}

const SOFT_BOUNCE_SUPPRESS_THRESHOLD = 3;

// ── Payload parsers ────────────────────────────────────────────────

function parseGenericPayload(body: any): ParsedEvent | null {
  if (!body?.email || !body?.type) return null;
  const validTypes: BounceType[] = ["hard_bounce", "soft_bounce", "complaint", "delivery"];
  if (!validTypes.includes(body.type)) return null;
  return {
    email: body.email,
    type: body.type,
    messageId: body.messageId || body.message_id,
    diagnosticCode: body.diagnosticCode || body.diagnostic_code,
    timestamp: body.timestamp,
  };
}

function parseSesPayload(body: any): ParsedEvent | null {
  const message = typeof body.Message === "string" ? JSON.parse(body.Message) : body;
  const notifType = message.notificationType || message.eventType;

  if (notifType === "Bounce") {
    const bounce = message.bounce;
    if (!bounce?.bouncedRecipients?.[0]) return null;
    const recipient = bounce.bouncedRecipients[0];
    return {
      email: recipient.emailAddress,
      type: bounce.bounceType === "Permanent" ? "hard_bounce" : "soft_bounce",
      messageId: message.mail?.messageId,
      diagnosticCode: recipient.diagnosticCode,
      timestamp: bounce.timestamp,
    };
  }

  if (notifType === "Complaint") {
    const complaint = message.complaint;
    if (!complaint?.complainedRecipients?.[0]) return null;
    return {
      email: complaint.complainedRecipients[0].emailAddress,
      type: "complaint",
      messageId: message.mail?.messageId,
      diagnosticCode: complaint.complaintFeedbackType,
      timestamp: complaint.timestamp,
    };
  }

  if (notifType === "Delivery") {
    const delivery = message.delivery;
    if (!delivery?.recipients?.[0]) return null;
    return {
      email: delivery.recipients[0],
      type: "delivery",
      messageId: message.mail?.messageId,
      timestamp: delivery.timestamp,
    };
  }

  return null;
}

function parseSendgridPayload(body: any): ParsedEvent[] {
  const events = Array.isArray(body) ? body : [body];
  const parsed: ParsedEvent[] = [];

  for (const evt of events) {
    const typeMap: Record<string, BounceType> = {
      bounce: "hard_bounce",
      blocked: "soft_bounce",
      deferred: "soft_bounce",
      spamreport: "complaint",
      delivered: "delivery",
    };

    const bounceType = typeMap[evt.event];
    if (!bounceType || !evt.email) continue;

    parsed.push({
      email: evt.email,
      type: bounceType,
      messageId: evt.sg_message_id?.split(".")?.[0],
      diagnosticCode: evt.reason || evt.response,
      timestamp: evt.timestamp ? new Date(evt.timestamp * 1000).toISOString() : undefined,
    });
  }

  return parsed;
}

// ── Signature verification ─────────────────────────────────────────

function verifySignature(request: FastifyRequest): boolean {
  const secret = process.env.WEBHOOK_EMAIL_SECRET;
  if (!secret) return true; // Allow if no secret configured (dev mode)

  const signature = request.headers["x-webhook-signature"] as string;
  if (!signature) return false;

  const rawBody = JSON.stringify(request.body);
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return signature === expected;
}

// ── Bounce processing ──────────────────────────────────────────────

async function processBounceEvent(db: any, event: ParsedEvent): Promise<{ suppressed: boolean; action: string }> {
  const normalizedEmail = event.email.toLowerCase().trim();

  // Update email log if messageId provided
  if (event.messageId) {
    try {
      const statusMap: Record<BounceType, string> = {
        hard_bounce: "bounced",
        soft_bounce: "bounced",
        complaint: "complained",
        delivery: "delivered",
      };
      await db
        .update(emailLogs)
        .set({
          status: statusMap[event.type],
          ...(event.type !== "delivery" && {
            errorMessage: event.diagnosticCode || event.type,
            bouncedAt: new Date(),
          }),
          ...(event.type === "delivery" && { sentAt: new Date() }),
        })
        .where(eq(emailLogs.messageId, event.messageId));
    } catch (err) {
      log.warn("failed to update email log", { error: String(err) });
    }
  }

  if (event.type === "delivery") {
    return { suppressed: false, action: "delivery_confirmed" };
  }

  // Check existing suppression
  const [existing] = await db
    .select()
    .from(emailSuppressionList)
    .where(eq(emailSuppressionList.email, normalizedEmail))
    .limit(1);

  if (event.type === "hard_bounce" || event.type === "complaint") {
    if (existing && !existing.removedAt) {
      await db
        .update(emailSuppressionList)
        .set({
          bounceCount: sql`${emailSuppressionList.bounceCount} + 1`,
          lastBounceAt: new Date(),
          reason: event.type,
          diagnosticCode: event.diagnosticCode || existing.diagnosticCode,
        })
        .where(eq(emailSuppressionList.id, existing.id));
    } else if (existing && existing.removedAt) {
      await db
        .update(emailSuppressionList)
        .set({
          bounceCount: existing.bounceCount + 1,
          lastBounceAt: new Date(),
          reason: event.type,
          source: "webhook",
          diagnosticCode: event.diagnosticCode,
          removedAt: null,
          removedBy: null,
        })
        .where(eq(emailSuppressionList.id, existing.id));
    } else {
      await db.insert(emailSuppressionList).values({
        email: normalizedEmail,
        reason: event.type,
        source: "webhook",
        bounceCount: 1,
        lastBounceAt: new Date(),
        diagnosticCode: event.diagnosticCode,
      });
    }

    log.info("address suppressed", { email: normalizedEmail, reason: event.type });
    return { suppressed: true, action: `${event.type}_suppressed` };
  }

  if (event.type === "soft_bounce") {
    const newCount = (existing?.bounceCount ?? 0) + 1;

    if (existing) {
      await db
        .update(emailSuppressionList)
        .set({
          bounceCount: newCount,
          lastBounceAt: new Date(),
          reason: "soft_bounce",
          diagnosticCode: event.diagnosticCode || existing.diagnosticCode,
          ...(existing.removedAt ? { removedAt: null, removedBy: null, source: "webhook" } : {}),
        })
        .where(eq(emailSuppressionList.id, existing.id));
    } else {
      await db.insert(emailSuppressionList).values({
        email: normalizedEmail,
        reason: "soft_bounce",
        source: "automatic",
        bounceCount: 1,
        lastBounceAt: new Date(),
        diagnosticCode: event.diagnosticCode,
      });
    }

    if (newCount >= SOFT_BOUNCE_SUPPRESS_THRESHOLD) {
      return { suppressed: true, action: "soft_bounce_threshold_suppressed" };
    }
    return { suppressed: false, action: "soft_bounce_tracked" };
  }

  return { suppressed: false, action: "unknown_type" };
}

// ── Routes ─────────────────────────────────────────────────────────

export const emailWebhookRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // POST /api/webhooks/email/bounce
  app.post("/bounce", async (request, reply) => {
    if (!verifySignature(request)) {
      return reply.code(401).send({ error: "Invalid signature" });
    }
    const event = parseGenericPayload(request.body);
    if (!event) {
      return reply.code(400).send({ error: "Invalid payload — requires email and type" });
    }
    const result = await processBounceEvent(db, event);
    return reply.send(result);
  });

  // POST /api/webhooks/email/complaint
  app.post("/complaint", async (request, reply) => {
    if (!verifySignature(request)) {
      return reply.code(401).send({ error: "Invalid signature" });
    }
    const body = request.body as any;
    if (!body?.email) {
      return reply.code(400).send({ error: "Missing email field" });
    }
    const result = await processBounceEvent(db, {
      email: body.email,
      type: "complaint",
      messageId: body.messageId || body.message_id,
      diagnosticCode: body.reason || body.diagnosticCode,
      timestamp: body.timestamp,
    });
    return reply.send(result);
  });

  // POST /api/webhooks/email/delivery
  app.post("/delivery", async (request, reply) => {
    if (!verifySignature(request)) {
      return reply.code(401).send({ error: "Invalid signature" });
    }
    const body = request.body as any;
    if (!body?.email) {
      return reply.code(400).send({ error: "Missing email field" });
    }
    const result = await processBounceEvent(db, {
      email: body.email,
      type: "delivery",
      messageId: body.messageId || body.message_id,
      timestamp: body.timestamp,
    });
    return reply.send(result);
  });

  // POST /api/webhooks/email/ses — AWS SES SNS
  app.post("/ses", async (request, reply) => {
    const body = request.body as any;
    if (body.Type === "SubscriptionConfirmation") {
      log.info("SES SNS subscription confirmation", { subscribeUrl: body.SubscribeURL });
      try {
        await fetch(body.SubscribeURL);
        return reply.send({ message: "Subscription confirmed" });
      } catch (err) {
        return reply.code(500).send({ error: "Failed to confirm subscription" });
      }
    }
    const event = parseSesPayload(body);
    if (!event) {
      return reply.code(400).send({ error: "Could not parse SES notification" });
    }
    const result = await processBounceEvent(db, event);
    return reply.send(result);
  });

  // POST /api/webhooks/email/sendgrid — SendGrid Event Webhook
  app.post("/sendgrid", async (request, reply) => {
    const events = parseSendgridPayload(request.body);
    if (events.length === 0) {
      return reply.code(400).send({ error: "No valid events in payload" });
    }
    const results = [];
    for (const event of events) {
      results.push(await processBounceEvent(db, event));
    }
    return reply.send({ processed: results.length, results });
  });
};

// Export for testing
export { parseGenericPayload, parseSesPayload, parseSendgridPayload, verifySignature, processBounceEvent };
