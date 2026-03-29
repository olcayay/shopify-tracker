import type { FastifyPluginAsync } from "fastify";
import { eq, and, sql, desc, lt } from "drizzle-orm";
import {
  notifications,
  notificationTypeConfigs,
  userNotificationPreferences,
} from "@appranks/db";

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /notifications — List notifications (cursor-based pagination)
  app.get<{
    Querystring: {
      limit?: string;
      cursor?: string;
      category?: string;
      unreadOnly?: string;
    };
  }>("/", async (request) => {
    const userId = request.user.userId;
    const limit = Math.min(parseInt(request.query.limit || "30", 10), 100);
    const { cursor, category, unreadOnly } = request.query;

    const conditions = [
      eq(notifications.userId, userId),
      eq(notifications.isArchived, false),
    ];
    if (category) conditions.push(eq(notifications.category, category));
    if (unreadOnly === "true") conditions.push(eq(notifications.isRead, false));
    if (cursor) conditions.push(lt(notifications.createdAt, new Date(cursor)));

    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        category: notifications.category,
        title: notifications.title,
        body: notifications.body,
        url: notifications.url,
        icon: notifications.icon,
        priority: notifications.priority,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit + 1); // +1 to check hasMore

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

    return { notifications: items, hasMore, nextCursor };
  });

  // GET /notifications/unread-count
  app.get("/unread-count", async (request) => {
    const userId = request.user.userId;

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
          eq(notifications.isArchived, false)
        )
      );

    return { count: result?.count ?? 0 };
  });

  // POST /notifications/:id/read
  app.post<{ Params: { id: string } }>("/:id/read", async (request, reply) => {
    const result = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.id, request.params.id),
          eq(notifications.userId, request.user.userId)
        )
      )
      .returning({ id: notifications.id });

    if (result.length === 0) return reply.code(404).send({ error: "Notification not found" });
    return { success: true };
  });

  // POST /notifications/read-all
  app.post("/read-all", async (request) => {
    const result = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, request.user.userId),
          eq(notifications.isRead, false)
        )
      );

    return { success: true, updated: (result as any).rowCount ?? 0 };
  });

  // POST /notifications/:id/archive
  app.post<{ Params: { id: string } }>("/:id/archive", async (request, reply) => {
    const result = await db
      .update(notifications)
      .set({ isArchived: true })
      .where(
        and(
          eq(notifications.id, request.params.id),
          eq(notifications.userId, request.user.userId)
        )
      )
      .returning({ id: notifications.id });

    if (result.length === 0) return reply.code(404).send({ error: "Notification not found" });
    return { success: true };
  });

  // GET /notifications/preferences
  app.get("/preferences", async (request) => {
    const userId = request.user.userId;

    // Get global defaults
    const globalConfigs = await db
      .select({
        notificationType: notificationTypeConfigs.notificationType,
        inAppEnabled: notificationTypeConfigs.inAppEnabled,
        pushDefaultEnabled: notificationTypeConfigs.pushDefaultEnabled,
      })
      .from(notificationTypeConfigs)
      .orderBy(notificationTypeConfigs.notificationType);

    // Get user overrides
    const userPrefs = await db
      .select({
        notificationType: userNotificationPreferences.notificationType,
        inAppEnabled: userNotificationPreferences.inAppEnabled,
        pushEnabled: userNotificationPreferences.pushEnabled,
      })
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId));

    const userPrefMap = new Map(userPrefs.map((p) => [p.notificationType, p]));

    // Merge: user overrides take precedence over global defaults
    const preferences = globalConfigs.map((gc) => {
      const up = userPrefMap.get(gc.notificationType);
      return {
        type: gc.notificationType,
        inAppEnabled: up?.inAppEnabled ?? gc.inAppEnabled,
        pushEnabled: up?.pushEnabled ?? gc.pushDefaultEnabled,
      };
    });

    return { preferences };
  });

  // PATCH /notifications/preferences — Bulk update
  app.patch<{
    Body: { preferences: { type: string; inAppEnabled?: boolean; pushEnabled?: boolean }[] };
  }>("/preferences", async (request) => {
    const userId = request.user.userId;
    const { preferences } = request.body;

    if (!Array.isArray(preferences)) {
      return { error: "preferences array required" };
    }

    for (const pref of preferences) {
      await db
        .insert(userNotificationPreferences)
        .values({
          userId,
          notificationType: pref.type,
          inAppEnabled: pref.inAppEnabled ?? null,
          pushEnabled: pref.pushEnabled ?? null,
        })
        .onConflictDoUpdate({
          target: [userNotificationPreferences.userId, userNotificationPreferences.notificationType],
          set: {
            inAppEnabled: pref.inAppEnabled ?? null,
            pushEnabled: pref.pushEnabled ?? null,
            updatedAt: new Date(),
          },
        });
    }

    return { success: true, updated: preferences.length };
  });

  // PATCH /notifications/preferences/:type — Update single type
  app.patch<{
    Params: { type: string };
    Body: { inAppEnabled?: boolean; pushEnabled?: boolean };
  }>("/preferences/:type", async (request) => {
    const userId = request.user.userId;
    const { type } = request.params;

    await db
      .insert(userNotificationPreferences)
      .values({
        userId,
        notificationType: type,
        inAppEnabled: request.body.inAppEnabled ?? null,
        pushEnabled: request.body.pushEnabled ?? null,
      })
      .onConflictDoUpdate({
        target: [userNotificationPreferences.userId, userNotificationPreferences.notificationType],
        set: {
          inAppEnabled: request.body.inAppEnabled ?? null,
          pushEnabled: request.body.pushEnabled ?? null,
          updatedAt: new Date(),
        },
      });

    return { success: true };
  });
};
