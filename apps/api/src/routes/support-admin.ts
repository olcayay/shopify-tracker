import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import {
  supportTickets,
  supportTicketMessages,
  users,
  accounts,
} from "@appranks/db";
import { requireSystemAdmin } from "../middleware/authorize.js";

export const supportAdminRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // All routes require system admin
  app.addHook("preHandler", requireSystemAdmin());

  // GET /api/system-admin/support-tickets — list all tickets
  app.get(
    "/",
    async (request) => {
      const {
        status,
        type,
        priority,
        assignedTo,
        search,
        limit: limitStr = "25",
        cursor,
      } = request.query as {
        status?: string;
        type?: string;
        priority?: string;
        assignedTo?: string;
        search?: string;
        limit?: string;
        cursor?: string;
      };

      const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 25));

      const conditions: ReturnType<typeof sql>[] = [];
      if (status) conditions.push(sql`${supportTickets.status} = ${status}`);
      if (type) conditions.push(sql`${supportTickets.type} = ${type}`);
      if (priority) conditions.push(sql`${supportTickets.priority} = ${priority}`);
      if (assignedTo) conditions.push(sql`${supportTickets.assignedAdminId} = ${assignedTo}`);
      if (search) {
        conditions.push(sql`(
          ${supportTickets.subject} ILIKE ${`%${search}%`}
          OR CAST(${supportTickets.ticketNumber} AS TEXT) = ${search}
        )`);
      }
      if (cursor) {
        conditions.push(sql`${supportTickets.lastMessageAt} < ${new Date(cursor)}`);
      }

      const whereClause = conditions.length > 0
        ? and(...conditions.map((c) => c))
        : undefined;

      const tickets = await db
        .select({
          id: supportTickets.id,
          ticketNumber: supportTickets.ticketNumber,
          type: supportTickets.type,
          subject: supportTickets.subject,
          status: supportTickets.status,
          priority: supportTickets.priority,
          assignedAdminId: supportTickets.assignedAdminId,
          lastMessageAt: supportTickets.lastMessageAt,
          resolvedAt: supportTickets.resolvedAt,
          closedAt: supportTickets.closedAt,
          createdAt: supportTickets.createdAt,
          accountName: accounts.name,
          createdByName: users.name,
          createdByEmail: users.email,
        })
        .from(supportTickets)
        .leftJoin(accounts, eq(supportTickets.accountId, accounts.id))
        .leftJoin(users, eq(supportTickets.createdByUserId, users.id))
        .where(whereClause)
        .orderBy(desc(supportTickets.lastMessageAt))
        .limit(limit + 1);

      const hasMore = tickets.length > limit;
      const items = hasMore ? tickets.slice(0, limit) : tickets;
      const nextCursor = hasMore && items.length > 0
        ? items[items.length - 1].lastMessageAt?.toISOString()
        : null;

      return { items, nextCursor };
    }
  );

  // GET /api/system-admin/support-tickets/stats — aggregate stats
  app.get("/stats", async () => {
    const [statusCounts] = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open') AS open_count,
        COUNT(*) FILTER (WHERE status = 'awaiting_reply') AS awaiting_reply_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_count,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_count,
        COUNT(*) FILTER (WHERE status = 'closed') AS closed_count,
        COUNT(*) FILTER (WHERE assigned_admin_id IS NULL AND status NOT IN ('resolved', 'closed')) AS unassigned_count,
        COUNT(*) AS total_count
      FROM support_tickets
    `) as any[];

    return {
      open: Number(statusCounts?.open_count || 0),
      awaitingReply: Number(statusCounts?.awaiting_reply_count || 0),
      inProgress: Number(statusCounts?.in_progress_count || 0),
      resolved: Number(statusCounts?.resolved_count || 0),
      closed: Number(statusCounts?.closed_count || 0),
      unassigned: Number(statusCounts?.unassigned_count || 0),
      total: Number(statusCounts?.total_count || 0),
    };
  });

  // GET /api/system-admin/support-tickets/:ticketId — full detail with internal notes
  app.get<{ Params: { ticketId: string } }>(
    "/:ticketId",
    async (request, reply) => {
      const { ticketId } = request.params;

      const [ticket] = await db
        .select({
          id: supportTickets.id,
          ticketNumber: supportTickets.ticketNumber,
          accountId: supportTickets.accountId,
          type: supportTickets.type,
          subject: supportTickets.subject,
          status: supportTickets.status,
          priority: supportTickets.priority,
          assignedAdminId: supportTickets.assignedAdminId,
          lastMessageAt: supportTickets.lastMessageAt,
          resolvedAt: supportTickets.resolvedAt,
          closedAt: supportTickets.closedAt,
          createdAt: supportTickets.createdAt,
          accountName: accounts.name,
          createdByName: users.name,
          createdByEmail: users.email,
        })
        .from(supportTickets)
        .leftJoin(accounts, eq(supportTickets.accountId, accounts.id))
        .leftJoin(users, eq(supportTickets.createdByUserId, users.id))
        .where(eq(supportTickets.id, ticketId));

      if (!ticket) {
        return reply.code(404).send({ error: "Ticket not found" });
      }

      // Include ALL messages (including internal notes)
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
        .where(eq(supportTicketMessages.ticketId, ticketId))
        .orderBy(supportTicketMessages.createdAt);

      return { ticket, messages };
    }
  );

  // POST /api/system-admin/support-tickets/:ticketId/messages — admin reply or internal note
  app.post<{ Params: { ticketId: string } }>(
    "/:ticketId/messages",
    async (request, reply) => {
      const { ticketId } = request.params;
      const { body, isInternalNote = false } = request.body as {
        body: string;
        isInternalNote?: boolean;
      };

      if (!body?.trim()) {
        return reply.code(400).send({ error: "body is required" });
      }

      const [ticket] = await db
        .select({ id: supportTickets.id, status: supportTickets.status })
        .from(supportTickets)
        .where(eq(supportTickets.id, ticketId));

      if (!ticket) {
        return reply.code(404).send({ error: "Ticket not found" });
      }

      const [message] = await db
        .insert(supportTicketMessages)
        .values({
          ticketId,
          userId: request.user.userId,
          body: body.trim(),
          isInternalNote,
        })
        .returning();

      // Non-internal replies set status to awaiting_reply
      if (!isInternalNote) {
        await db
          .update(supportTickets)
          .set({
            status: "awaiting_reply",
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(supportTickets.id, ticketId));
      }

      return reply.code(201).send(message);
    }
  );

  // PATCH /api/system-admin/support-tickets/:ticketId — update ticket fields
  app.patch<{ Params: { ticketId: string } }>(
    "/:ticketId",
    async (request, reply) => {
      const { ticketId } = request.params;
      const { status, priority, assignedAdminId } = request.body as {
        status?: string;
        priority?: string;
        assignedAdminId?: string | null;
      };

      const [ticket] = await db
        .select({ id: supportTickets.id, status: supportTickets.status })
        .from(supportTickets)
        .where(eq(supportTickets.id, ticketId));

      if (!ticket) {
        return reply.code(404).send({ error: "Ticket not found" });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      const systemMessages: string[] = [];

      if (status && status !== ticket.status) {
        const validStatuses = ["open", "awaiting_reply", "in_progress", "resolved", "closed"];
        if (!validStatuses.includes(status)) {
          return reply.code(400).send({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
        }
        updates.status = status;
        systemMessages.push(`Status changed to ${status}`);
        if (status === "resolved") updates.resolvedAt = new Date();
        if (status === "closed") updates.closedAt = new Date();
      }

      if (priority) {
        const validPriorities = ["low", "normal", "high", "urgent"];
        if (!validPriorities.includes(priority)) {
          return reply.code(400).send({ error: `Invalid priority. Must be one of: ${validPriorities.join(", ")}` });
        }
        updates.priority = priority;
        systemMessages.push(`Priority changed to ${priority}`);
      }

      if (assignedAdminId !== undefined) {
        updates.assignedAdminId = assignedAdminId;
        systemMessages.push(assignedAdminId ? `Assigned to admin` : `Unassigned`);
      }

      if (Object.keys(updates).length <= 1) {
        return reply.code(400).send({ error: "No valid fields to update" });
      }

      await db
        .update(supportTickets)
        .set(updates)
        .where(eq(supportTickets.id, ticketId));

      // Create system messages for changes
      for (const msg of systemMessages) {
        await db.insert(supportTicketMessages).values({
          ticketId,
          userId: request.user.userId,
          body: msg,
          isSystemMessage: true,
        });
      }

      return { message: "Ticket updated", changes: systemMessages };
    }
  );
};
