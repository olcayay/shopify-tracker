import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import { waitlist } from "@appranks/db";
import { RateLimiter } from "../utils/rate-limiter.js";
import { isDisposableEmail } from "../utils/disposable-emails.js";
import { z } from "zod";

const waitlistSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .max(255)
    .transform((e) => e.toLowerCase().trim()),
});

// 5 attempts per 15 min per IP
export const waitlistLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  namespace: "waitlist",
});

export const waitlistRoutes: FastifyPluginAsync = async (app) => {
  const db = app.writeDb;

  // POST /public/waitlist — join the waitlist (public, no auth)
  app.post("/waitlist", async (request, reply) => {
    const limit = waitlistLimiter.check(request.ip);
    if (!limit.allowed) {
      reply.header("Retry-After", Math.ceil(limit.retryAfterMs / 1000).toString());
      return reply.code(429).send({ error: "Too many requests. Please try again later." });
    }

    let parsed: z.infer<typeof waitlistSchema>;
    try {
      parsed = waitlistSchema.parse(request.body);
    } catch (e: any) {
      const msg = e.errors?.[0]?.message || "Invalid email";
      return reply.code(400).send({ error: msg });
    }

    if (isDisposableEmail(parsed.email)) {
      return reply.code(400).send({ error: "Please use a permanent email address" });
    }

    try {
      await db
        .insert(waitlist)
        .values({
          email: parsed.email,
          ipAddress: request.ip,
          userAgent: (request.headers["user-agent"] || "").slice(0, 512),
          referrer: ((request.headers["referer"] || request.headers["referrer"] || "") as string).slice(0, 512) || null,
        })
        .onConflictDoNothing({ target: waitlist.email });
    } catch {
      // Swallow — always return success to prevent email enumeration
    }

    return { success: true, message: "You've been added to the waitlist!" };
  });
};

export const waitlistAdminRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /system-admin/waitlist — list all waitlist entries
  app.get("/waitlist", async (request, reply) => {
    const entries = await db
      .select({
        id: waitlist.id,
        email: waitlist.email,
        ipAddress: waitlist.ipAddress,
        userAgent: waitlist.userAgent,
        referrer: waitlist.referrer,
        notes: waitlist.notes,
        createdAt: waitlist.createdAt,
      })
      .from(waitlist)
      .orderBy(desc(waitlist.createdAt));

    return entries;
  });

  // GET /system-admin/waitlist/count — quick count
  app.get("/waitlist/count", async () => {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(waitlist);
    return { count: row?.count || 0 };
  });

  // DELETE /system-admin/waitlist/:id — remove entry
  app.delete<{ Params: { id: string } }>("/waitlist/:id", async (request, reply) => {
    const { id } = request.params;
    const deleted = await db.delete(waitlist).where(eq(waitlist.id, id)).returning({ id: waitlist.id });
    if (deleted.length === 0) return reply.code(404).send({ error: "Entry not found" });
    return { success: true };
  });
};
