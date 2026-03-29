import type { FastifyPluginAsync } from "fastify";
import { eq, sql, desc, and } from "drizzle-orm";
import { notifications } from "@appranks/db";

/**
 * Server-Sent Events endpoint for real-time notification delivery (PLA-354).
 *
 * Client connects to GET /api/notifications/stream and receives events:
 * - notification: new notification created
 * - unread-count: updated unread count
 * - heartbeat: keep-alive every 30 seconds
 */
export const notificationStreamRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  app.get("/stream", async (request, reply) => {
    const userId = request.user.userId;

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    });

    // Send initial unread count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false), eq(notifications.isArchived, false)));

    reply.raw.write(`event: unread-count\ndata: ${JSON.stringify({ count })}\n\n`);

    // Poll for new notifications every 15 seconds
    let lastCheckedAt = new Date();
    const interval = setInterval(async () => {
      try {
        // Check for new notifications since last check
        const newNotifs = await db
          .select({
            id: notifications.id,
            type: notifications.type,
            category: notifications.category,
            title: notifications.title,
            body: notifications.body,
            url: notifications.url,
            priority: notifications.priority,
            createdAt: notifications.createdAt,
          })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, userId),
              sql`${notifications.createdAt} > ${lastCheckedAt}`
            )
          )
          .orderBy(desc(notifications.createdAt))
          .limit(10);

        for (const notif of newNotifs) {
          reply.raw.write(`event: notification\ndata: ${JSON.stringify(notif)}\n\n`);
        }

        if (newNotifs.length > 0) {
          // Send updated unread count
          const [updated] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(notifications)
            .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false), eq(notifications.isArchived, false)));

          reply.raw.write(`event: unread-count\ndata: ${JSON.stringify({ count: updated.count })}\n\n`);
          lastCheckedAt = new Date();
        }

        // Heartbeat
        reply.raw.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
      } catch {
        // Connection likely closed
        clearInterval(interval);
      }
    }, 15000);

    // Cleanup on connection close
    request.raw.on("close", () => {
      clearInterval(interval);
    });
  });
};

/**
 * Notification grouping utilities.
 * Groups related notifications to reduce noise.
 */
export interface NotificationGroup {
  category: string;
  count: number;
  latestTitle: string;
  latestBody: string | null;
  notifications: { id: string; title: string; createdAt: string }[];
}

export function groupNotifications(
  notifs: { id: string; category: string; title: string; body: string | null; createdAt: string }[]
): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();

  for (const n of notifs) {
    const existing = groups.get(n.category);
    if (existing) {
      existing.count++;
      existing.notifications.push({ id: n.id, title: n.title, createdAt: n.createdAt });
    } else {
      groups.set(n.category, {
        category: n.category,
        count: 1,
        latestTitle: n.title,
        latestBody: n.body,
        notifications: [{ id: n.id, title: n.title, createdAt: n.createdAt }],
      });
    }
  }

  return [...groups.values()].sort((a, b) => b.count - a.count);
}

/**
 * Milestone detection for notification system.
 * Detects when metrics cross notable thresholds.
 */
export function detectMilestones(
  current: number,
  previous: number,
  thresholds: number[] = [10, 25, 50, 100, 250, 500, 1000, 5000, 10000]
): number | null {
  for (const t of thresholds) {
    if (current >= t && previous < t) return t;
  }
  return null;
}

/**
 * Notification retention policy.
 * Returns the cutoff date for old notifications.
 */
export function getRetentionCutoff(daysToKeep: number = 90): Date {
  return new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
}
