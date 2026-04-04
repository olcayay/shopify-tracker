import { describe, it, expect, vi, beforeEach } from "vitest";

// Test the pure parsing functions directly
const {
  parseGenericPayload,
  parseSesPayload,
  parseSendgridPayload,
} = await import("../../routes/email-webhooks.js");

describe("email webhook parsers", () => {
  describe("parseGenericPayload", () => {
    it("parses valid hard_bounce payload", () => {
      const result = parseGenericPayload({
        email: "test@example.com",
        type: "hard_bounce",
        messageId: "msg-123",
        diagnosticCode: "550 User unknown",
      });
      expect(result).toEqual({
        email: "test@example.com",
        type: "hard_bounce",
        messageId: "msg-123",
        diagnosticCode: "550 User unknown",
        timestamp: undefined,
      });
    });

    it("parses complaint payload", () => {
      const result = parseGenericPayload({
        email: "user@test.com",
        type: "complaint",
      });
      expect(result?.type).toBe("complaint");
    });

    it("parses delivery payload", () => {
      const result = parseGenericPayload({
        email: "user@test.com",
        type: "delivery",
      });
      expect(result?.type).toBe("delivery");
    });

    it("parses snake_case field names", () => {
      const result = parseGenericPayload({
        email: "test@example.com",
        type: "soft_bounce",
        message_id: "msg-456",
        diagnostic_code: "451 Try later",
      });
      expect(result?.messageId).toBe("msg-456");
      expect(result?.diagnosticCode).toBe("451 Try later");
    });

    it("returns null for missing email", () => {
      expect(parseGenericPayload({ type: "hard_bounce" })).toBeNull();
    });

    it("returns null for missing type", () => {
      expect(parseGenericPayload({ email: "test@example.com" })).toBeNull();
    });

    it("returns null for invalid type", () => {
      expect(parseGenericPayload({ email: "test@example.com", type: "invalid" })).toBeNull();
    });

    it("returns null for empty body", () => {
      expect(parseGenericPayload(null)).toBeNull();
      expect(parseGenericPayload(undefined)).toBeNull();
    });
  });

  describe("parseSesPayload", () => {
    it("parses SES permanent bounce", () => {
      const result = parseSesPayload({
        notificationType: "Bounce",
        bounce: {
          bounceType: "Permanent",
          bouncedRecipients: [
            { emailAddress: "bad@example.com", diagnosticCode: "550" },
          ],
          timestamp: "2026-01-01T00:00:00Z",
        },
        mail: { messageId: "ses-msg-123" },
      });
      expect(result).toEqual({
        email: "bad@example.com",
        type: "hard_bounce",
        messageId: "ses-msg-123",
        diagnosticCode: "550",
        timestamp: "2026-01-01T00:00:00Z",
      });
    });

    it("parses SES transient bounce as soft_bounce", () => {
      const result = parseSesPayload({
        notificationType: "Bounce",
        bounce: {
          bounceType: "Transient",
          bouncedRecipients: [{ emailAddress: "temp@example.com" }],
        },
        mail: { messageId: "ses-msg-456" },
      });
      expect(result?.type).toBe("soft_bounce");
    });

    it("parses SES complaint", () => {
      const result = parseSesPayload({
        notificationType: "Complaint",
        complaint: {
          complainedRecipients: [{ emailAddress: "spam@example.com" }],
          complaintFeedbackType: "abuse",
          timestamp: "2026-01-01T00:00:00Z",
        },
        mail: { messageId: "ses-msg-789" },
      });
      expect(result?.type).toBe("complaint");
      expect(result?.email).toBe("spam@example.com");
      expect(result?.diagnosticCode).toBe("abuse");
    });

    it("parses SES delivery", () => {
      const result = parseSesPayload({
        notificationType: "Delivery",
        delivery: {
          recipients: ["ok@example.com"],
          timestamp: "2026-01-01T00:00:00Z",
        },
        mail: { messageId: "ses-msg-100" },
      });
      expect(result?.type).toBe("delivery");
      expect(result?.email).toBe("ok@example.com");
    });

    it("parses SES SNS wrapped message", () => {
      const innerMessage = JSON.stringify({
        notificationType: "Bounce",
        bounce: {
          bounceType: "Permanent",
          bouncedRecipients: [{ emailAddress: "wrapped@example.com" }],
        },
        mail: { messageId: "wrapped-123" },
      });
      const result = parseSesPayload({ Message: innerMessage });
      expect(result?.email).toBe("wrapped@example.com");
      expect(result?.type).toBe("hard_bounce");
    });

    it("returns null for unknown notification type", () => {
      expect(parseSesPayload({ notificationType: "Unknown" })).toBeNull();
    });

    it("returns null for bounce with no recipients", () => {
      expect(parseSesPayload({
        notificationType: "Bounce",
        bounce: { bounceType: "Permanent", bouncedRecipients: [] },
      })).toBeNull();
    });
  });

  describe("parseSendgridPayload", () => {
    it("parses SendGrid bounce event", () => {
      const events = parseSendgridPayload([
        { event: "bounce", email: "bounced@example.com", reason: "550 User unknown", sg_message_id: "sg-123.filter" },
      ]);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        email: "bounced@example.com",
        type: "hard_bounce",
        messageId: "sg-123",
        diagnosticCode: "550 User unknown",
        timestamp: undefined,
      });
    });

    it("parses SendGrid deferred as soft_bounce", () => {
      const events = parseSendgridPayload([
        { event: "deferred", email: "slow@example.com", response: "451 Try later" },
      ]);
      expect(events[0].type).toBe("soft_bounce");
    });

    it("parses SendGrid spamreport as complaint", () => {
      const events = parseSendgridPayload([
        { event: "spamreport", email: "spam@example.com" },
      ]);
      expect(events[0].type).toBe("complaint");
    });

    it("parses SendGrid delivered event", () => {
      const events = parseSendgridPayload([
        { event: "delivered", email: "ok@example.com" },
      ]);
      expect(events[0].type).toBe("delivery");
    });

    it("parses multiple events in one payload", () => {
      const events = parseSendgridPayload([
        { event: "bounce", email: "a@example.com" },
        { event: "delivered", email: "b@example.com" },
        { event: "spamreport", email: "c@example.com" },
      ]);
      expect(events).toHaveLength(3);
    });

    it("skips unknown event types", () => {
      const events = parseSendgridPayload([
        { event: "open", email: "a@example.com" },
        { event: "click", email: "b@example.com" },
      ]);
      expect(events).toHaveLength(0);
    });

    it("skips events without email", () => {
      const events = parseSendgridPayload([
        { event: "bounce" },
      ]);
      expect(events).toHaveLength(0);
    });

    it("handles non-array payload", () => {
      const events = parseSendgridPayload(
        { event: "bounce", email: "single@example.com" },
      );
      expect(events).toHaveLength(1);
    });

    it("parses timestamp correctly", () => {
      const events = parseSendgridPayload([
        { event: "bounce", email: "a@example.com", timestamp: 1704067200 },
      ]);
      expect(events[0].timestamp).toBe("2024-01-01T00:00:00.000Z");
    });
  });
});
