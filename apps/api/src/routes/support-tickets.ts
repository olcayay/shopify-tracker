import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  supportTickets,
  supportTicketMessages,
  users,
} from "@appranks/db";
import { requireRole } from "../middleware/authorize.js";

/** Classify a DB error into a user-safe diagnostic code */
function dbErrorCode(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("does not exist")) return "TABLE_OR_COLUMN_MISSING";
  if (msg.includes("connection") || msg.includes("ECONNREFUSED")) return "DB_CONNECTION";
  if (msg.includes("timeout")) return "DB_TIMEOUT";
  if (msg.includes("violates") || msg.includes("constraint")) return "CONSTRAINT_VIOLATION";
  if (msg.includes("permission denied")) return "DB_PERMISSION";
  return "DB_ERROR";
}

export const supportTicketRoutes: FastifyPluginAsync = async (app) => {
  const db = app.writeDb;

  // POST /api/support-tickets — create ticket + first message
  app.post(
    "/",
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const { type, subject, body } = request.body as {
        type: string;
        subject: string;
        body: string;
      };

      if (!type || !subject || !body) {
        return reply.code(400).send({ error: "type, subject, and body are required" });
      }

      const validTypes = [
        "bug_report", "feature_request", "general_inquiry", "billing_payments",
        "account_access", "data_integration", "partnership", "security_concern",
      ];
      if (!validTypes.includes(type)) {
        return reply.code(400).send({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
      }

      try {
        const result = await db.transaction(async (tx) => {
          const [ticket] = await tx
            .insert(supportTickets)
            .values({
              accountId,
              createdByUserId: userId,
              type,
              subject: subject.trim(),
              status: "open",
              priority: "normal",
              lastMessageAt: new Date(),
            })
            .returning();

          const [message] = await tx
            .insert(supportTicketMessages)
            .values({
              ticketId: ticket.id,
              userId,
              body: body.trim(),
            })
            .returning();

          return { ticket, message };
        });

        return reply.code(201).send(result.ticket);
      } catch (err) {
        request.log.error({ err, accountId }, "Failed to create support ticket");
        return reply.code(503).send({ error: "Failed to create ticket. Please try again.", code: dbErrorCode(err) });
      }
    }
  );

  // GET /api/support-tickets — list account tickets
  app.get(
    "/",
    async (request, reply) => {
      const { accountId } = request.user;
      const {
        status,
        type,
        limit: limitStr = "25",
        cursor,
      } = request.query as {
        status?: string;
        type?: string;
        limit?: string;
        cursor?: string;
      };

      const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 25));

      const conditions = [eq(supportTickets.accountId, accountId)];
      if (status) conditions.push(eq(supportTickets.status, status));
      if (type) conditions.push(eq(supportTickets.type, type));
      if (cursor) {
        conditions.push(sql`${supportTickets.lastMessageAt} < ${new Date(cursor)}`);
      }

      try {
        const tickets = await db
          .select({
            id: supportTickets.id,
            ticketNumber: supportTickets.ticketNumber,
            type: supportTickets.type,
            subject: supportTickets.subject,
            status: supportTickets.status,
            priority: supportTickets.priority,
            lastMessageAt: supportTickets.lastMessageAt,
            resolvedAt: supportTickets.resolvedAt,
            closedAt: supportTickets.closedAt,
            createdAt: supportTickets.createdAt,
            createdByName: users.name,
            createdByEmail: users.email,
          })
          .from(supportTickets)
          .leftJoin(users, eq(supportTickets.createdByUserId, users.id))
          .where(and(...conditions))
          .orderBy(desc(supportTickets.lastMessageAt))
          .limit(limit + 1);

        const hasMore = tickets.length > limit;
        const items = hasMore ? tickets.slice(0, limit) : tickets;
        const nextCursor = hasMore && items.length > 0
          ? items[items.length - 1].lastMessageAt?.toISOString()
          : null;

        return { items, nextCursor };
      } catch (err) {
        request.log.error({ err, accountId }, "Failed to list support tickets");
        return reply.code(503).send({ error: "Failed to load support tickets. Please try again.", code: dbErrorCode(err) });
      }
    }
  );

  // GET /api/support-tickets/:ticketId — ticket detail + messages
  app.get<{ Params: { ticketId: string } }>(
    "/:ticketId",
    async (request, reply) => {
      const { accountId } = request.user;
      const { ticketId } = request.params;

      try {
        const [ticket] = await db
          .select()
          .from(supportTickets)
          .where(
            and(
              eq(supportTickets.id, ticketId),
              eq(supportTickets.accountId, accountId)
            )
          );

        if (!ticket) {
          return reply.code(404).send({ error: "Ticket not found" });
        }

        const messages = await db
          .select({
            id: supportTicketMessages.id,
            body: supportTicketMessages.body,
            isInternalNote: supportTicketMessages.isInternalNote,
            isSystemMessage: supportTicketMessages.isSystemMessage,
            createdAt: supportTicketMessages.createdAt,
            userName: users.name,
            userEmail: users.email,
            userId: supportTicketMessages.userId,
          })
          .from(supportTicketMessages)
          .leftJoin(users, eq(supportTicketMessages.userId, users.id))
          .where(
            and(
              eq(supportTicketMessages.ticketId, ticketId),
              eq(supportTicketMessages.isInternalNote, false)
            )
          )
          .orderBy(supportTicketMessages.createdAt);

        return { ticket, messages };
      } catch (err) {
        request.log.error({ err, ticketId, accountId }, "Failed to get support ticket detail");
        return reply.code(503).send({ error: "Failed to load ticket. Please try again.", code: dbErrorCode(err) });
      }
    }
  );

  // POST /api/support-tickets/:ticketId/messages — reply to ticket
  app.post<{ Params: { ticketId: string } }>(
    "/:ticketId/messages",
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const { ticketId } = request.params;
      const { body } = request.body as { body: string };

      if (!body?.trim()) {
        return reply.code(400).send({ error: "body is required" });
      }

      try {
        const [ticket] = await db
          .select({ id: supportTickets.id, status: supportTickets.status })
          .from(supportTickets)
          .where(
            and(
              eq(supportTickets.id, ticketId),
              eq(supportTickets.accountId, accountId)
            )
          );

        if (!ticket) {
          return reply.code(404).send({ error: "Ticket not found" });
        }

        if (ticket.status === "closed") {
          return reply.code(400).send({ error: "Cannot reply to a closed ticket" });
        }

        const [message] = await db
          .insert(supportTicketMessages)
          .values({
            ticketId,
            userId,
            body: body.trim(),
          })
          .returning();

        // Update ticket: set last_message_at, reopen if resolved
        const updates: Record<string, unknown> = {
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        };
        if (ticket.status === "resolved") {
          updates.status = "open";
          updates.resolvedAt = null;
        }
        await db
          .update(supportTickets)
          .set(updates)
          .where(eq(supportTickets.id, ticketId));

        return reply.code(201).send(message);
      } catch (err) {
        request.log.error({ err, ticketId }, "Failed to reply to support ticket");
        return reply.code(503).send({ error: "Failed to send reply. Please try again.", code: dbErrorCode(err) });
      }
    }
  );

  // POST /api/support-tickets/:ticketId/close — close ticket
  app.post<{ Params: { ticketId: string } }>(
    "/:ticketId/close",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { ticketId } = request.params;

      try {
        const [ticket] = await db
          .select({ id: supportTickets.id, status: supportTickets.status })
          .from(supportTickets)
          .where(
            and(
              eq(supportTickets.id, ticketId),
              eq(supportTickets.accountId, accountId)
            )
          );

        if (!ticket) {
          return reply.code(404).send({ error: "Ticket not found" });
        }

        if (ticket.status === "closed") {
          return reply.code(400).send({ error: "Ticket is already closed" });
        }

        await db
          .update(supportTickets)
          .set({
            status: "closed",
            closedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(supportTickets.id, ticketId));

        return { message: "Ticket closed" };
      } catch (err) {
        request.log.error({ err, ticketId }, "Failed to close support ticket");
        return reply.code(503).send({ error: "Failed to close ticket. Please try again.", code: dbErrorCode(err) });
      }
    }
  );
};
