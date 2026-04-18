import type { FastifyPluginAsync } from "fastify";
import { eq, and, sql } from "drizzle-orm";
import { emailLogs, emailUnsubscribeTokens, userEmailPreferences } from "@appranks/db";

// 1x1 transparent PNG (68 bytes)
const TRANSPARENT_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64"
);

export const emailTrackingRoutes: FastifyPluginAsync = async (app) => {
  const db = app.writeDb;

  // --- Open tracking pixel ---
  app.get<{ Params: { logId: string } }>(
    "/track/open/:logId.png",
    async (request, reply) => {
      const { logId } = request.params;
      const id = logId.replace(/\.png$/, "");

      // Update opened_at (only on first open)
      try {
        await db
          .update(emailLogs)
          .set({ openedAt: new Date() })
          .where(
            and(
              eq(emailLogs.id, id),
              sql`${emailLogs.openedAt} IS NULL`
            )
          );
      } catch {
        // Non-critical — still return pixel
      }

      reply
        .header("content-type", "image/png")
        .header("cache-control", "no-store, no-cache, must-revalidate")
        .header("pragma", "no-cache")
        .send(TRANSPARENT_PIXEL);
    }
  );

  // --- Click tracking redirect ---
  app.get<{ Params: { logId: string; linkIndex: string } }>(
    "/track/click/:logId/:linkIndex",
    async (request, reply) => {
      const { logId, linkIndex } = request.params;
      const idx = parseInt(linkIndex, 10);

      // Look up original URL from dataSnapshot.linkMap
      let originalUrl = "https://appranks.io";
      try {
        const [log] = await db
          .select({ dataSnapshot: emailLogs.dataSnapshot })
          .from(emailLogs)
          .where(eq(emailLogs.id, logId))
          .limit(1);

        if (log?.dataSnapshot) {
          const snapshot = log.dataSnapshot as Record<string, any>;
          const linkMap = snapshot.linkMap as Record<string, string> | undefined;
          if (linkMap && linkMap[idx]) {
            originalUrl = linkMap[idx];
          }
        }

        // Update clicked_at (only on first click)
        await db
          .update(emailLogs)
          .set({ clickedAt: new Date() })
          .where(
            and(
              eq(emailLogs.id, logId),
              sql`${emailLogs.clickedAt} IS NULL`
            )
          );
      } catch {
        // Non-critical — redirect anyway
      }

      reply.code(302).header("location", originalUrl).send();
    }
  );

  // --- Unsubscribe (GET — show confirmation page) ---
  app.get<{ Params: { token: string } }>(
    "/unsubscribe/:token",
    async (request, reply) => {
      const { token } = request.params;

      const [row] = await db
        .select({
          id: emailUnsubscribeTokens.id,
          emailType: emailUnsubscribeTokens.emailType,
          usedAt: emailUnsubscribeTokens.usedAt,
        })
        .from(emailUnsubscribeTokens)
        .where(eq(emailUnsubscribeTokens.token, token))
        .limit(1);

      if (!row) {
        reply.type("text/html").code(404).send(renderPage("Invalid Link", "<p>This unsubscribe link is invalid or has expired.</p>"));
        return;
      }

      if (row.usedAt) {
        reply.type("text/html").send(renderPage("Already Unsubscribed", "<p>You have already been unsubscribed.</p>"));
        return;
      }

      const typeName = row.emailType
        ? row.emailType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "All Emails";

      reply.type("text/html").send(renderPage("Unsubscribe", `
        <h2>Unsubscribe from ${typeName}</h2>
        <p>Are you sure you want to unsubscribe from <strong>${typeName}</strong>?</p>
        <form method="POST" action="/api/emails/unsubscribe/${token}">
          <button type="submit" style="padding:12px 24px;background:#111;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:16px;">
            Confirm Unsubscribe
          </button>
        </form>
        <p style="margin-top:16px;font-size:14px;color:#666;">
          You can always re-enable emails from your <a href="https://appranks.io/settings">account settings</a>.
        </p>
      `));
    }
  );

  // --- Unsubscribe (POST — process) ---
  app.post<{ Params: { token: string } }>(
    "/unsubscribe/:token",
    async (request, reply) => {
      const { token } = request.params;

      const [row] = await db
        .select({
          id: emailUnsubscribeTokens.id,
          userId: emailUnsubscribeTokens.userId,
          emailType: emailUnsubscribeTokens.emailType,
          usedAt: emailUnsubscribeTokens.usedAt,
        })
        .from(emailUnsubscribeTokens)
        .where(eq(emailUnsubscribeTokens.token, token))
        .limit(1);

      if (!row) {
        reply.type("text/html").code(404).send(renderPage("Invalid Link", "<p>This unsubscribe link is invalid or has expired.</p>"));
        return;
      }

      if (row.usedAt) {
        reply.type("text/html").send(renderPage("Already Unsubscribed", "<p>You have already been unsubscribed.</p>"));
        return;
      }

      // Mark token as used
      await db
        .update(emailUnsubscribeTokens)
        .set({ usedAt: new Date() })
        .where(eq(emailUnsubscribeTokens.id, row.id));

      // Update user preferences
      if (row.emailType) {
        // Per-type unsubscribe
        await db
          .insert(userEmailPreferences)
          .values({
            userId: row.userId,
            emailType: row.emailType,
            enabled: false,
          })
          .onConflictDoUpdate({
            target: [userEmailPreferences.userId, userEmailPreferences.emailType],
            set: { enabled: false, updatedAt: new Date() },
          });
      } else {
        // Global unsubscribe — disable all email types
        const { users } = await import("@appranks/db");
        await db
          .update(users)
          .set({ emailDigestEnabled: false })
          .where(eq(users.id, row.userId));
      }

      const typeName = row.emailType
        ? row.emailType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "All Emails";

      reply.type("text/html").send(renderPage("Unsubscribed", `
        <h2>You've been unsubscribed</h2>
        <p>You will no longer receive <strong>${typeName}</strong> emails from AppRanks.</p>
        <p style="margin-top:16px;font-size:14px;color:#666;">
          Changed your mind? Visit your <a href="https://appranks.io/settings">account settings</a> to re-enable.
        </p>
      `));
    }
  );
};

/** Render a simple HTML page for unsubscribe flow */
function renderPage(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — AppRanks</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; color: #333; }
    h2 { font-size: 24px; margin-bottom: 12px; }
    p { line-height: 1.6; }
    a { color: #111; }
  </style>
</head>
<body>
  <div style="margin-bottom:24px;font-weight:700;font-size:20px;">AppRanks</div>
  ${content}
</body>
</html>`;
}
