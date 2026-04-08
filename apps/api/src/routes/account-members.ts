import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  accounts,
  users,
  invitations,
} from "@appranks/db";
import { requireRole } from "../middleware/authorize.js";
import { sendInvitationEmail } from "../lib/email-enqueue.js";
import { requireIdempotencyKey } from "../middleware/idempotency.js";
import { RateLimiter } from "../utils/rate-limiter.js";

// Rate limit invitation endpoint: 20 requests per hour per user
const invitationLimiter = new RateLimiter({ maxAttempts: 20, windowMs: 60 * 60 * 1000, namespace: "invite" });
import {
  addMemberSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from "../schemas/account.js";


export const accountMemberRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // --- Members ---

  // GET /api/account/members
  app.get("/members", async (request) => {
    const { accountId } = request.user;

    const members = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
        lastSeenAt: users.lastSeenAt,
      })
      .from(users)
      .where(eq(users.accountId, accountId));

    return members;
  });

  // POST /api/account/members — create a user directly (owner only)
  app.post(
    "/members",
    { preHandler: [requireRole("owner"), requireIdempotencyKey()] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { email, name, password, role } = addMemberSchema.parse(request.body);

      // Check user limit
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));

      if (!account) {
        return reply.code(404).send({ error: "Account not found" });
      }

      const [{ memberCount }] = await db
        .select({ memberCount: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.accountId, accountId));

      if (memberCount >= account.maxUsers) {
        return reply.code(403).send({
          error: "User limit reached", code: "PLAN_LIMIT_REACHED", upgradeUrl: "/pricing",
          current: memberCount,
          max: account.maxUsers,
        });
      }

      // Check if email is already taken
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()));

      if (existingUser) {
        return reply.code(409).send({ error: "User with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          name,
          accountId,
          role,
        })
        .returning();

      return {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        createdAt: newUser.createdAt,
      };
    }
  );

  // POST /api/account/members/invite
  app.post(
    "/members/invite",
    { preHandler: [requireRole("owner")] },
    async (request, reply) => {
      // IP-based rate limit for invitation endpoint
      const rl = invitationLimiter.check(request.user.userId);
      if (!rl.allowed) {
        reply.header("Retry-After", Math.ceil(rl.retryAfterMs / 1000).toString());
        return reply.code(429).send({ error: "Too many invitation requests. Please try again later." });
      }

      const { accountId, userId } = request.user;
      const { email, role } = inviteMemberSchema.parse(request.body);

      // Check user limit (members + pending invitations)
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));

      const [{ memberCount }] = await db
        .select({ memberCount: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.accountId, accountId));

      const [{ pendingCount }] = await db
        .select({ pendingCount: sql<number>`count(*)::int` })
        .from(invitations)
        .where(
          and(
            eq(invitations.accountId, accountId),
            sql`${invitations.acceptedAt} IS NULL`,
            sql`${invitations.expiresAt} > NOW()`
          )
        );

      if (memberCount + pendingCount >= account.maxUsers) {
        return reply.code(403).send({
          error: "User limit reached", code: "PLAN_LIMIT_REACHED", upgradeUrl: "/pricing",
          current: memberCount + pendingCount,
          max: account.maxUsers,
        });
      }

      // Rate limit: max 10 invitations per account per day
      const [{ todayCount }] = await db
        .select({ todayCount: sql<number>`count(*)::int` })
        .from(invitations)
        .where(
          and(
            eq(invitations.accountId, accountId),
            sql`${invitations.createdAt} >= NOW() - INTERVAL '24 hours'`
          )
        );

      if (todayCount >= 10) {
        return reply.code(429).send({
          error: "Invitation limit reached. Maximum 10 invitations per day.",
        });
      }

      // Check if email is already a member
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()));

      if (existingUser) {
        return reply
          .code(409)
          .send({ error: "User with this email already exists" });
      }

      // Check if there's already a pending invitation for this email
      const [existingInvite] = await db
        .select({ id: invitations.id })
        .from(invitations)
        .where(
          and(
            eq(invitations.accountId, accountId),
            eq(invitations.email, email.toLowerCase()),
            sql`${invitations.acceptedAt} IS NULL`
          )
        );

      if (existingInvite) {
        return reply
          .code(409)
          .send({ error: "An invitation has already been sent to this email" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const [invitation] = await db
        .insert(invitations)
        .values({
          accountId,
          email: email.toLowerCase(),
          role,
          invitedByUserId: userId,
          token,
          expiresAt,
        })
        .returning();

      // Enqueue invitation email (fire-and-forget)
      const [inviter] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId));

      sendInvitationEmail(
        invitation.email,
        inviter?.name || "A team member",
        account.name,
        invitation.token,
        { role: invitation.role, accountId }
      ).catch(() => {});

      // Log activity
      import("../utils/activity-log.js").then(m => m.logActivity(db, accountId, userId, "member_invited", "invitation", invitation.email, { email: invitation.email, role: invitation.role })).catch(() => {});

      return {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        expiresAt: invitation.expiresAt,
      };
    }
  );

  // GET /api/account/invitations — pending invitations
  app.get(
    "/invitations",
    { preHandler: [requireRole("owner")] },
    async (request) => {
      const { accountId } = request.user;

      const rows = await db
        .select({
          id: invitations.id,
          email: invitations.email,
          role: invitations.role,
          token: invitations.token,
          createdAt: invitations.createdAt,
          expiresAt: invitations.expiresAt,
          acceptedAt: invitations.acceptedAt,
          invitedByName: users.name,
        })
        .from(invitations)
        .leftJoin(users, eq(invitations.invitedByUserId, users.id))
        .where(eq(invitations.accountId, accountId));

      return rows.map((r) => ({
        ...r,
        invitedByName: r.invitedByName || "Unknown",
        expired: r.expiresAt < new Date() && !r.acceptedAt,
        accepted: !!r.acceptedAt,
      }));
    }
  );

  // DELETE /api/account/invitations/:id — cancel/revoke invitation
  app.delete<{ Params: { id: string } }>(
    "/invitations/:id",
    { preHandler: [requireRole("owner")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;

      const deleted = await db
        .delete(invitations)
        .where(
          and(eq(invitations.id, id), eq(invitations.accountId, accountId))
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Invitation not found" });
      }

      import("../utils/activity-log.js").then(m => m.logActivity(db, request.user.accountId, request.user.userId, "invitation_cancelled", "invitation", id, { email: deleted[0].email })).catch(() => {});
      return { message: "Invitation cancelled" };
    }
  );

  // POST /api/account/invitations/:id/resend — resend invitation email
  const resendLimiter = new RateLimiter({ maxAttempts: 3, windowMs: 60 * 60 * 1000, namespace: "resend" });

  app.post<{ Params: { id: string } }>(
    "/invitations/:id/resend",
    { preHandler: [requireRole("owner")] },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const { id } = request.params;

      // Rate limit per invitation
      const rl = resendLimiter.check(id);
      if (!rl.allowed) {
        reply.header("Retry-After", Math.ceil(rl.retryAfterMs / 1000).toString());
        return reply.code(429).send({ error: "Resend limit reached. Please try again later." });
      }

      // Find invitation
      const [invitation] = await db
        .select()
        .from(invitations)
        .where(
          and(eq(invitations.id, id), eq(invitations.accountId, accountId))
        );

      if (!invitation) {
        return reply.code(404).send({ error: "Invitation not found" });
      }

      if (invitation.acceptedAt) {
        return reply.code(400).send({ error: "Invitation already accepted" });
      }

      // Generate new token and reset expiry
      const newToken = crypto.randomBytes(32).toString("hex");
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const [updated] = await db
        .update(invitations)
        .set({ token: newToken, expiresAt: newExpiresAt })
        .where(eq(invitations.id, id))
        .returning();

      // Get inviter name and account name for email
      const [account] = await db
        .select({ name: accounts.name })
        .from(accounts)
        .where(eq(accounts.id, accountId));

      const [inviter] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId));

      sendInvitationEmail(
        updated.email,
        inviter?.name || "A team member",
        account?.name || "Your team",
        updated.token,
        { role: updated.role, accountId }
      ).catch(() => {});

      import("../utils/activity-log.js").then(m => m.logActivity(db, accountId, userId, "invitation_resent", "invitation", id, { email: updated.email })).catch(() => {});

      return {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        token: updated.token,
        expiresAt: updated.expiresAt,
      };
    }
  );

  // DELETE /api/account/members/:userId
  app.delete<{ Params: { userId: string } }>(
    "/members/:userId",
    { preHandler: [requireRole("owner")] },
    async (request, reply) => {
      const { accountId, userId: currentUserId } = request.user;
      const { userId } = request.params;

      if (userId === currentUserId) {
        return reply.code(400).send({ error: "Cannot remove yourself" });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user || user.accountId !== accountId) {
        return reply.code(404).send({ error: "User not found in account" });
      }

      await db.delete(users).where(eq(users.id, userId));

      import("../utils/activity-log.js").then(m => m.logActivity(db, request.user.accountId, request.user.userId, "member_removed", "user", userId, { email: user.email, role: user.role })).catch(() => {});
      return { message: "User removed" };
    }
  );

  // PATCH /api/account/members/:userId/role
  app.patch<{ Params: { userId: string } }>(
    "/members/:userId/role",
    { preHandler: [requireRole("owner")] },
    async (request, reply) => {
      const { accountId, userId: currentUserId } = request.user;
      const { userId } = request.params;
      const { role } = updateMemberRoleSchema.parse(request.body);

      if (userId === currentUserId) {
        return reply.code(400).send({ error: "Cannot change your own role" });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user || user.accountId !== accountId) {
        return reply.code(404).send({ error: "User not found in account" });
      }

      const [updated] = await db
        .update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      return {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
      };
    }
  );
};
